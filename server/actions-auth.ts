import { b64urlDecode } from './bytes';
import { HttpError } from './http';

const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const CLOCK_SKEW_SECONDS = 60;

export interface ActionsClaims {
	iss: string;
	aud: string | string[];
	exp: number;
	iat: number;
	nbf?: number;
	repository: string;
	repository_id: string;
	repository_owner: string;
	repository_owner_id: string;
	job_workflow_ref: string;
	ref: string;
	ref_type: string;
	event_name: string;
	workflow_ref: string;
}

interface Jwk extends JsonWebKey {
	kid?: string;
}

let cachedKeys: { keys: Jwk[]; expiresAt: number } | null = null;

async function fetchJwks(force: boolean): Promise<Jwk[]> {
	if (!force && cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
	const response = await fetch(JWKS_URL);
	if (!response.ok) throw new HttpError(503, '无法获取 GitHub OIDC 公钥，请稍后重试');
	const body = (await response.json()) as { keys?: Jwk[] };
	const keys = body.keys ?? [];
	if (!keys.length) throw new HttpError(503, 'GitHub OIDC 公钥为空');
	cachedKeys = { keys, expiresAt: Date.now() + 60 * 60 * 1000 };
	return keys;
}

async function verifySignature(jwk: Jwk, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
	try {
		const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
		return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
	} catch {
		return false;
	}
}

export async function verifyActionsToken(token: string, env: Env): Promise<ActionsClaims> {
	const parts = token.split('.');
	if (parts.length !== 3) throw new HttpError(401, '无效的 Actions OIDC Token');

	let header: { alg?: string; kid?: string };
	let claims: ActionsClaims;
	try {
		header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0]!))) as { alg?: string; kid?: string };
		claims = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]!))) as ActionsClaims;
	} catch {
		throw new HttpError(401, '无效的 Actions OIDC Token');
	}
	if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, '不支持的 OIDC Token 签名算法');

	const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
	const signature = b64urlDecode(parts[2]!);
	let verified = false;
	for (const force of [false, true]) {
		const keys = await fetchJwks(force);
		const jwk = keys.find((key) => key.kid === header.kid);
		if (jwk && (await verifySignature(jwk, signature, signedData))) {
			verified = true;
			break;
		}
	}
	if (!verified) throw new HttpError(401, 'OIDC Token 签名校验失败');

	const now = Math.floor(Date.now() / 1000);
	const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
	if (claims.iss !== ISSUER) throw new HttpError(401, 'OIDC Token 签发方不正确');
	if (!audience.includes(env.OIDC_AUDIENCE)) throw new HttpError(401, 'OIDC Token 受众不正确');
	if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) throw new HttpError(401, 'OIDC Token 已过期');
	if (typeof claims.nbf === 'number' && claims.nbf - CLOCK_SKEW_SECONDS > now) throw new HttpError(401, 'OIDC Token 尚未生效');

	const expectedWorkflow = env.OIDC_WORKFLOW_REF.trim();
	if (expectedWorkflow && !claims.job_workflow_ref?.startsWith(`${expectedWorkflow}@`)) {
		throw new HttpError(403, '该流水线未被授权向主题商店发布主题');
	}
	if (!claims.repository || !claims.repository_owner || !claims.repository_owner_id) {
		throw new HttpError(401, 'OIDC Token 缺少仓库信息');
	}
	return claims;
}
