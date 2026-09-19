import { handleAuthCallback, handleAuthStart, handleLogout } from './auth';
import { error, HttpError } from './http';
import {
	actionsPublishHandler,
	createThemeHandler,
	deleteThemeHandler,
	downloadHandler,
	getScreenshotHandler,
	getThemeHandler,
	listTagsHandler,
	listThemesHandler,
	meHandler,
	myThemesHandler,
	patchThemeHandler,
	type Ctx,
} from './themes';

interface Route {
	method: string;
	pattern: URLPattern;
	handler: (ctx: Ctx) => Promise<Response> | Response;
	public?: boolean;
}

const routes: Route[] = [
	{ method: 'GET', pattern: new URLPattern({ pathname: '/api/themes' }), handler: listThemesHandler, public: true },
	{ method: 'GET', pattern: new URLPattern({ pathname: '/api/themes/:slug' }), handler: getThemeHandler, public: true },
	{ method: 'GET', pattern: new URLPattern({ pathname: '/api/themes/:slug/screenshot' }), handler: getScreenshotHandler, public: true },
	{ method: 'GET', pattern: new URLPattern({ pathname: '/api/themes/:slug/download' }), handler: downloadHandler, public: true },
	{ method: 'GET', pattern: new URLPattern({ pathname: '/api/tags' }), handler: listTagsHandler, public: true },
	{ method: 'GET', pattern: new URLPattern({ pathname: '/api/me' }), handler: meHandler },
	{ method: 'GET', pattern: new URLPattern({ pathname: '/api/me/themes' }), handler: myThemesHandler },
	{ method: 'POST', pattern: new URLPattern({ pathname: '/api/themes' }), handler: createThemeHandler },
	{ method: 'PATCH', pattern: new URLPattern({ pathname: '/api/themes/:slug' }), handler: patchThemeHandler },
	{ method: 'DELETE', pattern: new URLPattern({ pathname: '/api/themes/:slug' }), handler: deleteThemeHandler },
	{ method: 'POST', pattern: new URLPattern({ pathname: '/api/actions/publish' }), handler: actionsPublishHandler },
	{ method: 'GET', pattern: new URLPattern({ pathname: '/api/auth/github' }), handler: ({ request, env }) => handleAuthStart(request, env) },
	{ method: 'GET', pattern: new URLPattern({ pathname: '/api/auth/github/callback' }), handler: ({ request, env }) => handleAuthCallback(request, env) },
	{ method: 'POST', pattern: new URLPattern({ pathname: '/api/auth/logout' }), handler: () => handleLogout() },
];

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
			return new Response(null, {
				status: 204,
				headers: {
					'access-control-allow-origin': '*',
					'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
					'access-control-allow-headers': 'content-type, authorization',
					'access-control-max-age': '86400',
				},
			});
		}

		if (!url.pathname.startsWith('/api/')) return new Response('Not Found', { status: 404 });

		try {
			for (const route of routes) {
				if (request.method !== route.method) continue;
				const match = route.pattern.exec(url);
				if (!match) continue;
				const params: Record<string, string> = {};
				for (const [key, value] of Object.entries(match.pathname.groups)) {
					if (value !== undefined) params[key] = value;
				}
				const response = await route.handler({ request, env, url, params });
				if (route.public && !response.headers.has('access-control-allow-origin')) {
					response.headers.set('access-control-allow-origin', '*');
				}
				return response;
			}
			return error(404, '接口不存在');
		} catch (caught) {
			if (caught instanceof HttpError) return error(caught.status, caught.message);
			console.error('unhandled error', caught);
			return error(500, '服务器内部错误');
		}
	},
} satisfies ExportedHandler<Env>;
