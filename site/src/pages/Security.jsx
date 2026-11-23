import { useState } from 'react';
import { Bug, CheckCircle2, FileCheck, FileCode, GitFork, Link2, Lock, Shield, ShieldAlert, Terminal } from 'lucide-react';
import WorkspaceFrame, { WORKSPACE_URLS } from '../components/WorkspaceFrame.jsx';
import { CtaBand } from '../sections/Finale.jsx';
import { useT } from '../i18n.jsx';
import { Icon, REPO, useCopyPrompt } from '../shared.jsx';

const CARD_ICONS = [GitFork, Bug, Link2, ShieldAlert];

export default function SecurityPage() {
  const t = useT();
  const S = t.securityPage;
  const copyPrompt = useCopyPrompt();
  const [live, setLive] = useState(false);

  return (
    <div className="security-page">
      <section className="sub-hero" aria-labelledby="sec-hero-title">
        <div className="wrap">
          <div className="sub-kicker">
            <Shield size={14} aria-hidden="true" />
            <span>{S.kicker}</span>
          </div>
          <h1 id="sec-hero-title" className="sub-title">{S.title}</h1>
          <p className="sub-lead">{S.subtitle}</p>
          <div className="badge-row">
            {S.badges.map((b) => (
              <span key={b} className="spec-badge">
                <CheckCircle2 size={13} aria-hidden="true" />
                <span>{b}</span>
              </span>
            ))}
          </div>
          <div className="sub-actions">
            <button className="btn btn-primary btn-lg" onClick={copyPrompt} type="button">
              <Icon.copy size={15} />
              <span>{S.cta}</span>
            </button>
            <a
              className="btn btn-secondary btn-lg"
              href={`${REPO}/blob/main/skills/pinwhy/methods/audit.md`}
              target="_blank"
              rel="noreferrer"
            >
              <FileCode size={15} aria-hidden="true" />
              <span>{S.methodBtn}</span>
            </a>
            <a
              className="btn btn-secondary btn-lg"
              href={`${REPO}/blob/main/skills/pinwhy-code-audit/SKILL.md`}
              target="_blank"
              rel="noreferrer"
            >
              <Shield size={15} aria-hidden="true" />
              <span>{S.scenarioBtn}</span>
            </a>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="pain-title">
        <div className="wrap">
          <div className="head rv">
            <div className="kicker">{S.painPoints.kicker}</div>
            <h2 className="h2" id="pain-title">{S.painPoints.title}</h2>
          </div>
          <div className="grid-3">
            {S.painPoints.items.map((item, idx) => (
              <article key={item.title} className="card sub-card rv" style={{ '--d': `${idx * 0.05}s` }}>
                <span className="sub-card-num">0{idx + 1}</span>
                <h3>{item.title}</h3>
                <div className="sub-compare-problem">
                  <span className="sub-label-problem">{S.painPoints.problemLabel}</span>
                  <span>{item.problem}</span>
                </div>
                <div className="sub-compare-solution">
                  <span className="sub-label-solution">{S.painPoints.solutionLabel}</span>
                  <span>{item.solution}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="workspace-title">
        <div className="wrap">
          <div className="head rv">
            <div className="kicker">{S.workspaceSection.kicker}</div>
            <h2 className="h2" id="workspace-title">{S.workspaceSection.title}</h2>
            <p className="lead">{S.workspaceSection.lead}</p>
          </div>

          <div className="stage-frame rv mb-8">
            <div className="stage">
              <div className="stage-bar">
                <span className="dots"><i /><i /><i /></span>
                <span className="url"><i className="lock" />127.0.0.1:4333<em>/?{WORKSPACE_URLS.audit}</em></span>
                <span className="demo-badge">{t.stage.badge}</span>
              </div>
              <div className="stage-body">
                <WorkspaceFrame view="audit" live={live} onLive={() => setLive(true)} />
              </div>
            </div>
          </div>

          <div className="grid-2">
            {S.workspaceSection.cards.map((card, idx) => {
              const CardIcon = CARD_ICONS[idx] || Shield;
              return (
                <article key={card.title} className="card sub-card rv" style={{ '--d': `${(idx % 2) * 0.05}s` }}>
                  <div className="sub-card-meta">
                    <div className="sub-card-type">
                      <span className="sub-card-ic"><CardIcon size={16} aria-hidden="true" /></span>
                      <span className="sub-card-pill">{card.type}</span>
                    </div>
                    <span className="sub-card-tag">{card.tag}</span>
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="compliance-title">
        <div className="wrap">
          <div className="head rv">
            <div className="kicker">{S.complianceSection.kicker}</div>
            <h2 className="h2" id="compliance-title">{S.complianceSection.title}</h2>
          </div>
          <div className="grid-3">
            {S.complianceSection.items.map((item, idx) => (
              <article key={item.title} className="card sub-card rv" style={{ '--d': `${idx * 0.05}s` }}>
                <span className="sub-card-ic mb-4">
                  {idx === 0 ? <FileCheck size={17} aria-hidden="true" /> : idx === 1 ? <Terminal size={17} aria-hidden="true" /> : <Lock size={17} aria-hidden="true" />}
                </span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title={S.bottomCta.title}
        lead={S.bottomCta.desc}
        actions={
          <>
            <button className="btn btn-primary btn-lg" onClick={copyPrompt} type="button">
              <Icon.copy size={15} />
              <span>{S.bottomCta.primary}</span>
            </button>
            <a className="btn btn-secondary btn-lg" href={`${REPO}/blob/main/skills/pinwhy/methods/audit.md`} target="_blank" rel="noreferrer">
              <span>{S.bottomCta.methodLink}</span>
              <Icon.arrow size={15} />
            </a>
            <a className="btn btn-secondary btn-lg" href={`${REPO}/tree/main/skills/pinwhy-code-audit`} target="_blank" rel="noreferrer">
              <span>{S.bottomCta.scenarioLink}</span>
              <Icon.arrow size={15} />
            </a>
          </>
        }
      />
    </div>
  );
}
