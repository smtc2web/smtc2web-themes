export interface UserRow {
	id: number;
	github_id: number;
	login: string;
	name: string | null;
	avatar_url: string | null;
	created_at: string;
}

export interface ThemeRow {
	id: number;
	slug: string;
	name: string;
	description: string;
	tags: string;
	repo_url: string | null;
	source_repo: string | null;
	source_repo_id: number | null;
	author_id: number;
	latest_version: string;
	downloads: number;
	status: string;
	publish_source: string;
	created_at: string;
	updated_at: string;
}

export interface ThemeListRow extends ThemeRow {
	author_login: string;
	author_avatar_url: string | null;
	version_count: number;
}

export interface VersionRow {
	id: number;
	theme_id: number;
	version: string;
	r2_key: string;
	screenshot_key: string | null;
	size: number;
	downloads: number;
	created_at: string;
}

const THEME_SELECT = `
	SELECT t.*, u.login AS author_login, u.avatar_url AS author_avatar_url,
		(SELECT COUNT(*) FROM theme_versions v WHERE v.theme_id = t.id) AS version_count
	FROM themes t JOIN users u ON u.id = t.author_id
`;

export async function upsertUser(
	db: D1Database,
	user: { githubId: number; login: string; name?: string | null; avatarUrl?: string | null },
): Promise<UserRow> {
	await db
		.prepare(
			`INSERT INTO users (github_id, login, name, avatar_url) VALUES (?, ?, ?, ?)
			 ON CONFLICT(github_id) DO UPDATE SET login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url`,
		)
		.bind(user.githubId, user.login, user.name ?? null, user.avatarUrl ?? null)
		.run();
	const row = await db.prepare('SELECT * FROM users WHERE github_id = ?').bind(user.githubId).first<UserRow>();
	if (!row) throw new Error('failed to upsert user');
	return row;
}

export function getUserById(db: D1Database, id: number): Promise<UserRow | null> {
	return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export function getThemeBySlug(db: D1Database, slug: string): Promise<ThemeListRow | null> {
	return db.prepare(`${THEME_SELECT} WHERE t.slug = ?`).bind(slug).first<ThemeListRow>();
}

export async function listThemes(
	db: D1Database,
	opts: { q?: string; tag?: string; sort: string; offset: number; limit: number },
): Promise<{ themes: ThemeListRow[]; total: number }> {
	const where = ["t.status = 'published'"];
	const binds: unknown[] = [];
	if (opts.q) {
		where.push('(t.name LIKE ? OR t.description LIKE ? OR u.login LIKE ?)');
		const like = `%${opts.q}%`;
		binds.push(like, like, like);
	}
	if (opts.tag) {
		where.push('EXISTS (SELECT 1 FROM json_each(t.tags) WHERE json_each.value = ?)');
		binds.push(opts.tag);
	}
	const order =
		opts.sort === 'popular'
			? 't.downloads DESC, t.updated_at DESC'
			: opts.sort === 'name'
				? 't.name COLLATE NOCASE ASC'
				: 't.updated_at DESC';
	const rows = await db
		.prepare(`${THEME_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`)
		.bind(...binds, opts.limit, opts.offset)
		.all<ThemeListRow>();
	const total = await db
		.prepare(`SELECT COUNT(*) AS total FROM themes t JOIN users u ON u.id = t.author_id WHERE ${where.join(' AND ')}`)
		.bind(...binds)
		.first<{ total: number }>();
	return { themes: rows.results ?? [], total: total?.total ?? 0 };
}

export async function listOwnerThemes(db: D1Database, authorId: number): Promise<ThemeListRow[]> {
	const rows = await db.prepare(`${THEME_SELECT} WHERE t.author_id = ? ORDER BY t.updated_at DESC`).bind(authorId).all<ThemeListRow>();
	return rows.results ?? [];
}

export function listPublishedThemeUrls(db: D1Database): Promise<Array<{ slug: string; updated_at: string }>> {
	return db
		.prepare("SELECT slug, updated_at FROM themes WHERE status = 'published' ORDER BY updated_at DESC")
		.all<{ slug: string; updated_at: string }>()
		.then((rows) => rows.results ?? []);
}

export async function listTags(db: D1Database): Promise<Array<{ tag: string; count: number }>> {
	const rows = await db
		.prepare(
			`SELECT j.value AS tag, COUNT(*) AS count FROM themes t, json_each(t.tags) j
			 WHERE t.status = 'published' GROUP BY j.value ORDER BY count DESC, tag ASC LIMIT 50`,
		)
		.all<{ tag: string; count: number }>();
	return rows.results ?? [];
}

export async function listVersions(db: D1Database, themeId: number): Promise<VersionRow[]> {
	const rows = await db
		.prepare('SELECT * FROM theme_versions WHERE theme_id = ? ORDER BY created_at DESC, id DESC')
		.bind(themeId)
		.all<VersionRow>();
	return rows.results ?? [];
}

export function getVersion(db: D1Database, themeId: number, version: string): Promise<VersionRow | null> {
	return db.prepare('SELECT * FROM theme_versions WHERE theme_id = ? AND version = ?').bind(themeId, version).first<VersionRow>();
}

export function getLatestVersion(db: D1Database, theme: ThemeRow): Promise<VersionRow | null> {
	return getVersion(db, theme.id, theme.latest_version);
}

export async function insertTheme(
	db: D1Database,
	theme: {
		slug: string;
		name: string;
		description: string;
		tags: string[];
		repoUrl: string | null;
		sourceRepo: string | null;
		sourceRepoId: number | null;
		authorId: number;
		latestVersion: string;
		publishSource: string;
	},
): Promise<number> {
	const result = await db
		.prepare(
			`INSERT INTO themes (slug, name, description, tags, repo_url, source_repo, source_repo_id, author_id, latest_version, publish_source)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			theme.slug,
			theme.name,
			theme.description,
			JSON.stringify(theme.tags),
			theme.repoUrl,
			theme.sourceRepo,
			theme.sourceRepoId,
			theme.authorId,
			theme.latestVersion,
			theme.publishSource,
		)
		.run();
	return Number(result.meta.last_row_id);
}

export async function updateThemeOnPublish(
	db: D1Database,
	themeId: number,
	theme: { name: string; description: string; tags: string[]; repoUrl: string | null; sourceRepo: string | null; sourceRepoId: number | null; latestVersion: string },
): Promise<void> {
	await db
		.prepare(
			`UPDATE themes SET name = ?, description = ?, tags = ?, repo_url = ?,
			 source_repo = COALESCE(?, source_repo), source_repo_id = COALESCE(?, source_repo_id),
			 latest_version = ?, updated_at = datetime('now') WHERE id = ?`,
		)
		.bind(theme.name, theme.description, JSON.stringify(theme.tags), theme.repoUrl, theme.sourceRepo, theme.sourceRepoId, theme.latestVersion, themeId)
		.run();
}

export async function insertVersion(
	db: D1Database,
	version: { themeId: number; version: string; r2Key: string; screenshotKey: string | null; size: number },
): Promise<void> {
	await db
		.prepare('INSERT INTO theme_versions (theme_id, version, r2_key, screenshot_key, size) VALUES (?, ?, ?, ?, ?)')
		.bind(version.themeId, version.version, version.r2Key, version.screenshotKey, version.size)
		.run();
}

export async function recordDownload(db: D1Database, themeId: number, versionId: number): Promise<void> {
	await db.batch([
		db.prepare('UPDATE themes SET downloads = downloads + 1 WHERE id = ?').bind(themeId),
		db.prepare('UPDATE theme_versions SET downloads = downloads + 1 WHERE id = ?').bind(versionId),
	]);
}

export async function setThemeStatus(db: D1Database, themeId: number, status: string): Promise<void> {
	await db.prepare("UPDATE themes SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, themeId).run();
}

export async function deleteTheme(db: D1Database, themeId: number): Promise<void> {
	await db.batch([
		db.prepare('DELETE FROM theme_versions WHERE theme_id = ?').bind(themeId),
		db.prepare('DELETE FROM themes WHERE id = ?').bind(themeId),
	]);
}
