<template>
	<div v-if="!loaded" class="loading">{{ t('common.loading') }}</div>
	<div v-else-if="!me" class="empty">
		<p>{{ t('dashboard.loginRequired') }}</p>
		<button class="btn" type="button" @click="login">{{ t('dashboard.loginAction') }}</button>
	</div>
	<template v-else>
		<header class="page-header">
			<h1>{{ t('dashboard.title') }}</h1>
			<RouterLink class="btn" to="/submit">{{ t('dashboard.publishNew') }}</RouterLink>
		</header>

		<div v-if="me.is_admin" class="scope-tabs">
			<button type="button" class="chip" :class="{ active: scope === 'mine' }" @click="switchScope('mine')">{{ t('dashboard.scopeMine') }}</button>
			<button type="button" class="chip" :class="{ active: scope === 'all' }" @click="switchScope('all')">{{ t('dashboard.scopeAll') }}</button>
		</div>

		<p v-if="errorMsg" class="error-banner">{{ errorMsg }}</p>
		<div v-if="loading" class="loading">{{ t('common.loading') }}</div>
		<div v-else-if="!themes.length" class="empty">
			<p>{{ scope === 'all' ? t('dashboard.emptyAll') : t('dashboard.empty') }}</p>
			<RouterLink v-if="scope === 'mine'" class="btn" to="/submit">{{ t('dashboard.publishFirst') }}</RouterLink>
		</div>
		<div v-else class="theme-list">
			<article v-for="theme in themes" :key="theme.slug" class="theme-row">
				<div class="info">
					<RouterLink :to="`/themes/${theme.slug}`" class="name">{{ theme.name }}</RouterLink>
					<div class="sub">
						<span v-if="scope === 'all'" class="author">
							<img v-if="theme.author.avatar_url" :src="theme.author.avatar_url" alt="" />
							{{ theme.author.login }}
						</span>
						<span>v{{ theme.version }}</span>
						<span>{{ t('common.downloadCount', { count: theme.downloads }) }}</span>
						<span>{{ t('common.versionCount', { count: theme.version_count }) }}</span>
						<span class="badge" :class="theme.status">{{ theme.status === 'published' ? t('dashboard.published') : t('dashboard.hidden') }}</span>
					</div>
				</div>
				<div class="row-actions">
					<RouterLink v-if="scope === 'mine'" class="btn btn-ghost" :to="`/submit/${theme.slug}`">{{ t('dashboard.publishNewVersion') }}</RouterLink>
					<button class="btn btn-ghost" type="button" :disabled="busy === theme.slug" @click="toggleStatus(theme)">
						{{ theme.status === 'published' ? t('dashboard.hide') : t('dashboard.restore') }}
					</button>
					<button class="btn btn-danger" type="button" :disabled="busy === theme.slug" @click="remove(theme)">{{ t('dashboard.delete') }}</button>
				</div>
			</article>
		</div>
	</template>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, type ThemeSummary } from '@/api';
import { useAuth } from '@/composables/useAuth';

const { t } = useI18n();
const { me, loaded, loadMe, login } = useAuth();

const themes = ref<ThemeSummary[]>([]);
const loading = ref(false);
const errorMsg = ref('');
const busy = ref('');
const scope = ref<'mine' | 'all'>('mine');

async function loadThemes(): Promise<void> {
	loading.value = true;
	errorMsg.value = '';
	try {
		themes.value = (scope.value === 'all' ? await api.allThemes() : await api.myThemes()).themes;
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : t('dashboard.loadFailed');
	} finally {
		loading.value = false;
	}
}

function switchScope(newScope: 'mine' | 'all') {
	scope.value = newScope;
	void loadThemes();
}

async function toggleStatus(theme: ThemeSummary): Promise<void> {
	busy.value = theme.slug;
	errorMsg.value = '';
	try {
		await api.setStatus(theme.slug, theme.status === 'published' ? 'hidden' : 'published');
		await loadThemes();
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : t('dashboard.operationFailed');
	} finally {
		busy.value = '';
	}
}

async function remove(theme: ThemeSummary): Promise<void> {
	if (!window.confirm(t('dashboard.confirmDelete', { name: theme.name }))) return;
	busy.value = theme.slug;
	errorMsg.value = '';
	try {
		await api.deleteTheme(theme.slug);
		await loadThemes();
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : t('dashboard.deleteFailed');
	} finally {
		busy.value = '';
	}
}

onMounted(async () => {
	await loadMe();
	if (me.value) await loadThemes();
});
</script>

<style scoped>
.page-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 32px 0 24px;
}

.page-header h1 {
	margin: 0;
	font-size: 26px;
}

.scope-tabs {
	display: flex;
	gap: 8px;
	margin-bottom: 20px;
}

.theme-list {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-bottom: 48px;
}

.theme-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	border-radius: 12px;
	padding: 14px 18px;
	flex-wrap: wrap;
}

.name {
	font-size: 16px;
	font-weight: 600;
	color: var(--text);
	text-decoration: none;
}

.name:hover {
	color: var(--accent);
}

.sub {
	display: flex;
	gap: 14px;
	color: var(--text-faint);
	font-size: 12px;
	margin-top: 6px;
	align-items: center;
}

.author {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.author img {
	width: 18px;
	height: 18px;
	border-radius: 50%;
}

.badge {
	padding: 2px 8px;
	border-radius: 999px;
	border: 1px solid var(--border);
}

.badge.published {
	color: var(--ok);
	border-color: color-mix(in srgb, var(--ok) 40%, transparent);
}

.badge.hidden {
	color: var(--warn);
	border-color: color-mix(in srgb, var(--warn) 40%, transparent);
}

.row-actions {
	display: flex;
	gap: 8px;
}
</style>
