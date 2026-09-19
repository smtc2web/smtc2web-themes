<template>
	<RouterLink class="card" :to="`/themes/${theme.slug}`">
		<div class="thumb">
			<img v-if="!broken" :src="theme.screenshot_url" :alt="theme.name" loading="lazy" @error="broken = true" />
			<div v-else class="no-preview">暂无预览图</div>
		</div>
		<div class="body">
			<div class="title-row">
				<h3>{{ theme.name }}</h3>
				<span class="version">v{{ theme.version }}</span>
			</div>
			<p class="desc">{{ theme.description || '这个主题还没有描述' }}</p>
			<div class="meta">
				<span class="author">
					<img v-if="theme.author.avatar_url" :src="theme.author.avatar_url" alt="" />
					{{ theme.author.login }}
				</span>
				<span>{{ theme.downloads }} 次下载</span>
			</div>
			<div v-if="theme.tags.length" class="tags">
				<span v-for="tag in theme.tags" :key="tag" class="tag">{{ tag }}</span>
			</div>
		</div>
	</RouterLink>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ThemeSummary } from '@/api';

defineProps<{ theme: ThemeSummary }>();

const broken = ref(false);
</script>

<style scoped>
.card {
	display: flex;
	flex-direction: column;
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	border-radius: 14px;
	overflow: hidden;
	text-decoration: none;
	color: var(--text);
	transition:
		transform 0.15s ease,
		border-color 0.15s ease;
}

.card:hover {
	transform: translateY(-2px);
	border-color: var(--accent);
}

.thumb {
	aspect-ratio: 16 / 9;
	background: var(--bg-inset);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.thumb img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.no-preview {
	color: var(--text-faint);
	font-size: 13px;
}

.body {
	padding: 14px 16px 16px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.title-row {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
}

h3 {
	margin: 0;
	font-size: 16px;
}

.version {
	font-size: 12px;
	color: var(--text-faint);
}

.desc {
	margin: 0;
	font-size: 13px;
	color: var(--text-muted);
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	min-height: 36px;
}

.meta {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 12px;
	color: var(--text-faint);
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

.tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.tag {
	font-size: 11px;
	padding: 2px 8px;
	border-radius: 999px;
	background: var(--bg-inset);
	color: var(--text-muted);
	border: 1px solid var(--border);
}
</style>
