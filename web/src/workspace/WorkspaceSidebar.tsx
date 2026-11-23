import { t } from '../i18n';
import type { NodeFilter } from '../presentation';
import { Sidebar } from '../panels/Sidebar';
import type { BoardNode } from '../types';
import type { AuditExpansionAction, AuditSelection } from './audit';
import { AuditCatalog } from './shells/audit/AuditCatalog';
import type { AuditProvenanceMode } from './use-workspace-chrome';
import type { NodeChange } from './use-workspace-presentation';

type FilterOptions = {
  types: { value: string; count: number }[];
  statuses: { value: string; count: number }[];
  confidences: { value: string; count: number }[];
  riskCount: number;
};

type Counts = {
  nodes: number;
  edges: number;
  risk: number;
  open: number;
  candidates: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  audit: AuditSelection | null;
  selectedId: string | null;
  visibleIds?: Set<string>;
  current: BoardNode | null;
  goals: BoardNode[];
  openItems: BoardNode[];
  findings: BoardNode[];
  inbox: BoardNode[];
  counts: Counts;
  filter: NodeFilter;
  onFilter: (next: NodeFilter) => void;
  filterOptions: FilterOptions;
  results: BoardNode[] | null;
  provenanceMode: AuditProvenanceMode;
  changes: ReadonlyMap<string, NodeChange> | null;
  fresh: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onSearch: () => void;
  onShortcuts: () => void;
  onIssue: (id: string | null) => void;
  onCandidate: (id: string | null) => void;
  onCandidateIssue: (id: string) => void;
  onOpenArgument: (node: BoardNode, parentIssueId?: string) => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
};

export function WorkspaceSidebar({
  open,
  onClose,
  audit,
  selectedId,
  visibleIds,
  current,
  goals,
  openItems,
  findings,
  inbox,
  counts,
  filter,
  onFilter,
  filterOptions,
  results,
  provenanceMode,
  changes,
  fresh,
  onSelect,
  onSearch,
  onShortcuts,
  onIssue,
  onCandidate,
  onCandidateIssue,
  onOpenArgument,
  onExpand,
}: Props) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-20 bg-black/20 lg:hidden"
        aria-label={t('app.closeNav')}
        onClick={onClose}
      />
      <aside className="anim-sidebar-in z-30 w-64 shrink-0 border-r bg-background max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:shadow-float">
        {audit ? (
          <AuditCatalog
            audit={audit}
            selectedId={selectedId}
            onSelect={onSelect}
            onIssue={onIssue}
            onCandidate={onCandidate}
            onCandidateIssue={onCandidateIssue}
            onOpenArgument={onOpenArgument}
            onExpand={onExpand}
            onSearch={() => { onSearch(); onClose(); }}
            filter={filter}
            onFilter={onFilter}
            filterOptions={filterOptions}
            results={results}
            counts={counts}
            onShortcuts={onShortcuts}
            provenanceMode={provenanceMode}
            changes={changes}
            fresh={fresh}
          />
        ) : (
          <Sidebar
            current={current}
            goals={goals}
            openItems={openItems}
            findings={findings}
            inbox={inbox}
            selectedId={selectedId}
            visibleIds={visibleIds}
            counts={counts}
            onSelect={onSelect}
            onSearch={() => { onSearch(); if (window.innerWidth < 1024) onClose(); }}
            onShortcuts={onShortcuts}
            filter={filter}
            onFilter={onFilter}
            filterOptions={filterOptions}
            results={results}
          />
        )}
      </aside>
    </>
  );
}
