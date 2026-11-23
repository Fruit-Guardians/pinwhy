// Single source of truth for website routes, language prefixes, and SEO metadata.
// Shared by the browser router, navigation layout, and static prerender script.

export const SITE_LANGS = ['zh', 'en'];
export const SITE_PAGES = ['home', 'security', 'dsh'];

export const SITE_ROUTES = Object.freeze([
  Object.freeze({
    key: 'zh',
    page: 'home',
    lang: 'zh',
    path: '/',
    pair: 'en',
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
    image: '/og-zh.png',
    selector: '#hero-title',
    title: 'Pinwhy — Agent 的外置记忆与可视化工作台',
    desc: 'Pinwhy 是与宿主无关的 Agent 外置记忆与可视化工作台。把关键判断、正反证据、显式关系与当前位置写进项目本地，跨会话按预算读回现场。',
  }),
  Object.freeze({
    key: 'en',
    page: 'home',
    lang: 'en',
    path: '/en/',
    pair: 'zh',
    htmlLang: 'en',
    ogLocale: 'en_US',
    image: '/og-en.png',
    selector: '#hero-title',
    title: 'Pinwhy — External memory and a visual workspace for AI agents',
    desc: 'Pinwhy is a host-agnostic external memory and visual workspace for AI agents. Keep judgments, evidence, explicit relations, and cursors in your project, and read them back within budget across sessions.',
  }),
  Object.freeze({
    key: 'zh_sec',
    page: 'security',
    lang: 'zh',
    path: '/security/',
    pair: 'en_sec',
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
    image: '/og-zh.png',
    selector: '#sec-hero-title',
    title: '安全研究与代码审计 — Pinwhy',
    desc: '同一份黑板的审计阅读视图：议题目录、三维候选态势矩阵、双翼辩证卷宗与可切换论证图，支持多方溯源与 SARIF 2.1.0 导出。',
  }),
  Object.freeze({
    key: 'en_sec',
    page: 'security',
    lang: 'en',
    path: '/en/security/',
    pair: 'zh_sec',
    htmlLang: 'en',
    ogLocale: 'en_US',
    image: '/og-en.png',
    selector: '#sec-hero-title',
    title: 'Security Research & Code Audit — Pinwhy',
    desc: 'A dedicated reading mode over the same board: issue outline, orthogonal candidate matrix, two-wing dialectical dossier, argument graph, and SARIF 2.1.0 export.',
  }),
  Object.freeze({
    key: 'zh_dsh',
    page: 'dsh',
    lang: 'zh',
    path: '/dsh/',
    pair: 'en_dsh',
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
    image: '/og-zh.png',
    selector: '#dsh-hero-title',
    title: 'DeepSeek Harness 原生适配器 — Pinwhy',
    desc: '通过 plugins/dsh-pinwhy 在 DeepSeek Harness 内提供 11 个结构化原生工具与内嵌画板，调用独立 Pinwhy CLI，随宿主生命周期回收临时服务。',
  }),
  Object.freeze({
    key: 'en_dsh',
    page: 'dsh',
    lang: 'en',
    path: '/en/dsh/',
    pair: 'zh_dsh',
    htmlLang: 'en',
    ogLocale: 'en_US',
    image: '/og-en.png',
    selector: '#dsh-hero-title',
    title: 'DeepSeek Harness Native Adapter — Pinwhy',
    desc: 'Connect DeepSeek Harness to your installed Pinwhy CLI with 11 typed native tools, sandbox path validation, and an embedded canvas via plugins/dsh-pinwhy.',
  }),
]);

export const SITE_ROUTES_BY_KEY = Object.freeze(
  Object.fromEntries(SITE_ROUTES.map((route) => [route.key, route])),
);

export function parseSiteRoute(pathname = '/') {
  const isEn = /^\/en(\/|$)/i.test(pathname);
  const clean = pathname.replace(/^\/en/i, '').replace(/^\/+|\/+$/g, '');
  let page = 'home';
  if (clean === 'security' || clean.startsWith('security/')) page = 'security';
  else if (clean === 'dsh' || clean.startsWith('dsh/')) page = 'dsh';
  return { lang: isEn ? 'en' : 'zh', page };
}

export function siteRouteUrl(page, lang = 'zh') {
  const normalizedLang = lang === 'en' ? 'en' : 'zh';
  const normalizedPage = SITE_PAGES.includes(page) ? page : 'home';
  const hit = SITE_ROUTES.find((route) => route.page === normalizedPage && route.lang === normalizedLang);
  return hit ? hit.path : normalizedLang === 'en' ? '/en/' : '/';
}

export function siteTargetHref(target, lang = 'zh') {
  if (target === 'home' || target === 'security' || target === 'dsh') {
    return siteRouteUrl(target, lang);
  }
  if (typeof target === 'string' && target.startsWith('home#')) {
    return `${siteRouteUrl('home', lang)}#${target.slice(5)}`;
  }
  return siteRouteUrl('home', lang);
}
