import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: '/',
			name: 'home',
			component: HomeView,
		},
		{
			path: '/themes/:slug',
			name: 'theme',
			component: () => import('@/views/ThemeDetailView.vue'),
		},
		{
			path: '/dashboard',
			name: 'dashboard',
			component: () => import('@/views/DashboardView.vue'),
		},
		{
			path: '/submit/:slug?',
			name: 'submit',
			component: () => import('@/views/SubmitView.vue'),
		},
	],
	scrollBehavior() {
		return { top: 0 };
	},
});

export default router;
