import { ref } from 'vue';
import { api, type Me } from '@/api';

const me = ref<Me | null>(null);
const loaded = ref(false);
let pending: Promise<void> | null = null;

async function loadMe(): Promise<void> {
	if (pending) return pending;
	pending = (async () => {
		try {
			me.value = await api.me();
		} catch {
			me.value = null;
		} finally {
			loaded.value = true;
		}
	})();
	return pending;
}

function login(): void {
	window.location.href = '/api/auth/github';
}

async function logout(): Promise<void> {
	await api.logout().catch(() => undefined);
	me.value = null;
}

export function useAuth() {
	return { me, loaded, loadMe, login, logout };
}
