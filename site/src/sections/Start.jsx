import { useRef, useState } from 'react';
import { CodeXml, Package, Sparkles, SquareTerminal } from 'lucide-react';
import { siClaude, siDeepseek } from 'simple-icons';
import { useLang } from '../i18n.jsx';
import { Brand, Icon, REPO } from '../shared.jsx';

const TAB_ICON = {
  auto: <Sparkles size={14} strokeWidth={1.9} aria-hidden="true" />,
  claude: <Brand icon={siClaude} size={13} aria-hidden="true" />,
  codex: <CodeXml size={14} strokeWidth={1.9} aria-hidden="true" />,
  dsh: <Brand icon={siDeepseek} size={14} aria-hidden="true" />,
  skill: <Package size={14} strokeWidth={1.9} aria-hidden="true" />,
  cli: <SquareTerminal size={14} strokeWidth={1.9} aria-hidden="true" />,
};

/** Splits a shell line into coloured tokens: command, flags, strings, variables, placeholders. */
export function Shell({ text }) {
  const parts = text.match(/"[^"]*"?|<[^>]*>?|\S+|\s+/g) || [];
  let seen = false;
  return parts.map((p, i) => {
    if (/^\s+$/.test(p)) return p;
    let c = 'tk-arg';
    if (!seen) { c = 'tk-cmd'; seen = true; }
    else if (p.startsWith('"')) c = 'tk-str';
    else if (p.startsWith('<')) c = 'tk-ph';
    else if (p.startsWith('-')) c = 'tk-flag';
    else if (p.includes('$')) c = 'tk-var';
    return <span key={i} className={c}>{p}</span>;
  });
}

export default function Start() {
  const { t } = useLang();
  const S = t.start;
  const M = S.manual;
  const tabs = [['auto', S.tabAuto, S.auto.badge], ...M.hosts.map((h) => [h.id, h.name, h.tag])];
  const [tab, setTab] = useState('auto');
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef();

  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setFlash(key);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1400);
  };

  const host = tab === 'auto' ? null : M.hosts.find((h) => h.id === tab);
  const steps = host ? [M.install, host, M.verify] : [];
  const allCmds = host ? steps.flatMap((s) => s.cmds).join('\n') : t.prompt;

  return (
    <section id="start" className="section" aria-labelledby="start-title">
      <div className="wrap">
        <div className="head rv">
          <div className="kicker">{S.kicker}</div>
          <h2 className="h2" id="start-title">{S.title}</h2>
          <p className="lead">{S.lead}</p>
        </div>

        <div className="start-grid rv">
          <div className="start-rail" role="tablist" aria-label={M.hostsAria} aria-orientation="vertical">
            {tabs.map(([id, label, sub]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                className={`start-tab${tab === id ? ' on' : ''}`}
                onClick={() => setTab(id)}
              >
                <span className="start-tab-ic">{TAB_ICON[id]}</span>
                <span className="start-tab-tx">
                  <b>{label}</b>
                  {sub && <small>{sub}</small>}
                </span>
              </button>
            ))}
          </div>

          <div className="start-panel" role="tabpanel">
            <div className="start-panel-bar">
              <div className="start-panel-title">
                <span>{tab === 'auto' ? S.auto.title : host.name}</span>
                <span className="start-panel-tag">{tab === 'auto' ? S.auto.badge : host.tag}</span>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${flash === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => copy(allCmds, 'all')}
              >
                {flash === 'all' ? <Icon.check size={14} /> : <Icon.copy size={14} />}
                <span>{flash === 'all' ? S.copied : tab === 'auto' ? S.copyPrompt : S.copyCmds}</span>
              </button>
            </div>

            {tab === 'auto' ? (
              <div className="start-panel-body">
                <p className="prompt-quote">{t.prompt}</p>
                <ul className="prompt-checks">
                  {S.auto.steps.map((line) => (
                    <li key={line}>
                      <span className="ok"><Icon.check size={12} /></span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="prompt-reply">
                  <span>{S.reply[0]} · {S.reply[1]}</span>
                  <code>{S.reply[2]}</code>
                </div>
              </div>
            ) : (
              <div className="start-panel-body">
                <div className="cli-steps">
                  {steps.map((step, i) => (
                    <div key={step.t}>
                      <div className="cli-step-head">
                        <span className="cli-step-n">0{i + 1}</span>
                        <b>{step.t}</b>
                      </div>
                      <p className="cli-step-desc">{step.d}</p>
                      <div className="cli-cmds">
                        {step.cmds.map((cmd, j) => {
                          const key = `${tab}-${i}-${j}`;
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`cli-cmd${flash === key ? ' done' : ''}`}
                              onClick={() => copy(cmd, key)}
                              title={S.hint}
                            >
                              <span className="ps" aria-hidden="true">$</span>
                              <code><Shell text={cmd} /></code>
                              <span className="cli-cmd-copy">
                                {flash === key ? <><Icon.check size={13} />{S.copied}</> : <><Icon.copy size={13} />{M.copy}</>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="start-panel-foot">
              <span className="mono">{S.cwd}</span>
              <span>{S.env}</span>
            </div>
          </div>
        </div>

        <p className="start-foot-note rv">
          <span>{S.auto.note}</span>
          <a href={`${REPO}/blob/main/skills/pinwhy/references/setup.md`} target="_blank" rel="noreferrer">
            {M.guide}
            <Icon.arrow size={14} />
          </a>
        </p>
      </div>
    </section>
  );
}
