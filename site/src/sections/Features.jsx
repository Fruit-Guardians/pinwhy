import { useSiteTheme } from '@/lib/theme';
import { useLang } from '../i18n.jsx';

function ExportVisual({ preview }) {
  return (
    <div className="export-spec">
      <div className="export-head">
        <strong>{preview.label}</strong>
        <span>{preview.tag}</span>
      </div>
      <div className="export-rows">
        {preview.items.map(([format, desc, cmd]) => (
          <div className="export-row" key={format}>
            <b>{format}</b>
            <span>{desc}</span>
            <code>{cmd}</code>
          </div>
        ))}
      </div>
      <p className="export-note">{preview.pngNote}</p>
    </div>
  );
}

export default function Features() {
  const { lang, t } = useLang();
  const { resolved } = useSiteTheme();
  const F = t.features;

  return (
    <section id="features" className="section" aria-labelledby="feat-title">
      <div className="wrap">
        <div className="head rv">
          <div className="kicker">{F.kicker}</div>
          <h2 className="h2" id="feat-title">{F.title}</h2>
          <p className="lead">{F.lead}</p>
        </div>

        <div className="feat-grid">
          {F.rows.map((r, i) => (
            <article key={r.k} className="card feat-card rv" style={{ '--d': `${(i % 2) * 0.05}s` }}>
              <div className={`feat-media${r.shot === 'digest' ? ' pad' : ''}`}>
                {r.shot ? (
                  <img
                    src={`/shots/${r.shot}-${lang}-${resolved}.webp`}
                    alt={r.t}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <ExportVisual preview={F.exportPreview} />
                )}
              </div>
              <div className="feat-body">
                <span className="feat-k">{r.k}</span>
                <h3>{r.t}</h3>
                <ul>{r.li.map((x, j) => <li key={j}>{x}</li>)}</ul>
              </div>
            </article>
          ))}
        </div>

        <article className="card local-band rv" style={{ '--d': '0.08s' }}>
          <div className="feat-body">
            <span className="feat-k">{F.local.k}</span>
            <h3>{F.local.t}</h3>
            <ul>{F.local.li.map((x, j) => <li key={j}>{x}</li>)}</ul>
          </div>
          <div>
            <div className="local-tree">
              <div className="hl">your-project/</div>
              <div className="i1">├─ src/</div>
              <div className="i1 hl">└─ .pinwhy/</div>
              <div className="i2 hl2">├─ events.jsonl<em>{F.local.tree.events}</em></div>
              <div className="i2">├─ state.json<em>{F.local.tree.state}</em></div>
              <div className="i2">├─ .gitignore<em>{F.local.tree.ignore}</em></div>
              <div className="i2">└─ ultra/</div>
              <div className="i3">└─ ledger.jsonl<em>{F.local.tree.ultra}</em></div>
            </div>
            <div className="local-lo"><i />{F.local.loopback}</div>
          </div>
        </article>
      </div>
    </section>
  );
}
