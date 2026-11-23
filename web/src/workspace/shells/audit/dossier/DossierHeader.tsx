import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { t } from '../../../../i18n';
import { presentNode } from '../../../../presentation';
import type { BoardNode } from '../../../../types';
import type { AuditSelection } from '../../../audit';
import { AuditSurfaceSwitch } from '../shared';

export function DossierHeader({
  audit,
  graphOpen,
  memberIndex,
  prevCandidate,
  nextCandidate,
  onToggleGraph,
  onIssue,
  onCandidate,
}: {
  audit: AuditSelection;
  graphOpen: boolean;
  memberIndex: number;
  prevCandidate: BoardNode | null;
  nextCandidate: BoardNode | null;
  onToggleGraph: (next?: boolean) => void;
  onIssue: (id: string | null) => void;
  onCandidate: (id: string | null) => void;
}) {
  return (
    <header className="shrink-0 border-b bg-card px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => onIssue(null)}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            {t('audit.allIssues')}
          </button>
          {audit.issue && (
            <>
              <span className="text-muted-foreground">/</span>
              {audit.candidate ? (
                <button
                  type="button"
                  onClick={() => onCandidate(null)}
                  className="max-w-72 truncate text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  title={audit.issue.title}
                >
                  {presentNode(audit.issue).headline}
                </button>
              ) : (
                <span className="truncate font-semibold text-foreground">{audit.issue.id}</span>
              )}
            </>
          )}
          {audit.candidate && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="font-mono font-semibold text-foreground">{audit.candidate.id}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden text-[11px] text-muted-foreground @4xl:inline">{t('audit.authoredOnly')}</span>
          {memberIndex >= 0 && audit.members.length > 1 && (
            <div className="inline-flex items-center gap-0.5 rounded-md border bg-secondary/40 px-1 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              <IconButton
                label={t('audit.prevCandidate')}
                disabled={!prevCandidate}
                onClick={() => prevCandidate && onCandidate(prevCandidate.id)}
                className="size-6"
              >
                <ChevronLeft className="size-3.5" />
              </IconButton>
              <span className="px-1 font-mono">{memberIndex + 1}/{audit.members.length}</span>
              <IconButton
                label={t('audit.nextCandidate')}
                disabled={!nextCandidate}
                onClick={() => nextCandidate && onCandidate(nextCandidate.id)}
                className="size-6"
              >
                <ChevronRight className="size-3.5" />
              </IconButton>
            </div>
          )}
          <AuditSurfaceSwitch graphOpen={graphOpen} onToggleGraph={onToggleGraph} />
        </div>
      </div>

      {audit.outsideIssue && <p role="status" className="m-0 mt-1.5 text-xs font-medium text-foreground">{t('audit.outsideIssue')}</p>}
      {(audit.missingIssue || audit.missingCandidate) && <p role="status" className="m-0 mt-1.5 text-xs text-muted-foreground">{t('audit.missingRoot')}</p>}
    </header>
  );
}
