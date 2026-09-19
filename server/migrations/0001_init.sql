CREATE TABLE users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	github_id INTEGER NOT NULL UNIQUE,
	login TEXT NOT NULL,
	name TEXT,
	avatar_url TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE themes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	slug TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	tags TEXT NOT NULL DEFAULT '[]',
	repo_url TEXT,
	source_repo TEXT,
	source_repo_id INTEGER,
	author_id INTEGER NOT NULL REFERENCES users(id),
	latest_version TEXT NOT NULL,
	downloads INTEGER NOT NULL DEFAULT 0,
	status TEXT NOT NULL DEFAULT 'published',
	publish_source TEXT NOT NULL DEFAULT 'web',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE theme_versions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
	version TEXT NOT NULL,
	r2_key TEXT NOT NULL,
	screenshot_key TEXT,
	size INTEGER NOT NULL,
	downloads INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE(theme_id, version)
);

CREATE INDEX idx_themes_status ON themes(status);
CREATE INDEX idx_themes_author ON themes(author_id);
CREATE INDEX idx_versions_theme ON theme_versions(theme_id);
