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
    title: 'Pinwhy — 面向 AI Agent 的本地状态记录工具与可视化工作台',
    desc: 'Pinwhy 将目标、假设、正反证据、有向关系与检查点写入项目本地 .pinwhy/events.jsonl。Agent 按预算读回上下文，开发者在通用、审计与 Ultra 三视图工作台中核对依据与进展。',
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
    title: 'Pinwhy — Local state recorder and visual workspace for AI agents',
    desc: 'Pinwhy writes goals, hypotheses, evidence, explicit relations, and checkpoints to project-local .pinwhy/events.jsonl. Restore context within token budget and review across General, Audit, and Ultra views.',
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
    title: '安全审计与 Ultra 覆盖 — Pinwhy',
    desc: '同一项目下的审计辩证卷宗与 pinwhy-ultra 文件切片覆盖视图：议题目录、三维态势矩阵、正反依据对照、星轨与门禁对账，支持 SARIF 2.1.0 与离线导出。',
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
    title: 'Security Audit & Ultra Coverage — Pinwhy',
    desc: 'Structured security review across Audit dossiers and pinwhy-ultra slice coverage: issue outline, orthogonal matrix, support vs counterevidence wings, constellation & gate audit, and SARIF 2.1.0 export.',
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
    title: 'DeepSeek Harness 原生插件 — Pinwhy',
    desc: '通过 plugins/dsh-pinwhy 在 DeepSeek Harness 内提供 11 个原生工具、动态 Skill 加载与只读内嵌工作台（支持通用、审计、Ultra 与 2.5D 视图），通过公开契约调用独立 CLI。',
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
    title: 'DeepSeek Harness Native Plugin — Pinwhy',
    desc: 'Connect DeepSeek Harness to your standalone Pinwhy CLI with 11 typed tools, dynamic Skill loading, sandbox path checks, and an embedded canvas across General, Audit, Ultra, and 2.5D views.',
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
