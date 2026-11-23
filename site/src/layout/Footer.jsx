import { ArrowUpRight } from 'lucide-react';
import { useLang } from '../i18n.jsx';
import { siteTargetHref } from '../routes.mjs';
import { useRoute } from '../router.jsx';
import { isModifiedClick, scrollToId } from '../shared.jsx';

export function Footer() {
  const { lang, t } = useLang();
  const { page, navigate } = useRoute();
  const F = t.footer;

  const handleRoute = (to) => (e) => {
    if (isModifiedClick(e)) return;
    e.preventDefault();
    if (to.startsWith('home#')) {
      const hash = to.slice(5);
      if (page === 'home') scrollToId(hash);
      else {
        navigate('home', hash);
        setTimeout(() => scrollToId(hash), 60);
      }
    } else {
      navigate(to);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="foot">
      <div className="wrap foot-grid">
        <div className="foot-about">
          <div className="foot-brand">
            <img src="/mark.svg" alt="" />
            <b>Pinwhy</b>
          </div>
          <p>{F.tag}</p>
          <small>{`© ${new Date().getFullYear()} Pinwhy · ${F.license}`}</small>
        </div>

        {F.cols.map((col) => (
          <nav key={col.title} className="foot-col" aria-label={col.title}>
            <h3>{col.title}</h3>
            {col.items.map((item) => (
              item.to ? (
                <a key={item.label} href={siteTargetHref(item.to, lang)} onClick={handleRoute(item.to)}>
                  {item.label}
                </a>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.sameSite ? undefined : '_blank'}
                  rel={item.sameSite ? undefined : 'noreferrer'}
                >
                  <span>{item.label}</span>
                  {!item.sameSite && <ArrowUpRight size={12} aria-hidden="true" />}
                </a>
              )
            ))}
          </nav>
        ))}
      </div>
    </footer>
  );
}

export default Footer;
