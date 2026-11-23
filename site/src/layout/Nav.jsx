import { useEffect, useRef, useState } from 'react';
import { useSiteTheme } from '../lib/theme.jsx';
import { switchThemeWithReveal } from '../lib/themeReveal.js';
import { useLang } from '../i18n.jsx';
import { siteTargetHref } from '../routes.mjs';
import { routeUrl, useRoute } from '../router.jsx';
import { Icon, REPO, isModifiedClick, scrollToId } from '../shared.jsx';

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return { open, setOpen, ref };
}

function ThemeMenu() {
  const { theme, resolved, setTheme } = useSiteTheme();
  const { t } = useLang();
  const { open, setOpen, ref } = usePopover();
  const opts = [['light', Icon.sun], ['dark', Icon.moon], ['system', Icon.monitor]];
  return (
    <div className="pop-wrap" ref={ref}>
      <button className="icon-btn" aria-label={t.nav.theme} aria-expanded={open} onClick={() => setOpen((v) => !v)} type="button">
        {resolved === 'dark' ? <Icon.moon /> : <Icon.sun />}
      </button>
      {open && (
        <div className="pop" role="menu">
          {opts.map(([k, I]) => (
            <button
              key={k}
              role="menuitemradio"
              aria-checked={theme === k}
              className={theme === k ? 'on' : ''}
              type="button"
              onClick={() => { setOpen(false); switchThemeWithReveal(k, setTheme); }}
            >
              <I size={15} />
              {t.nav.themes[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LangSwitch() {
  const { page, lang, switchLang } = useRoute();
  const { t } = useLang();
  return (
    <div className="lang-switch" role="radiogroup" aria-label={t.nav.lang}>
      <span className="thumb" style={{ transform: `translateX(${lang === 'zh' ? 0 : 100}%)` }} aria-hidden="true" />
      {[['zh', '中', 'zh-CN'], ['en', 'EN', 'en']].map(([id, label, tag]) => (
        <a
          key={id}
          role="radio"
          aria-checked={lang === id}
          className={lang === id ? 'on' : ''}
          lang={tag}
          hrefLang={tag}
          href={routeUrl(page, id)}
          onClick={(e) => {
            if (isModifiedClick(e)) return;
            e.preventDefault();
            switchLang(id);
          }}
        >
          {label}
        </a>
      ))}
    </div>
  );
}

function useScrollSpy(ids, enabled) {
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    if (!enabled) { setCurrent(null); return undefined; }
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return undefined;
    const io = new IntersectionObserver((entries) => {
      const hit = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setCurrent(hit.target.id);
      else if (window.scrollY < 200) setCurrent(null);
    }, { rootMargin: '-30% 0px -60% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids.join(), enabled]);
  return current;
}

export function Nav() {
  const { t, lang } = useLang();
  const { page, navigate } = useRoute();
  const [scrolled, setScrolled] = useState(false);
  const [sheet, setSheet] = useState(false);
  const homeIds = t.nav.links.filter(([, , target]) => target.startsWith('home#')).map(([, , target]) => target.slice(5));
  const spied = useScrollSpy(homeIds, page === 'home');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (target) => (target.startsWith('home#') ? page === 'home' && spied === target.slice(5) : target === page);

  const handleNav = (target) => (e) => {
    if (e && isModifiedClick(e)) return;
    e?.preventDefault();
    setSheet(false);
    if (target === 'home' || target === 'security' || target === 'dsh') {
      navigate(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target.startsWith('home#')) {
      const hash = target.slice(5);
      if (page === 'home') {
        scrollToId(hash);
      } else {
        navigate('home', hash);
        setTimeout(() => scrollToId(hash), 60);
      }
    }
  };

  return (
    <header className={`nav${scrolled || sheet ? ' scrolled' : ''}`}>
      <div className="wrap nav-in">
        <a className="nav-brand" href={routeUrl('home', lang)} onClick={handleNav('home')} aria-label="Pinwhy Home">
          <img src="/mark.svg" alt="" />
          <b>Pinwhy</b>
          <span className="ver">v0.2.0</span>
        </a>

        <nav className="nav-links" aria-label="primary">
          {t.nav.links.map(([id, label, target]) => {
            const active = isActive(target);
            return (
              <a
                key={id}
                href={siteTargetHref(target, lang)}
                className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={handleNav(target)}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div className="nav-right">
          <LangSwitch />
          <ThemeMenu />
          <a className="icon-btn" href={REPO} target="_blank" rel="noreferrer" aria-label="GitHub">
            <Icon.github width="16" height="16" />
          </a>
          <button
            className="icon-btn nav-burger"
            aria-label={t.nav.menu}
            aria-expanded={sheet}
            onClick={() => setSheet((v) => !v)}
            type="button"
          >
            {sheet ? <Icon.x size={16} /> : <Icon.menu size={16} />}
          </button>
        </div>
      </div>

      {sheet && (
        <nav className="nav-sheet" aria-label="mobile navigation">
          {t.nav.links.map(([id, label, target]) => (
            <a
              key={id}
              href={siteTargetHref(target, lang)}
              className={isActive(target) ? 'active' : ''}
              onClick={handleNav(target)}
            >
              {label}
            </a>
          ))}
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      )}
    </header>
  );
}

export default Nav;
