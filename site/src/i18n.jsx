import { createContext, useContext, useEffect } from 'react';
import { useRoute } from './router.jsx';
import { SITE_ROUTES } from './routes.mjs';
import { zh } from './locales/zh.jsx';
import { en } from './locales/en.jsx';

export const DICTS = { zh, en };

const LangCtx = createContext({ lang: 'zh', t: zh, setLang: () => { /* context fallback */ } });

export function LangProvider({ children }) {
  const { page, lang, switchLang } = useRoute();
  const t = DICTS[lang] || DICTS.zh;

  useEffect(() => {
    const route = SITE_ROUTES.find((r) => r.page === page && r.lang === lang) || SITE_ROUTES[0];
    document.documentElement.lang = route.htmlLang;
    document.title = route.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', route.desc);
  }, [page, lang]);

  return <LangCtx.Provider value={{ lang, t, setLang: switchLang }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
export const useT = () => useContext(LangCtx).t;
