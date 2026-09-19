<template>
	<div v-if="!loaded" class="loading">加载中…</div>
	<div v-else-if="!me" class="empty">
		<p>请先使用 GitHub 登录后管理你的主题。</p>
		<button class="btn" type="button" @click="login">使用 GitHub 登录</button>
	</div>
	<template v-else>
		<header class="page-header">
			<h1>我的主题</h1>
			<RouterLink class="btn" to="/submit">发布新主题</RouterLink>
		</header>

		<p v-if="errorMsg" class="error-banner">{{ errorMsg }}</p>
		<div v-if="loading" class="loading">加载中…</div>
		<div v-else-if="!themes.length" class="empty">
			<p>你还没有发布过主题。</p>
			<RouterLink class="btn" to="/submit">发布第一个主题</RouterLink>
		</div>
		<div v-else class="theme-list">
			<article v-for="theme in themes" :key="theme.slug" class="theme-row">
				<div class="info">
					<RouterLink :to="`/themes/${theme.slug}`" class="name">{{ theme.name }}</RouterLink>
					<div class="sub">
						<span>v{{ theme.version }}</span>
						<span>{{ theme.downloads }} 次下载</span>
						<span>{{ theme.version_count }} 个版本</span>
						<span class="badge" :class="theme.status">{{ theme.status === 'published' ? '已发布' : '已下架' }}</span>
					</div>
				</div>
				<div class="row-actions">
					<RouterLink class="btn btn-ghost" :to="`/submit/${theme.slug}`">发布新版本</RouterLink>
					<button class="btn btn-ghost" type="button" :disabled="busy === theme.slug" @click="toggleStatus(theme)">
						{{ theme.status === 'published' ? '下架' : '恢复' }}
					</button>
					<button class="btn btn-danger" type="button" :disabled="busy === theme.slug" @click="remove(theme)">删除</button>
				</div>
			</article>
		</div>
	</template>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api, type ThemeSummary } from '@/api';
import { useAuth } from '@/composables/useAuth';

const { me, loaded, loadMe, login } = useAuth();

const themes = ref<ThemeSummary[]>([]);
const loading = ref(false);
const errorMsg = ref('');
const busy = ref('');

async function loadThemes(): Promise<void> {
	loading.value = true;
	errorMsg.value = '';
	try {
		themes.value = (await api.myThemes()).themes;
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : '加载失败';
	} finally {
		loading.value = false;
	}
}

async function toggleStatus(theme: ThemeSummary): Promise<void> {
	busy.value = theme.slug;
	errorMsg.value = '';
	try {
		await api.setStatus(theme.slug, theme.status === 'published' ? 'hidden' : 'published');
		await loadThemes();
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : '操作失败';
	} finally {
		busy.value = '';
	}
}

async function remove(theme: ThemeSummary): Promise<void> {
	if (!window.confirm(`确定要删除主题「${theme.name}」及其全部版本吗？此操作不可撤销。`)) return;
	busy.value = theme.slug;
	errorMsg.value = '';
	try {
		await api.deleteTheme(theme.slug);
		await loadThemes();
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : '删除失败';
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
