<template>
	<SiteHeader />
	<main class="page">
		<RouterView />
	</main>
	<footer class="site-footer">
		<span>smtc2web 主题商店 · </span>
		<a href="https://smtc2web.org" target="_blank" rel="noopener">smtc2web.org</a>
		<span> · </span>
		<a href="https://github.com/smtc2web" target="_blank" rel="noopener">GitHub</a>
	</footer>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import SiteHeader from '@/components/SiteHeader.vue';
</script>
