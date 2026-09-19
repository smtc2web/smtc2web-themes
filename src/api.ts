export interface ThemeAuthor {
	login: string;
	avatar_url: string | null;
}

export interface ThemeSummary {
	slug: string;
	name: string;
	description: string;
	tags: string[];
	author: ThemeAuthor;
	version: string;
	version_count: number;
	downloads: number;
	repo_url: string | null;
	source_repo: string | null;
	published_via: 'web' | 'actions';
	status?: 'published' | 'hidden';
	screenshot_url: string;
	download_url: string;
	page_url: string;
	created_at: string;
	updated_at: string;
}

export interface ThemeVersion {
	version: string;
	size: number;
	downloads: number;
	has_screenshot: boolean;
	created_at: string;
	download_url: string;
}

export interface ThemeList {
	themes: ThemeSummary[];
	total: number;
	page: number;
	page_size: number;
	total_pages: number;
}

export interface ThemeDetail {
	theme: ThemeSummary;
	versions: ThemeVersion[];
}

export interface Me {
	login: string;
	name: string | null;
	avatar_url: string | null;
	is_admin: boolean;
}

export interface PublishResult {
	ok: true;
	slug: string;
	name: string;
	version: string;
	page_url: string;
	download_url: string;
}

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, init);
	const data = (await response.json().catch(() => null)) as { error?: string } | null;
	if (!response.ok) throw new ApiError(response.status, data?.error ?? `请求失败（${response.status}）`);
	return data as T;
}

export const api = {
	listThemes(params: { q?: string; tag?: string; sort?: string; page?: number }): Promise<ThemeList> {
		const query = new URLSearchParams();
		if (params.q) query.set('q', params.q);
		if (params.tag) query.set('tag', params.tag);
		if (params.sort && params.sort !== 'newest') query.set('sort', params.sort);
		if (params.page && params.page > 1) query.set('page', String(params.page));
		const suffix = query.size ? `?${query}` : '';
		return request<ThemeList>(`/api/themes${suffix}`);
	},
	getTheme(slug: string): Promise<ThemeDetail> {
		return request<ThemeDetail>(`/api/themes/${encodeURIComponent(slug)}`);
	},
	listTags(): Promise<{ tags: Array<{ tag: string; count: number }> }> {
		return request('/api/tags');
	},
	async me(): Promise<Me | null> {
		try {
			const data = await request<{ user: Me }>('/api/me');
			return data.user;
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) return null;
			throw error;
		}
	},
	myThemes(): Promise<{ themes: ThemeSummary[] }> {
		return request('/api/me/themes');
	},
	publishTheme(file: File, slug?: string): Promise<PublishResult> {
		const form = new FormData();
		form.append('file', file);
		if (slug) form.append('slug', slug);
		return request<PublishResult>('/api/themes', { method: 'POST', body: form });
	},
	setStatus(slug: string, status: 'published' | 'hidden'): Promise<{ theme: ThemeSummary }> {
		return request(`/api/themes/${encodeURIComponent(slug)}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status }),
		});
	},
	deleteTheme(slug: string): Promise<{ ok: true }> {
		return request(`/api/themes/${encodeURIComponent(slug)}`, { method: 'DELETE' });
	},
	logout(): Promise<{ ok: true }> {
		return request('/api/auth/logout', { method: 'POST' });
	},
};
