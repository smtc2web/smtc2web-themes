import { unzipSync } from 'fflate';
import { parse } from 'smol-toml';

export const MAX_ZIP_BYTES = 20 * 1024 * 1024;
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export class ThemeArchiveError extends Error {}

export interface ThemeMeta {
	name: string;
	version: string;
	author: string;
	description: string;
	repository: string;
	tags: string[];
	screenshot: string;
}

export interface ParsedTheme {
	root: string;
	meta: ThemeMeta;
	screenshot: { path: string; data: Uint8Array } | null;
}

const SCREENSHOT_MIME: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
};

export function screenshotMime(path: string): string | null {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	return SCREENSHOT_MIME[ext] ?? null;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function isSafeRelativePath(path: string): boolean {
	if (!path || path.length > 200) return false;
	if (path.startsWith('/') || path.includes('\\')) return false;
	if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
	return !path.split('/').includes('..');
}

export function parseThemeArchive(zip: Uint8Array): ParsedTheme {
	if (!zip.byteLength) throw new ThemeArchiveError('主题包为空');

	const names: string[] = [];
	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(zip, {
			filter: (file) => {
				names.push(file.name);
				return file.name.endsWith('theme.toml');
			},
		});
	} catch {
		throw new ThemeArchiveError('无法解析 ZIP 文件，请确认上传的是有效的主题压缩包');
	}

	const roots = new Set<string>();
	for (const name of names) {
		const slash = name.indexOf('/');
		roots.add(slash < 0 ? '' : name.slice(0, slash));
	}
	if (roots.size !== 1 || roots.has('')) {
		throw new ThemeArchiveError('主题包必须包含且仅包含一个根文件夹');
	}
	const root = [...roots][0]!;

	const tomlBytes = entries[`${root}/theme.toml`];
	if (!tomlBytes) throw new ThemeArchiveError('根文件夹内缺少 theme.toml 文件');

	let raw: unknown;
	try {
		raw = parse(new TextDecoder().decode(tomlBytes));
	} catch {
		throw new ThemeArchiveError('theme.toml 不是有效的 TOML 文件');
	}
	const section = (raw as { smtc2web?: { theme?: unknown } } | null)?.smtc2web?.theme;
	if (!section || typeof section !== 'object') {
		throw new ThemeArchiveError('theme.toml 缺少 [smtc2web.theme] 配置节');
	}
	const theme = section as Record<string, unknown>;

	const name = text(theme.name);
	const version = text(theme.version);
	if (!name) throw new ThemeArchiveError('theme.toml 缺少 name 字段');
	if (!version) throw new ThemeArchiveError('theme.toml 缺少 version 字段');
	if (name.length > 60) throw new ThemeArchiveError('name 字段过长（最多 60 字符）');
	if (version.length > 32 || !/^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(version)) {
		throw new ThemeArchiveError('version 字段格式不正确（仅允许字母、数字、点、连字符、下划线、加号，最多 32 字符）');
	}

	const tags = Array.isArray(theme.tags)
		? theme.tags
				.filter((tag): tag is string => typeof tag === 'string')
				.map((tag) => tag.trim())
				.filter(Boolean)
				.slice(0, 8)
				.map((tag) => tag.slice(0, 24))
		: [];

	const screenshotField = text(theme.screenshot);
	const screenshotPath = isSafeRelativePath(screenshotField) ? screenshotField : '';

	let screenshot: ParsedTheme['screenshot'] = null;
	if (screenshotPath) {
		const fullPath = `${root}/${screenshotPath}`;
		if (screenshotMime(fullPath)) {
			const extracted = unzipSync(zip, {
				filter: (file) => file.name === fullPath && file.originalSize <= MAX_SCREENSHOT_BYTES,
			})[fullPath];
			if (extracted) screenshot = { path: fullPath, data: extracted };
		}
	}

	const description = text(theme.description).slice(0, 1000);
	const repository = text(theme.repository).slice(0, 300);

	return {
		root,
		meta: {
			name,
			version,
			author: text(theme.author).slice(0, 60),
			description,
			repository: /^https?:\/\//i.test(repository) ? repository : '',
			tags,
			screenshot: screenshotPath,
		},
		screenshot,
	};
}
