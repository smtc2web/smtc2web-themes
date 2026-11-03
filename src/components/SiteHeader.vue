<template>
	<header class="site-header">
		<div class="site-header-inner">
			<RouterLink to="/" class="brand">
				<img class="brand-icon" src="/app-icon.png" alt="" />
				{{ t('common.siteTitle') }}
			</RouterLink>
			<nav class="nav">
				<RouterLink to="/">{{ t('header.allThemes') }}</RouterLink>
				<RouterLink v-if="me" to="/dashboard">{{ t('header.myThemes') }}</RouterLink>
				<RouterLink v-if="me" to="/submit">{{ t('header.publishTheme') }}</RouterLink>
			</nav>
			<div class="user">
				<LocaleSwitcher />
				<template v-if="me">
					<img v-if="me.avatar_url" class="avatar" :src="me.avatar_url" :alt="me.login" />
					<span class="login">{{ me.login }}</span>
					<span v-if="me.is_admin" class="admin-badge">{{ t('header.admin') }}</span>
					<button class="btn btn-ghost" type="button" @click="logout">{{ t('header.logout') }}</button>
				</template>
				<button v-else-if="loaded" class="btn" type="button" @click="login">
					<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
						<path
							fill="currentColor"
							d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
						/>
					</svg>
					{{ t('header.loginWithGithub') }}
				</button>
			</div>
		</div>
	</header>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuth } from '@/composables/useAuth';
import LocaleSwitcher from '@/components/LocaleSwitcher.vue';

const { t } = useI18n();
const { me, loaded, loadMe, login, logout } = useAuth();

onMounted(loadMe);
</script>

<style scoped>
.site-header {
	position: sticky;
	top: 0;
	z-index: 10;
	background: color-mix(in srgb, var(--bg) 88%, transparent);
	backdrop-filter: blur(8px);
	border-bottom: 1px solid var(--border);
}

.site-header-inner {
	max-width: 1120px;
	margin: 0 auto;
	padding: 12px 20px;
	display: flex;
	align-items: center;
	gap: 24px;
}

.brand {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	font-weight: 700;
	font-size: 16px;
	color: var(--text);
	text-decoration: none;
	white-space: nowrap;
}

.brand-icon {
	width: 22px;
	height: 22px;
	border-radius: 4px;
}

.nav {
	display: flex;
	gap: 18px;
	flex: 1;
}

.nav a {
	color: var(--text-muted);
	text-decoration: none;
	font-size: 14px;
}

.nav a:hover,
.nav a.router-link-active {
	color: var(--text);
}

.user {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-left: auto;
}

.avatar {
	width: 26px;
	height: 26px;
	border-radius: 50%;
}

.login {
	font-size: 14px;
	color: var(--text-muted);
}

.admin-badge {
	font-size: 11px;
	font-weight: 600;
	padding: 2px 8px;
	border-radius: 999px;
	color: var(--accent);
	border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
	background: color-mix(in srgb, var(--accent) 12%, transparent);
	white-space: nowrap;
}

.icon {
	flex: none;
}
</style>
