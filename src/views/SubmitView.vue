<template>
	<div v-if="!loaded" class="loading">{{ t('common.loading') }}</div>
	<div v-else-if="!me" class="empty">
		<p>{{ t('submit.loginRequired') }}</p>
		<button class="btn" type="button" @click="login">{{ t('submit.loginAction') }}</button>
	</div>
	<template v-else>
		<RouterLink to="/dashboard" class="back">{{ t('submit.backToDashboard') }}</RouterLink>
		<h1>{{ slug ? t('submit.newVersionTitle', { slug }) : t('submit.title') }}</h1>
		<p class="intro">
			{{ t('submit.intro') }}
		</p>

		<form class="upload-form" @submit.prevent="submit">
			<label class="file-picker">
				<input type="file" accept=".zip,application/zip" @change="onFileChange" />
				<span v-if="file">{{ file.name }}（{{ formatSize(file.size) }}）</span>
				<span v-else>{{ t('submit.selectFile') }}</span>
			</label>
			<label v-if="!slug" class="field">
				<span>{{ t('submit.slugLabel') }}</span>
				<input v-model="slugInput" :placeholder="t('submit.slugPlaceholder')" />
			</label>
			<button class="btn btn-lg" type="submit" :disabled="!file || busy">
				{{ busy ? t('submit.uploading') : t('submit.uploadAndPublish') }}
			</button>
		</form>

		<p v-if="errorMsg" class="error-banner">{{ errorMsg }}</p>
		<p class="hint">
			{{ t('submit.hint') }}
		</p>
	</template>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import { useAuth } from '@/composables/useAuth';

const { t } = useI18n();
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
		errorMsg.value = t('submit.sizeLimit');
		return;
	}
	busy.value = true;
	errorMsg.value = '';
	try {
		const result = await api.publishTheme(file.value, slug || slugInput.value.trim() || undefined);
		await router.push(`/themes/${result.slug}`);
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : t('submit.uploadFailed');
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
