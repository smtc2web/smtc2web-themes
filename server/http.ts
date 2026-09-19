export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
	});
}

export function error(status: number, message: string): Response {
	return json({ error: message }, status);
}

export function publicJson(data: unknown, status = 200): Response {
	return json(data, status, { 'access-control-allow-origin': '*' });
}

export function str(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

export function requireStr(value: unknown, name: string, maxLength: number): string {
	const result = str(value);
	if (!result) throw new HttpError(400, `缺少字段 ${name}`);
	if (result.length > maxLength) throw new HttpError(400, `字段 ${name} 过长（最多 ${maxLength} 字符）`);
	return result;
}
