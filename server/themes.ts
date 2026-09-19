import { verifyActionsToken } from './actions-auth';
import { MAX_ZIP_BYTES, screenshotMime } from './archive';
import { isAdmin, requireUser } from './auth';
import {
	deleteTheme,
	getLatestVersion,
	getThemeBySlug,
	getVersion,
	listOwnerThemes,
	listTags,
	listThemes,
	listVersions,
	recordDownload,
	setThemeStatus,
	upsertUser,
	type ThemeListRow,
	type VersionRow,
} from './db';
import { HttpError, json, publicJson, str } from './http';
import { publishTheme, type PublishResult } from './publish';

export interface Ctx {
	request: Request;
	env: Env;
	url: URL;
	params: Record<string, string>;
}

function serializeTheme(row: ThemeListRow, request: Request, includeStatus: boolean) {
	const origin = new URL(request.url).origin;
	return {
		slug: row.slug,
		name: row.name,
		description: row.description,
		tags: JSON.parse(row.tags) as string[],
		author: { login: row.author_login, avatar_url: row.author_avatar_url },
		version: row.latest_version,
		version_count: row.version_count,
		downloads: row.downloads,
		repo_url: row.repo_url,
		source_repo: row.source_repo,
		published_via: row.publish_source,
		status: includeStatus ? row.status : undefined,
		screenshot_url: `${origin}/api/themes/${row.slug}/screenshot`,
		download_url: `${origin}/api/themes/${row.slug}/download`,
		page_url: `${origin}/themes/${row.slug}`,
		created_at: row.created_at,
		updated_at: row.updated_at,
	};
}

function serializeVersion(version: VersionRow, request: Request, slug: string) {
	const origin = new URL(request.url).origin;
	return {
		version: version.version,
		size: version.size,
		downloads: version.downloads,
		has_screenshot: Boolean(version.screenshot_key),
		created_at: version.created_at,
		download_url: `${origin}/api/themes/${slug}/download?version=${encodeURIComponent(version.version)}`,
	};
}

function publishResponse(result: PublishResult, request: Request): Response {
	const origin = new URL(request.url).origin;
	return json(
		{
			ok: true,
			...result,
			page_url: `${origin}/themes/${result.slug}`,
			download_url: `${origin}/api/themes/${result.slug}/download`,
		},
		201,
	);
}

async function readZip(request: Request): Promise<{ zip: Uint8Array; slug?: string }> {
	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) throw new HttpError(400, '缺少 file 字段（主题 ZIP 文件）');
	if (file.size > MAX_ZIP_BYTES) throw new HttpError(400, `主题包大小不能超过 ${Math.floor(MAX_ZIP_BYTES / 1024 / 1024)}MB`);
	const slug = str(form.get('slug')) || undefined;
	return { zip: new Uint8Array(await file.arrayBuffer()), slug };
}

export async function listThemesHandler({ request, env, url }: Ctx): Promise<Response> {
	const q = str(url.searchParams.get('q')).slice(0, 60);
	const tag = str(url.searchParams.get('tag')).slice(0, 24);
	const sort = str(url.searchParams.get('sort')) || 'newest';
	const page = Math.max(1, Math.min(1000, Number(url.searchParams.get('page')) || 1));
	const pageSize = 24;
	const { themes, total } = await listThemes(env.DB, {
		q: q || undefined,
		tag: tag || undefined,
		sort,
		offset: (page - 1) * pageSize,
		limit: pageSize,
	});
	return publicJson({
		themes: themes.map((theme) => serializeTheme(theme, request, false)),
		total,
		page,
		page_size: pageSize,
		total_pages: Math.max(1, Math.ceil(total / pageSize)),
	});
}

export async function getThemeHandler({ request, env, params }: Ctx): Promise<Response> {
	const theme = await getThemeBySlug(env.DB, params.slug!);
	if (!theme || theme.status !== 'published') throw new HttpError(404, '主题不存在');
	const versions = await listVersions(env.DB, theme.id);
	return publicJson({
		theme: serializeTheme(theme, request, false),
		versions: versions.map((version) => serializeVersion(version, request, theme.slug)),
	});
}

export async function listTagsHandler({ env }: Ctx): Promise<Response> {
	return publicJson({ tags: await listTags(env.DB) });
}

export async function getScreenshotHandler({ env, params }: Ctx): Promise<Response> {
	const theme = await getThemeBySlug(env.DB, params.slug!);
	if (!theme || theme.status !== 'published') throw new HttpError(404, '主题不存在');
	const version = await getLatestVersion(env.DB, theme);
	if (!version?.screenshot_key) throw new HttpError(404, '该主题没有截图');
	const object = await env.THEMES_BUCKET.get(version.screenshot_key);
	if (!object) throw new HttpError(404, '截图文件不存在');
	return new Response(object.body, {
		headers: {
			'content-type': screenshotMime(version.screenshot_key) ?? 'application/octet-stream',
			'cache-control': 'public, max-age=3600',
			etag: object.httpEtag,
		},
	});
}

export async function downloadHandler({ env, params, url }: Ctx): Promise<Response> {
	const theme = await getThemeBySlug(env.DB, params.slug!);
	if (!theme || theme.status !== 'published') throw new HttpError(404, '主题不存在');
	const requested = str(url.searchParams.get('version'));
	const version = requested ? await getVersion(env.DB, theme.id, requested) : await getLatestVersion(env.DB, theme);
	if (!version) throw new HttpError(404, '请求的版本不存在');
	const object = await env.THEMES_BUCKET.get(version.r2_key);
	if (!object) throw new HttpError(404, '主题文件不存在');
	await recordDownload(env.DB, theme.id, version.id);
	return new Response(object.body, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="${theme.slug}-${version.version}.zip"`,
			'content-length': String(object.size),
			'cache-control': 'public, max-age=300',
			etag: object.httpEtag,
		},
	});
}

export async function myThemesHandler({ request, env }: Ctx): Promise<Response> {
	const user = await requireUser(request, env);
	const themes = await listOwnerThemes(env.DB, user.id);
	return json({ themes: themes.map((theme) => serializeTheme(theme, request, true)) });
}

export async function meHandler({ request, env }: Ctx): Promise<Response> {
	const user = await requireUser(request, env);
	return json({
		user: { login: user.login, name: user.name, avatar_url: user.avatar_url, is_admin: isAdmin(env, user) },
	});
}

export async function createThemeHandler(ctx: Ctx): Promise<Response> {
	const user = await requireUser(ctx.request, ctx.env);
	const { zip, slug } = await readZip(ctx.request);
	const result = await publishTheme(
		ctx.env,
		{ userId: user.id, login: user.login, sourceRepo: null, sourceRepoId: null, publishSource: 'web' },
		zip,
		slug,
	);
	return publishResponse(result, ctx.request);
}

export async function actionsPublishHandler(ctx: Ctx): Promise<Response> {
	const authorization = ctx.request.headers.get('authorization') ?? '';
	const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
	if (!token) throw new HttpError(401, '缺少 Actions OIDC Token');
	const claims = await verifyActionsToken(token, ctx.env);
	const user = await upsertUser(ctx.env.DB, {
		githubId: Number(claims.repository_owner_id),
		login: claims.repository_owner,
		name: null,
		avatarUrl: `https://github.com/${claims.repository_owner}.png`,
	});
	const { zip, slug } = await readZip(ctx.request);
	const result = await publishTheme(
		ctx.env,
		{
			userId: user.id,
			login: user.login,
			sourceRepo: claims.repository,
			sourceRepoId: Number(claims.repository_id),
			publishSource: 'actions',
		},
		zip,
		slug,
	);
	return publishResponse(result, ctx.request);
}

export async function patchThemeHandler({ request, env, params }: Ctx): Promise<Response> {
	const user = await requireUser(request, env);
	const theme = await getThemeBySlug(env.DB, params.slug!);
	if (!theme) throw new HttpError(404, '主题不存在');
	if (theme.author_id !== user.id && !isAdmin(env, user)) throw new HttpError(403, '无权管理该主题');
	const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
	const status = str(body?.status);
	if (status !== 'published' && status !== 'hidden') throw new HttpError(400, 'status 只能是 published 或 hidden');
	await setThemeStatus(env.DB, theme.id, status);
	const updated = await getThemeBySlug(env.DB, theme.slug);
	return json({ theme: serializeTheme(updated!, request, true) });
}

export async function deleteThemeHandler({ request, env, params }: Ctx): Promise<Response> {
	const user = await requireUser(request, env);
	const theme = await getThemeBySlug(env.DB, params.slug!);
	if (!theme) throw new HttpError(404, '主题不存在');
	if (theme.author_id !== user.id && !isAdmin(env, user)) throw new HttpError(403, '无权管理该主题');

	let cursor: string | undefined;
	do {
		const listed = await env.THEMES_BUCKET.list({ prefix: `themes/${theme.slug}/`, cursor });
		if (listed.objects.length) await env.THEMES_BUCKET.delete(listed.objects.map((object) => object.key));
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);

	await deleteTheme(env.DB, theme.id);
	return json({ ok: true, slug: theme.slug });
}
