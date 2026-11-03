<template>
	<div v-if="loading" class="loading">{{ t('common.loading') }}</div>
	<div v-else-if="errorMsg" class="empty">
		<p>{{ errorMsg }}</p>
		<RouterLink class="btn" to="/">{{ t('detail.backToCatalog') }}</RouterLink>
	</div>
	<template v-else-if="data">
		<RouterLink to="/" class="back">← {{ t('detail.backToCatalog') }}</RouterLink>

		<header class="detail-header">
			<div>
				<h1>{{ data.theme.name }}</h1>
				<div class="meta">
					<span class="author">
						<img v-if="data.theme.author.avatar_url" :src="data.theme.author.avatar_url" alt="" />
						{{ data.theme.author.login }}
					</span>
					<span>v{{ data.theme.version }}</span>
					<span>{{ t('common.downloadCount', { count: data.theme.downloads }) }}</span>
					<span>{{ t('detail.updated', { date: formatDate(data.theme.updated_at) }) }}</span>
				</div>
				<div v-if="data.theme.tags.length" class="tags">
					<RouterLink v-for="tag in data.theme.tags" :key="tag" class="tag" :to="`/?tag=${encodeURIComponent(tag)}`">
						{{ tag }}
					</RouterLink>
				</div>
			</div>
			<div class="actions">
				<a class="btn btn-lg" :href="data.theme.download_url">{{ t('detail.downloadZip') }}</a>
				<a v-if="gitUrl" class="btn btn-ghost" :href="gitUrl" target="_blank" rel="noopener">{{ t('detail.viewSource') }}</a>
			</div>
		</header>

		<div class="preview">
			<img v-if="!broken" :src="data.theme.screenshot_url" :alt="data.theme.name" @error="broken = true" />
			<div v-else class="no-preview">{{ t('detail.noScreenshot') }}</div>
		</div>

		<div class="columns">
			<section class="panel">
				<h2>{{ t('detail.about') }}</h2>
				<p class="description">{{ data.theme.description || t('detail.noDescription') }}</p>

				<h2>{{ t('detail.installTitle') }}</h2>
				<ol class="install">
					<li>{{ t('detail.installStep1') }}</li>
					<li>{{ t('detail.installStep2') }}</li>
					<li v-if="gitUrl">{{ t('detail.installStep3') }}</li>
				</ol>
			</section>

			<section class="panel">
				<h2>{{ t('detail.versionHistory') }}</h2>
				<table class="versions">
					<thead>
						<tr>
							<th>{{ t('detail.colVersion') }}</th>
							<th>{{ t('detail.colSize') }}</th>
							<th>{{ t('detail.colDownloads') }}</th>
							<th>{{ t('detail.colPublishedAt') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="version in data.versions" :key="version.version">
							<td>v{{ version.version }}</td>
							<td>{{ formatSize(version.size) }}</td>
							<td>{{ version.downloads }}</td>
							<td>{{ formatDate(version.created_at) }}</td>
						</tr>
					</tbody>
				</table>
				<p class="hint">
					{{ data.theme.published_via === 'actions' ? t('detail.publishedViaActions') : t('detail.publishedViaWeb') }}
					<span v-if="data.theme.source_repo"> · {{ t('detail.sourceRepo') }} {{ data.theme.source_repo }}</span>
				</p>
			</section>
		</div>
	</template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api, type ThemeDetail } from '@/api';

const { t } = useI18n();
const route = useRoute();
const data = ref<ThemeDetail | null>(null);
const loading = ref(true);
const errorMsg = ref('');
const broken = ref(false);

const gitUrl = computed(() => data.value?.theme.source_repo ? `https://github.com/${data.value.theme.source_repo}` : data.value?.theme.repo_url);

function formatDate(value: string): string {
	return value.replace('T', ' ').replace('Z', '').slice(0, 16);
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

onMounted(async () => {
	try {
		data.value = await api.getTheme(String(route.params.slug));
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : t('detail.loadFailed');
	} finally {
		loading.value = false;
	}
});
</script>

<style scoped>
.back {
	display: inline-block;
	margin: 24px 0 16px;
	color: var(--text-muted);
	text-decoration: none;
	font-size: 14px;
}

.back:hover {
	color: var(--text);
}

.detail-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 24px;
	flex-wrap: wrap;
}

.detail-header h1 {
	margin: 0 0 10px;
	font-size: 28px;
}

.meta {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	color: var(--text-muted);
	font-size: 13px;
	align-items: center;
}

.author {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.author img {
	width: 20px;
	height: 20px;
	border-radius: 50%;
}

.tags {
	display: flex;
	gap: 6px;
	margin-top: 10px;
	flex-wrap: wrap;
}

.tag {
	font-size: 12px;
	padding: 3px 10px;
	border-radius: 999px;
	background: var(--bg-inset);
	border: 1px solid var(--border);
	color: var(--text-muted);
	text-decoration: none;
}

.actions {
	display: flex;
	gap: 10px;
}

.preview {
	margin: 24px 0;
	border: 1px solid var(--border);
	border-radius: 14px;
	overflow: hidden;
	background: var(--bg-inset);
}

.preview img {
	display: block;
	width: 100%;
}

.no-preview {
	padding: 80px 0;
	text-align: center;
	color: var(--text-faint);
}

.columns {
	display: grid;
	grid-template-columns: 1.2fr 1fr;
	gap: 24px;
	margin-bottom: 48px;
}

@media (max-width: 800px) {
	.columns {
		grid-template-columns: 1fr;
	}
}

.panel {
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	border-radius: 14px;
	padding: 20px;
}

.panel h2 {
	font-size: 15px;
	margin: 0 0 10px;
}

.panel h2:not(:first-child) {
	margin-top: 24px;
}

.description {
	white-space: pre-line;
	color: var(--text-muted);
	line-height: 1.7;
	margin: 0;
}

.install {
	margin: 0;
	padding-left: 20px;
	color: var(--text-muted);
	line-height: 1.9;
	font-size: 14px;
}

.versions {
	width: 100%;
	border-collapse: collapse;
	font-size: 13px;
}

.versions th,
.versions td {
	text-align: left;
	padding: 8px 6px;
	border-bottom: 1px solid var(--border);
}

.versions th {
	color: var(--text-faint);
	font-weight: 500;
}

.hint {
	color: var(--text-faint);
	font-size: 12px;
	margin: 14px 0 0;
}
</style>
