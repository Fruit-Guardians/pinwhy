import { useState } from 'react';
import { useLang } from '../i18n.jsx';

export default function Recovery() {
  const { t } = useLang();
  const T = t.how;
  const A = T.artifacts;
  const [phase, setPhase] = useState(0);

  return (
    <section id="how" className="section" aria-labelledby="recovery-title">
      <div className="wrap">
        <div className="head rv">
          <div className="kicker">{T.kicker}</div>
          <h2 className="h2" id="recovery-title">{T.title[0]}<br />{T.title[1]}</h2>
          <p className="lead">{T.lead}</p>
        </div>

        <div className="how-grid rv">
          <div className="how-steps" role="tablist" aria-label={T.kicker}>
            {T.steps.map(([title, desc], i) => (
              <button
                key={title}
                type="button"
                role="tab"
                aria-selected={phase === i}
                className={`how-step${phase === i ? ' on' : ''}`}
                onClick={() => setPhase(i)}
              >
                <span className="how-step-num">0{i + 1}</span>
                <div>
                  <b>{title}</b>
                  <p>{desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="how-stage" role="tabpanel">
            <div className="how-stage-head">
              <strong>
                {phase === 0 ? A.writeTitle : phase === 1 ? A.persistTitle : A.recoverCmd}
              </strong>
              <span>
                {phase === 0 ? A.writeMeta : phase === 1 ? A.persistStoreLabel : A.recoverPolicy}
              </span>
            </div>

            {phase === 0 && (
              <div className="how-stage-body">
                {A.writeRows.map(([kind, id, title, meta]) => (
                  <div className="art-row" key={id}>
                    <span className={`art-kind ${kind}`}>{kind}</span>
                    <span className="art-id">{id}</span>
                    <span className="art-title">{title}</span>
                    <span className="art-meta">{meta}</span>
                  </div>
                ))}
                <div className="art-link">
                  <span className="art-id">{A.writeLink[0]}</span>
                  <span className="art-rel">— {A.writeLink[2]} →</span>
                  <span className="art-id">{A.writeLink[1]}</span>
                  <span>{A.writeLink[3]}</span>
                </div>
                <div className="art-row">
                  <span className="art-kind cursor">{A.writeCursor[0]}</span>
                  <span className="art-id">{A.writeCursor[1]}</span>
                  <span className="art-title">{A.writeCursor[2]}</span>
                </div>
              </div>
            )}

            {phase === 1 && (
              <div className="how-stage-body">
                <div className="persist-lane">
                  <div className="persist-box dim">
                    <div className="persist-top">
                      <b>{A.persistPrevLabel}</b>
                      <span>{A.persistPrevStatus}</span>
                    </div>
                    <p className="persist-desc">{A.persistPrevDesc}</p>
                  </div>

                  <div className="persist-box store">
                    <div className="persist-top">
                      <b className="mono">{A.persistStoreLabel}</b>
                      <span>{A.persistStoreBadge}</span>
                    </div>
                    <p className="persist-desc">{A.persistStoreSub}</p>
                  </div>

                  <div className="persist-box">
                    <div className="persist-top">
                      <b>{A.persistNextLabel}</b>
                      <span>{A.persistNextStatus}</span>
                    </div>
                    <p className="persist-desc">{A.persistNextDesc}</p>
                  </div>
                </div>
              </div>
            )}

            {phase === 2 && (
              <div className="how-stage-body">
                <div className="recover-block">
                  <label>{A.recoverCursorLabel}</label>
                  <div className="art-row">
                    <span className="art-kind cursor">{A.recoverCursor[0]}</span>
                    <span className="art-title">{A.recoverCursor[1]}</span>
                  </div>
                </div>
                <div className="recover-block">
                  <label>{A.recoverIncludedLabel}</label>
                  <ul>
                    {A.recoverIncluded.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </div>
                <div className="recover-block recover-omit-block">
                  <label>{A.recoverOmittedLabel}</label>
                  <p className="m-0 text-[13px] text-[var(--muted)]">{A.recoverOmitted}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
