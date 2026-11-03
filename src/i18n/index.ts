import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN';
import zhTW from './locales/zh-TW';
import en from './locales/en';
import de from './locales/de';
import fr from './locales/fr';
import it from './locales/it';
import ja from './locales/ja';
import ko from './locales/ko';
import koKP from './locales/ko-KP';
import nl from './locales/nl';
import ru from './locales/ru';

export type LocaleCode = 'zh-CN' | 'zh-TW' | 'en' | 'de' | 'fr' | 'it' | 'ja' | 'ko' | 'ko-KP' | 'nl' | 'ru';

export const LOCALES: { code: LocaleCode; label: string }[] = [
	{ code: 'zh-CN', label: '简体中文' },
	{ code: 'zh-TW', label: '繁體中文' },
	{ code: 'en', label: 'English' },
	{ code: 'de', label: 'Deutsch' },
	{ code: 'fr', label: 'Français' },
	{ code: 'it', label: 'Italiano' },
	{ code: 'ja', label: '日本語' },
	{ code: 'ko', label: '한국어' },
	{ code: 'ko-KP', label: '조선어' },
	{ code: 'nl', label: 'Nederlands' },
	{ code: 'ru', label: 'Русский' },
];

function detectLocale(): LocaleCode {
	const stored = localStorage.getItem('locale') as LocaleCode | null;
	if (stored && LOCALES.some((l) => l.code === stored)) return stored;
	const nav = navigator.language;
	if (nav.startsWith('zh')) {
		return nav === 'zh-TW' || nav === 'zh-HK' ? 'zh-TW' : 'zh-CN';
	}
	const match = LOCALES.find((l) => nav.startsWith(l.code.toLowerCase()));
	return match ? match.code : 'zh-CN';
}

export const i18n = createI18n({
	legacy: false,
	locale: detectLocale(),
	fallbackLocale: 'en',
	messages: {
		'zh-CN': zhCN,
		'zh-TW': zhTW,
		en,
		de,
		fr,
		it,
		ja,
		ko,
		'ko-KP': koKP,
		nl,
		ru,
	},
});
