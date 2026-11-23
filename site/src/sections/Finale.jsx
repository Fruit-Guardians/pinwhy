import { useT } from '../i18n.jsx';
import { DOCS, Icon, useCopyPrompt } from '../shared.jsx';

export function CtaBand({ title, lead, actions }) {
  const t = useT();
  const copyPrompt = useCopyPrompt();

  return (
    <section className="cta-band-wrap" aria-labelledby="cta-band-title">
      <div className="wrap">
        <div className="cta-band rv">
          <h2 id="cta-band-title">{title || t.finale.title}</h2>
          <p>{lead || t.finale.lead}</p>
          <div className="cta-band-actions">
            {actions || (
              <>
                <button type="button" className="btn btn-primary btn-lg" onClick={copyPrompt}>
                  <Icon.copy size={15} />
                  <span>{t.finale.cta}</span>
                </button>
                <a className="btn btn-secondary btn-lg" href={DOCS} target="_blank" rel="noreferrer">
                  <span>{t.finale.docs}</span>
                  <Icon.arrow size={15} />
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
