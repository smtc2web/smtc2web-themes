import { b64urlDecode, b64urlEncode } from './bytes';
import { getUserById, upsertUser, type UserRow } from './db';
import { HttpError } from './http';

const SESSION_COOKIE = 's2w_session';
const STATE_COOKIE = 's2w_oauth_state';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get('cookie');
	if (!header) return null;
	for (const part of header.split(';')) {
		const eq = part.indexOf('=');
		if (eq < 0) continue;
		if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
	}
	return null;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(env: Env, userId: number): Promise<string> {
	const payload = b64urlEncode(
		new TextEncoder().encode(JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })),
	);
	const signature = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), new TextEncoder().encode(payload));
	return `${payload}.${b64urlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(env: Env, token: string): Promise<number | null> {
	const dot = token.lastIndexOf('.');
	if (dot <= 0) return null;
	const payload = token.slice(0, dot);
	let valid: boolean;
	try {
		valid = await crypto.subtle.verify(
			'HMAC',
			await hmacKey(env.SESSION_SECRET),
			b64urlDecode(token.slice(dot + 1)),
			new TextEncoder().encode(payload),
		);
	} catch {
		return null;
	}
	if (!valid) return null;
	try {
		const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as { uid?: unknown; exp?: unknown };
		if (typeof data.uid !== 'number' || typeof data.exp !== 'number') return null;
		if (data.exp < Math.floor(Date.now() / 1000)) return null;
		return data.uid;
	} catch {
		return null;
	}
}

export async function requireUser(request: Request, env: Env): Promise<UserRow> {
	const token = readCookie(request, SESSION_COOKIE);
	if (!token) throw new HttpError(401, '请先使用 GitHub 登录');
	const userId = await verifySessionToken(env, token);
	if (userId === null) throw new HttpError(401, '登录状态已失效，请重新登录');
	const user = await getUserById(env.DB, userId);
	if (!user) throw new HttpError(401, '用户不存在，请重新登录');
	return user;
}

export function isAdmin(env: Env, user: UserRow): boolean {
	return env.ADMIN_GITHUB_LOGINS.split(',')
		.map((login) => login.trim().toLowerCase())
		.filter(Boolean)
		.includes(user.login.toLowerCase());
}

function sessionCookie(value: string): string {
	return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

function stateCookie(value: string): string {
	return `${STATE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

function clearCookie(name: string): string {
	return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function callbackUrl(request: Request): string {
	return new URL('/api/auth/github/callback', request.url).toString();
}

function redirect(location: string, cookies: string[] = []): Response {
	const headers = new Headers({ location });
	for (const cookie of cookies) headers.append('set-cookie', cookie);
	return new Response(null, { status: 302, headers });
}

export function handleAuthStart(request: Request, env: Env): Response {
	const state = crypto.randomUUID();
	const url = new URL('https://github.com/login/oauth/authorize');
	url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
	url.searchParams.set('redirect_uri', callbackUrl(request));
	url.searchParams.set('scope', 'read:user');
	url.searchParams.set('state', state);
	return redirect(url.toString(), [stateCookie(state)]);
}

export async function handleAuthCallback(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = readCookie(request, STATE_COOKIE);
	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		console.warn('auth: missing client credentials configuration');
		return redirect('/?auth_error=config', [clearCookie(STATE_COOKIE)]);
	}
	if (url.searchParams.get('error')) {
		console.warn('auth: github returned error', url.searchParams.get('error'), url.searchParams.get('error_description'));
		return redirect('/?auth_error=denied', [clearCookie(STATE_COOKIE)]);
	}
	if (!code || !state || !expectedState || state !== expectedState) {
		console.warn('auth: state mismatch', { hasCode: Boolean(code), hasState: Boolean(state), hasCookie: Boolean(expectedState) });
		return redirect('/?auth_error=state', [clearCookie(STATE_COOKIE)]);
	}

	const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'smtc2web-themes' },
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: callbackUrl(request),
		}),
	});
	const tokenBody = (await tokenResponse.json()) as { access_token?: string; error?: string; error_description?: string };
	if (!tokenBody.access_token) {
		console.warn('auth: token exchange failed', tokenBody.error, tokenBody.error_description);
		return redirect('/?auth_error=token', [clearCookie(STATE_COOKIE)]);
	}

	const userResponse = await fetch('https://api.github.com/user', {
		headers: {
			authorization: `Bearer ${tokenBody.access_token}`,
			accept: 'application/vnd.github+json',
			'user-agent': 'smtc2web-themes',
		},
	});
	if (!userResponse.ok) {
		console.warn('auth: github user fetch failed', userResponse.status);
		return redirect('/?auth_error=user', [clearCookie(STATE_COOKIE)]);
	}
	const profile = (await userResponse.json()) as { id: number; login: string; name?: string | null; avatar_url?: string | null };
	const user = await upsertUser(env.DB, {
		githubId: profile.id,
		login: profile.login,
		name: profile.name ?? null,
		avatarUrl: profile.avatar_url ?? null,
	});

	const session = await createSessionToken(env, user.id);
	console.log('auth: login ok', user.login);
	return redirect('/', [sessionCookie(session), clearCookie(STATE_COOKIE)]);
}

export function handleLogout(): Response {
	return new Response(JSON.stringify({ ok: true }), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': clearCookie(SESSION_COOKIE) },
	});
}
