import { useRef, useState } from 'react';
import { ArrowDown, Boxes, CheckCircle2, Eye, ShieldCheck, Terminal, Wrench, Zap } from 'lucide-react';
import { useSiteTheme } from '@/lib/theme';
import { CtaBand } from '../sections/Finale.jsx';
import { Shell } from '../sections/Start.jsx';
import { useT } from '../i18n.jsx';
import { Icon, REPO, scrollToId, useCopy } from '../shared.jsx';

const HIGHLIGHT_ICONS = [Eye, Wrench, ShieldCheck, Zap];

function DshShot({ name, alt, caption }) {
  const { resolved } = useSiteTheme();
  const theme = resolved === 'dark' ? 'dark' : 'light';
  const src = name === '3d'
    ? `/shots/dsh-canvas-3d-${theme}.webp`
    : `/shots/dsh-canvas-${theme}.webp`;
  return (
    <figure className="dsh-shot">
      <img src={src} alt={alt} width={1600} height={1000} loading="lazy" decoding="async" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function DshPage() {
  const t = useT();
  const D = t.dshPage;
  const copy = useCopy();
  const S = D.showcase;
  const [copiedId, setCopiedId] = useState(null);
  const timer = useRef();

  const handleCopyCmd = (cmd, id) => {
    copy(cmd, D.installSection.copyToast);
    setCopiedId(id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiedId(null), 1400);
  };

  return (
    <div className="dsh-page">
      <section className="sub-hero" aria-labelledby="dsh-hero-title">
        <div className="wrap">
          <div className="sub-kicker">
            <Boxes size={14} aria-hidden="true" />
            <span>{D.kicker}</span>
          </div>
          <h1 id="dsh-hero-title" className="sub-title">{D.title}</h1>
          <p className="sub-lead">{D.subtitle}</p>
          <div className="badge-row">
            {D.badges.map((b) => (
              <span key={b} className="spec-badge">
                <CheckCircle2 size={13} aria-hidden="true" />
                <span>{b}</span>
              </span>
            ))}
          </div>
          <div className="sub-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => scrollToId('dsh-install')}
              type="button"
            >
              <ArrowDown size={15} aria-hidden="true" />
              <span>{D.cta}</span>
            </button>
            <a
              className="btn btn-secondary btn-lg"
              href={`${REPO}/tree/main/plugins/dsh-pinwhy`}
              target="_blank"
              rel="noreferrer"
            >
              <Terminal size={15} aria-hidden="true" />
              <span>{D.repoBtn}</span>
            </a>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="dsh-showcase-title">
        <div className="wrap">
          <div className="head rv">
            <div className="kicker">{S.kicker}</div>
            <h2 className="h2" id="dsh-showcase-title">{S.title}</h2>
            <p className="lead">{S.desc}</p>
          </div>
          <div className="dsh-shots rv">
            <DshShot name="board" alt={S.alt} caption={S.caption} />
            <DshShot name="3d" alt={S.alt3d} caption={S.caption3d} />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="dsh-arch-title">
        <div className="wrap">
          <div className="head rv">
            <div className="kicker">{D.architecture.kicker}</div>
            <h2 className="h2" id="dsh-arch-title">{D.architecture.title}</h2>
            <p className="lead">{D.architecture.desc}</p>
          </div>

          <div className="arch-flow rv">
            {D.architecture.layers.map((item) => (
              <article key={item.name} className="card arch-node">
                <span className="arch-step">{item.layer}</span>
                <h3>{item.name}</h3>
                <p>{item.role}</p>
                <code className="arch-meta">{item.meta}</code>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="dsh-feat-title">
        <div className="wrap">
          <div className="grid-2">
            {D.highlights.map((h, idx) => {
              const HighlightIcon = HIGHLIGHT_ICONS[idx] || Zap;
              return (
                <article key={h.t} className="card sub-card rv" style={{ '--d': `${(idx % 2) * 0.05}s` }}>
                  <div className="sub-card-meta">
                    <div className="sub-card-type">
                      <span className="sub-card-ic"><HighlightIcon size={16} aria-hidden="true" /></span>
                      <span className="sub-card-pill">{h.k}</span>
                    </div>
                  </div>
                  <h3>{h.t}</h3>
                  <p>{h.desc}</p>
                  <div className="sub-detail-box">{h.detail}</div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" id="dsh-install" aria-labelledby="dsh-install-title">
        <div className="wrap">
          <div className="head rv">
            <div className="kicker">{D.installSection.kicker}</div>
            <h2 className="h2" id="dsh-install-title">{D.installSection.title}</h2>
          </div>

          <div className="install-list">
            {D.installSection.steps.map((st, idx) => (
              <article key={st.n} className="card install-row rv" style={{ '--d': `${idx * 0.05}s` }}>
                <div>
                  <div className="install-head">
                    <span className="install-num">{st.n}</span>
                    <h3>{st.t}</h3>
                  </div>
                  <p className="install-desc">{st.d}</p>
                </div>
                <div className="install-cmds">
                  {st.cmd && (
                    <button
                      type="button"
                      className={`cli-cmd${copiedId === st.n ? ' done' : ''}`}
                      onClick={() => handleCopyCmd(st.cmd, st.n)}
                    >
                      <span className="ps" aria-hidden="true">$</span>
                      <code><Shell text={st.cmd} /></code>
                      <span className="cli-cmd-copy">
                        {copiedId === st.n ? <Icon.check size={13} /> : <Icon.copy size={13} />}
                        <span>{D.installSection.copyHint}</span>
                      </span>
                    </button>
                  )}
                  {st.code && <pre className="install-yaml">{st.code}</pre>}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title={D.bottomCta.title}
        lead={D.bottomCta.desc}
        actions={
          <a className="btn btn-primary btn-lg" href={`${REPO}/blob/main/plugins/dsh-pinwhy/README.md`} target="_blank" rel="noreferrer">
            <span>{D.bottomCta.docsBtn}</span>
            <Icon.arrow size={15} />
          </a>
        }
      />
    </div>
  );
}
