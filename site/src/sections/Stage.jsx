import { useState } from 'react';
import { Box, FileCheck2, ListTree, ScanSearch, Waypoints } from 'lucide-react';
import { useSiteTheme } from '@/lib/theme';
import { useLang } from '../i18n.jsx';
import WorkspaceFrame, { WORKSPACE_URLS } from '../components/WorkspaceFrame.jsx';

const TAB_IDS = ['context', 'audit', 'logic', 'all', 'board'];
const TAB_ICON = { context: ScanSearch, audit: FileCheck2, logic: Waypoints, all: ListTree, board: Box };

export default function Stage() {
  const { t, lang } = useLang();
  const { resolved } = useSiteTheme();
  const [view, setView] = useState('context');
  const [live, setLive] = useState(false);
  const [name, cap] = t.stage.tabs[view];

  return (
    <section className="stage-wrap" id="views" aria-label={t.stage.aria}>
      <div className="wrap">
        <div className="stage-head">
          <div className="seg" role="tablist" aria-label={t.stage.aria}>
            {TAB_IDS.map((id) => {
              const I = TAB_ICON[id];
              const isSelected = view === id;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setView(id)}
                  className={`seg-tab${isSelected ? ' on' : ''}`}
                  type="button"
                >
                  <I size={14} strokeWidth={1.8} aria-hidden="true" />
                  <span>{t.stage.tabs[id][0]}</span>
                </button>
              );
            })}
          </div>
          <p className="stage-cap" key={view}>
            <span>{name}</span>
            {cap}
          </p>
        </div>

        <div className="stage-frame">
          <div className="stage">
            <div className="stage-bar">
              <span className="dots"><i /><i /><i /></span>
              <span className="url"><i className="lock" />127.0.0.1:4333<em>/?{WORKSPACE_URLS[view]}</em></span>
              <span className="demo-badge">{t.stage.badge}</span>
            </div>
            <div className="stage-body">
              {view === 'board' ? (
                <div className="stage-board-view">
                  <img
                    src={`/shots/stage-board-${lang}-${resolved}.webp`}
                    alt={name}
                    width={1280}
                    height={800}
                    decoding="async"
                  />
                  <div className="stage-board-note">{t.stage.boardNote}</div>
                </div>
              ) : (
                <WorkspaceFrame view={view} live={live} onLive={() => setLive(true)} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
