<template>
	<div v-if="!loaded" class="loading">加载中…</div>
	<div v-else-if="!me" class="empty">
		<p>请先使用 GitHub 登录后发布主题。</p>
		<button class="btn" type="button" @click="login">使用 GitHub 登录</button>
	</div>
	<template v-else>
		<RouterLink to="/dashboard" class="back">← 返回我的主题</RouterLink>
		<h1>{{ slug ? `为 ${slug} 发布新版本` : '发布主题' }}</h1>
		<p class="intro">
			选择一个符合 smtc2web 主题规范（根文件夹内包含 <code>theme.toml</code> 且带 <code>[smtc2web.theme]</code> 配置节）的 ZIP 文件。
			主题名称、版本、描述、标签和截图会从 <code>theme.toml</code> 自动读取。
		</p>

		<form class="upload-form" @submit.prevent="submit">
			<label class="file-picker">
				<input type="file" accept=".zip,application/zip" @change="onFileChange" />
				<span v-if="file">{{ file.name }}（{{ formatSize(file.size) }}）</span>
				<span v-else>点击选择主题 ZIP 文件</span>
			</label>
			<label v-if="!slug" class="field">
				<span>主题标识 slug（可选）</span>
				<input v-model="slugInput" placeholder="例如 my-theme，仅小写字母、数字和连字符" />
			</label>
			<button class="btn btn-lg" type="submit" :disabled="!file || busy">
				{{ busy ? '上传中…' : '上传并发布' }}
			</button>
		</form>

		<p v-if="errorMsg" class="error-banner">{{ errorMsg }}</p>
		<p class="hint">
			推荐使用自动发布：在主题仓库中接入
			<a href="https://github.com/smtc2web/theme-upload" target="_blank" rel="noopener">smtc2web/theme-upload</a>
			工作流后，推送 <code>v*</code> tag 即可自动更新商店。
		</p>
	</template>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { useAuth } from '@/composables/useAuth';

const route = useRoute();
const router = useRouter();
const { me, loaded, loadMe, login } = useAuth();

const slug = typeof route.params.slug === 'string' ? route.params.slug : '';
const file = ref<File | null>(null);
const slugInput = ref('');
const busy = ref(false);
const errorMsg = ref('');

function onFileChange(event: Event): void {
	file.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

function formatSize(bytes: number): string {
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function submit(): Promise<void> {
	if (!file.value) return;
	if (file.value.size > 20 * 1024 * 1024) {
		errorMsg.value = '主题包大小不能超过 20MB';
		return;
	}
	busy.value = true;
	errorMsg.value = '';
	try {
		const result = await api.publishTheme(file.value, slug || slugInput.value.trim() || undefined);
		await router.push(`/themes/${result.slug}`);
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : '上传失败';
	} finally {
		busy.value = false;
	}
}

onMounted(loadMe);
</script>

<style scoped>
.back {
	display: inline-block;
	margin: 24px 0 12px;
	color: var(--text-muted);
	text-decoration: none;
	font-size: 14px;
}

h1 {
	font-size: 26px;
	margin: 0 0 12px;
}

.intro {
	color: var(--text-muted);
	max-width: 640px;
	line-height: 1.7;
	font-size: 14px;
}

code {
	background: var(--bg-inset);
	border: 1px solid var(--border);
	border-radius: 4px;
	padding: 1px 5px;
	font-size: 12px;
}

.upload-form {
	display: flex;
	flex-direction: column;
	gap: 16px;
	max-width: 520px;
	margin: 24px 0 16px;
}

.file-picker {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 84px;
	padding: 16px;
	border: 1px dashed var(--border-strong);
	border-radius: 12px;
	background: var(--bg-elevated);
	cursor: pointer;
	color: var(--text-muted);
	font-size: 14px;
}

.file-picker input {
	display: none;
}

.field {
	display: flex;
	flex-direction: column;
	gap: 6px;
	font-size: 13px;
	color: var(--text-muted);
}

.hint {
	color: var(--text-faint);
	font-size: 13px;
	max-width: 640px;
	line-height: 1.7;
}

.hint a {
	color: var(--accent);
}
</style>
