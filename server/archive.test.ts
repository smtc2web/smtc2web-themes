import assert from 'node:assert/strict';
import { test } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { parseThemeArchive, ThemeArchiveError } from './archive.ts';

const TOML = `[smtc2web.theme]
name = "demo"
version = "1.2.3"
author = "tester"
description = "demo theme"
tags = ["vue", "dark"]
screenshot = "screenshot.png"
`;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function archive(files: Record<string, Uint8Array>): Uint8Array {
	return zipSync(files);
}

test('parses a valid theme archive', () => {
	const parsed = parseThemeArchive(
		archive({
			'demo/theme.toml': strToU8(TOML),
			'demo/index.html': strToU8('<html></html>'),
			'demo/screenshot.png': PNG,
		}),
	);
	assert.equal(parsed.root, 'demo');
	assert.equal(parsed.meta.name, 'demo');
	assert.equal(parsed.meta.version, '1.2.3');
	assert.equal(parsed.meta.author, 'tester');
	assert.deepEqual(parsed.meta.tags, ['vue', 'dark']);
	assert.equal(parsed.screenshot?.path, 'demo/screenshot.png');
});

test('rejects an archive without a single root folder', () => {
	assert.throws(
		() => parseThemeArchive(archive({ 'theme.toml': strToU8(TOML) })),
		(e: unknown) => e instanceof ThemeArchiveError && /根文件夹/.test(e.message),
	);
	assert.throws(
		() =>
			parseThemeArchive(
				archive({ 'a/theme.toml': strToU8(TOML), 'b/theme.toml': strToU8(TOML) }),
			),
		(e: unknown) => e instanceof ThemeArchiveError && /根文件夹/.test(e.message),
	);
});

test('rejects an archive without theme.toml', () => {
	assert.throws(
		() => parseThemeArchive(archive({ 'demo/index.html': strToU8('<html></html>') })),
		(e: unknown) => e instanceof ThemeArchiveError && /theme\.toml/.test(e.message),
	);
});

test('rejects theme.toml without the smtc2web.theme section', () => {
	assert.throws(
		() => parseThemeArchive(archive({ 'demo/theme.toml': strToU8('name = "demo"') })),
		(e: unknown) => e instanceof ThemeArchiveError && /smtc2web\.theme/.test(e.message),
	);
});

test('rejects missing name or version', () => {
	assert.throws(
		() => parseThemeArchive(archive({ 'demo/theme.toml': strToU8('[smtc2web.theme]\nname = "demo"') })),
		(e: unknown) => e instanceof ThemeArchiveError && /version/.test(e.message),
	);
});

test('ignores an unsafe screenshot path', () => {
	const parsed = parseThemeArchive(
		archive({
			'demo/theme.toml': strToU8(TOML.replace('screenshot.png', '../../secret.png')),
			'demo/index.html': strToU8('<html></html>'),
		}),
	);
	assert.equal(parsed.screenshot, null);
});

test('returns null screenshot when the file is missing', () => {
	const parsed = parseThemeArchive(archive({ 'demo/theme.toml': strToU8(TOML), 'demo/index.html': strToU8('<html></html>') }));
	assert.equal(parsed.screenshot, null);
});
