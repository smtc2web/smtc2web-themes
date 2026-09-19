<template>
	<section class="hero">
		<h1>为你的直播挑选一款主题</h1>
		<p>浏览社区制作的 smtc2web 主题，一键下载后在应用内导入。登录 GitHub 即可发布你自己的主题。</p>
		<p v-if="authErrorMessage" class="error-banner">{{ authErrorMessage }}</p>
		<form class="search" @submit.prevent="applySearch">
			<input v-model="searchInput" type="search" placeholder="搜索主题名称、描述或作者" />
			<button class="btn" type="submit">搜索</button>
		</form>
	</section>

	<section class="toolbar">
		<div class="tag-list">
			<button type="button" class="chip" :class="{ active: !tag }" @click="setTag('')">全部</button>
			<button
				v-for="item in tags"
				:key="item.tag"
				type="button"
				class="chip"
				:class="{ active: tag === item.tag }"
				@click="setTag(item.tag)"
			>
				{{ item.tag }}<span class="count">{{ item.count }}</span>
			</button>
		</div>
		<select v-model="sort" class="select">
			<option value="newest">最近更新</option>
			<option value="popular">下载最多</option>
			<option value="name">名称排序</option>
		</select>
	</section>

	<p v-if="errorMsg" class="error-banner">{{ errorMsg }}</p>
	<div v-if="loading" class="grid">
		<div v-for="i in 6" :key="i" class="skeleton"></div>
	</div>
	<template v-else-if="data">
		<div v-if="!data.themes.length" class="empty">
			<p>没有找到符合条件的主题。</p>
			<RouterLink class="btn" to="/submit">发布第一个主题</RouterLink>
		</div>
		<div v-else class="grid">
			<ThemeCard v-for="theme in data.themes" :key="theme.slug" :theme="theme" />
		</div>
		<div v-if="data.total_pages > 1" class="pager">
			<button class="btn btn-ghost" type="button" :disabled="page <= 1" @click="setPage(page - 1)">上一页</button>
			<span>第 {{ data.page }} / {{ data.total_pages }} 页（共 {{ data.total }} 个主题）</span>
			<button class="btn btn-ghost" type="button" :disabled="page >= data.total_pages" @click="setPage(page + 1)">下一页</button>
		</div>
	</template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api, type ThemeList } from '@/api';
import ThemeCard from '@/components/ThemeCard.vue';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
	state: '登录会话已过期或被中断，请重试。',
	token: 'GitHub 授权码交换失败，请重试。',
	user: '无法读取 GitHub 账号信息，请重试。',
	config: '服务器未配置 GitHub OAuth，暂时无法登录。',
	denied: '你取消了 GitHub 授权。',
};

const route = useRoute();
const router = useRouter();

const authErrorMessage = computed(() => {
	const code = typeof route.query.auth_error === 'string' ? route.query.auth_error : '';
	return code ? (AUTH_ERROR_MESSAGES[code] ?? '登录失败，请重试。') : '';
});

const searchInput = ref(typeof route.query.q === 'string' ? route.query.q : '');
const q = ref(searchInput.value);
const tag = ref(typeof route.query.tag === 'string' ? route.query.tag : '');
const sort = ref(typeof route.query.sort === 'string' ? route.query.sort : 'newest');
const page = ref(Number(route.query.page) || 1);

const data = ref<ThemeList | null>(null);
const tags = ref<Array<{ tag: string; count: number }>>([]);
const loading = ref(true);
const errorMsg = ref('');

async function load(): Promise<void> {
	loading.value = true;
	errorMsg.value = '';
	try {
		data.value = await api.listThemes({ q: q.value, tag: tag.value, sort: sort.value, page: page.value });
	} catch (error) {
		errorMsg.value = error instanceof Error ? error.message : '加载失败';
	} finally {
		loading.value = false;
	}
}

function applySearch(): void {
	q.value = searchInput.value.trim();
	page.value = 1;
}

function setTag(value: string): void {
	tag.value = tag.value === value ? '' : value;
	page.value = 1;
}

function setPage(value: number): void {
	page.value = value;
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

watch([q, tag, sort, page], () => {
	const query: Record<string, string> = {};
	if (q.value) query.q = q.value;
	if (tag.value) query.tag = tag.value;
	if (sort.value !== 'newest') query.sort = sort.value;
	if (page.value > 1) query.page = String(page.value);
	void router.replace({ query });
	void load();
});

onMounted(async () => {
	void load();
	try {
		tags.value = (await api.listTags()).tags;
	} catch {
		/* 标签加载失败不影响目录 */
	}
});
</script>

<style scoped>
.hero {
	padding: 40px 0 8px;
	max-width: 640px;
}

.hero h1 {
	font-size: 32px;
	margin: 0 0 12px;
}

.hero p {
	color: var(--text-muted);
	margin: 0 0 20px;
	line-height: 1.6;
}

.search {
	display: flex;
	gap: 8px;
}

.search input {
	flex: 1;
}

.toolbar {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16px;
	margin: 20px 0 24px;
}

.tag-list {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.chip {
	border: 1px solid var(--border);
	background: var(--bg-elevated);
	color: var(--text-muted);
	border-radius: 999px;
	padding: 4px 12px;
	font-size: 13px;
	cursor: pointer;
}

.chip.active {
	border-color: var(--accent);
	color: var(--text);
	background: color-mix(in srgb, var(--accent) 14%, var(--bg-elevated));
}

.count {
	margin-left: 6px;
	font-size: 11px;
	color: var(--text-faint);
}

.grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	gap: 20px;
}

.skeleton {
	height: 280px;
	border-radius: 14px;
	background: linear-gradient(100deg, var(--bg-elevated) 40%, var(--bg-inset) 50%, var(--bg-elevated) 60%);
	background-size: 200% 100%;
	animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
	to {
		background-position: -200% 0;
	}
}

.empty {
	text-align: center;
	padding: 64px 0;
	color: var(--text-muted);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
}

.pager {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16px;
	margin: 32px 0;
	color: var(--text-muted);
	font-size: 13px;
}
</style>
