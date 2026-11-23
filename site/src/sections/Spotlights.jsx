import { ArrowUpRight, Check } from 'lucide-react';
import { useSiteTheme } from '@/lib/theme';
import { useLang, useT } from '../i18n.jsx';
import { routeUrl, useRoute } from '../router.jsx';
import { isModifiedClick } from '../shared.jsx';

function SpotCard({ data, imgSrc, imgAlt, href, onOpen, tone, delay }) {
  return (
    <article className={`card sp-card sp-${tone} rv`} style={{ '--d': delay }}>
      <div className="sp-shot">
        <img src={imgSrc} alt={imgAlt} width={1280} height={800} loading="lazy" decoding="async" />
      </div>
      <div className="sp-body">
        <div className="sp-kicker"><span className="pip" />{data.kicker}</div>
        <h3 className="sp-title">{data.title}</h3>
        <p className="sp-desc">{data.desc}</p>
        <ul className="sp-list">
          {data.features.map((f) => (
            <li key={f}><Check size={14} strokeWidth={2.2} aria-hidden="true" /><span>{f}</span></li>
          ))}
        </ul>
        <div className="sp-actions">
          <a href={href} onClick={onOpen} className="btn btn-secondary btn-sm">
            <span>{data.cta}</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

export default function Spotlights() {
  const { lang } = useLang();
  const { resolved } = useSiteTheme();
  const t = useT();
  const { navigate } = useRoute();
  const S = t.spotlights;

  const openRoute = (target) => (e) => {
    if (isModifiedClick(e)) return;
    e.preventDefault();
    navigate(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="section" aria-labelledby="spot-title">
      <div className="wrap">
        <div className="head rv">
          <div className="kicker">{S.head.kicker}</div>
          <h2 className="h2" id="spot-title">{S.head.title}</h2>
          <p className="lead">{S.head.lead}</p>
        </div>

        <div className="sp-grid">
          <SpotCard
            data={S.security}
            imgSrc={`/shots/stage-audit-${lang}-${resolved}.webp`}
            imgAlt={S.security.title}
            href={routeUrl('security', lang)}
            onOpen={openRoute('security')}
            tone="sec"
            delay="0.04s"
          />
          <SpotCard
            data={S.dsh}
            imgSrc={`/shots/dsh-canvas-${resolved}.webp`}
            imgAlt={S.dsh.title}
            href={routeUrl('dsh', lang)}
            onOpen={openRoute('dsh')}
            tone="dsh"
            delay="0.1s"
          />
        </div>
      </div>
    </section>
  );
}
