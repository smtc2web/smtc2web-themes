import { MAX_ZIP_BYTES, parseThemeArchive, screenshotMime, ThemeArchiveError } from './archive';
import { getThemeBySlug, insertTheme, insertVersion, updateThemeOnPublish } from './db';
import { HttpError } from './http';

export interface Publisher {
	userId: number;
	login: string;
	sourceRepo: string | null;
	sourceRepoId: number | null;
	publishSource: 'actions' | 'web';
}

export interface PublishResult {
	slug: string;
	name: string;
	version: string;
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64);
}

function slugFromRepo(repo: string): string {
	const name = repo.split('/')[1] ?? repo;
	return slugify(name.replace(/^smtc2web-theme-/, ''));
}

function isUniqueError(error: unknown): boolean {
	return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export async function publishTheme(env: Env, publisher: Publisher, zip: Uint8Array, slugInput?: string): Promise<PublishResult> {
	if (!zip.byteLength || zip.byteLength > MAX_ZIP_BYTES) {
		throw new HttpError(400, `主题包大小必须在 1 字节到 ${Math.floor(MAX_ZIP_BYTES / 1024 / 1024)}MB 之间`);
	}

	let parsed;
	try {
		parsed = parseThemeArchive(zip);
	} catch (error) {
		if (error instanceof ThemeArchiveError) throw new HttpError(400, error.message);
		throw error;
	}
	const { meta, screenshot } = parsed;

	let sourceRepo = publisher.sourceRepo;
	let sourceRepoId = publisher.sourceRepoId;
	if (!sourceRepo && meta.repository) {
		const match = /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?\/?$/i.exec(meta.repository);
		if (match && match[1]!.toLowerCase() === publisher.login.toLowerCase()) {
			sourceRepo = `${match[1]}/${match[2]}`;
			sourceRepoId = null;
		}
	}

	const slug = slugify(slugInput ?? '') || slugFromRepo(sourceRepo ?? '') || slugify(meta.name);
	if (!slug) throw new HttpError(400, '无法从主题名称生成标识 slug，请填写 slug（仅小写字母、数字、连字符）');

	const repoUrl = meta.repository || (sourceRepo ? `https://github.com/${sourceRepo}` : null);
	const existing = await getThemeBySlug(env.DB, slug);
	if (existing) {
		const owned = existing.author_id === publisher.userId || (publisher.sourceRepoId !== null && existing.source_repo_id === publisher.sourceRepoId);
		if (!owned) throw new HttpError(403, `主题标识 ${slug} 已被其他作者占用`);
		const duplicate = await env.DB.prepare('SELECT id FROM theme_versions WHERE theme_id = ? AND version = ?')
			.bind(existing.id, meta.version)
			.first();
		if (duplicate) throw new HttpError(409, `版本 ${meta.version} 已发布，请更新 theme.toml 中的 version 后重试`);
	} else {
		try {
			await insertTheme(env.DB, {
				slug,
				name: meta.name,
				description: meta.description,
				tags: meta.tags,
				repoUrl,
				sourceRepo,
				sourceRepoId,
				authorId: publisher.userId,
				latestVersion: meta.version,
				publishSource: publisher.publishSource,
			});
		} catch (error) {
			if (isUniqueError(error)) throw new HttpError(409, `主题标识 ${slug} 已存在`);
			throw error;
		}
	}

	const current = await getThemeBySlug(env.DB, slug);
	if (!current) throw new HttpError(500, '主题写入失败，请稍后重试');

	const zipKey = `themes/${slug}/${meta.version}/theme.zip`;
	const screenshotKey = screenshot ? `themes/${slug}/${meta.version}/screenshot.${screenshot.path.split('.').pop()!.toLowerCase()}` : null;
	await env.THEMES_BUCKET.put(zipKey, zip, { httpMetadata: { contentType: 'application/zip' } });
	if (screenshot && screenshotKey) {
		await env.THEMES_BUCKET.put(screenshotKey, screenshot.data, {
			httpMetadata: { contentType: screenshotMime(screenshot.path) ?? 'application/octet-stream' },
		});
	}

	try {
		await insertVersion(env.DB, { themeId: current.id, version: meta.version, r2Key: zipKey, screenshotKey, size: zip.byteLength });
	} catch (error) {
		if (isUniqueError(error)) throw new HttpError(409, `版本 ${meta.version} 已发布，请更新 theme.toml 中的 version 后重试`);
		throw error;
	}
	await updateThemeOnPublish(env.DB, current.id, {
		name: meta.name,
		description: meta.description,
		tags: meta.tags,
		repoUrl,
		sourceRepo,
		sourceRepoId,
		latestVersion: meta.version,
	});

	return { slug, name: meta.name, version: meta.version };
}
