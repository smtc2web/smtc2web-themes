<template>
	<select class="locale-select" :value="locale" @change="onChange">
		<option v-for="item in LOCALES" :key="item.code" :value="item.code">{{ item.label }}</option>
	</select>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { LOCALES, type LocaleCode } from '@/i18n';
import { useLocale } from '@/composables/useLocale';

const { locale } = useI18n();
const { setLocale } = useLocale();

function onChange(event: Event) {
	setLocale((event.target as HTMLSelectElement).value as LocaleCode);
}
</script>

<style scoped>
.locale-select {
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	border-radius: 8px;
	color: var(--text-muted);
	padding: 4px 8px;
	font-size: 12px;
	cursor: pointer;
	outline: none;
}

.locale-select:focus {
	border-color: var(--accent);
}
</style>
