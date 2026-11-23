import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { parseSiteRoute, siteRouteUrl } from './routes.mjs';

export function parseRoute(pathname = (typeof location !== 'undefined' ? location.pathname : '/')) {
  return parseSiteRoute(pathname);
}

export const routeUrl = siteRouteUrl;

const RouteCtx = createContext({
  page: 'home',
  lang: 'zh',
  navigate: () => { /* context fallback */ },
  switchLang: () => { /* context fallback */ },
});

export function RouteProvider({ children }) {
  const [route, setRoute] = useState(() => parseRoute());

  useEffect(() => {
    const onPop = () => {
      setRoute(parseRoute());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((targetPage, hash = '') => {
    setRoute((prev) => {
      const url = routeUrl(targetPage, prev.lang) + (hash ? `#${hash}` : '');
      if (typeof window !== 'undefined') {
        history.pushState(null, '', url);
        if (!hash) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
      return { ...prev, page: targetPage };
    });
  }, []);

  const switchLang = useCallback((targetLang) => {
    setRoute((prev) => {
      if (prev.lang === targetLang) return prev;
      const hash = typeof location !== 'undefined' ? location.hash : '';
      const url = routeUrl(prev.page, targetLang) + hash;
      if (typeof window !== 'undefined') {
        history.pushState(null, '', url);
      }
      return { ...prev, lang: targetLang };
    });
  }, []);

  return (
    <RouteCtx.Provider value={{ ...route, navigate, switchLang }}>
      {children}
    </RouteCtx.Provider>
  );
}

export const useRoute = () => useContext(RouteCtx);
