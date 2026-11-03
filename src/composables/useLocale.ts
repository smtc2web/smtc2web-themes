import { watch } from 'vue';
import { i18n, type LocaleCode } from '@/i18n';

export function useLocale() {
	const locale = i18n.global.locale;

	watch(locale, (val) => {
		localStorage.setItem('locale', val);
		document.documentElement.lang = val;
	}, { immediate: true });

	function setLocale(code: LocaleCode) {
		locale.value = code;
	}

	return { locale, setLocale };
}
