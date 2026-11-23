import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BoardNode } from '../../../../types';
import { AUDIT_BATCH, type AuditExpansionAction, type AuditIndex, type AuditPage } from '../../../audit';
import { AuditPageControls } from '../shared';
import { RecordRow } from './CatalogRows';

export function CatalogDrawerSection({
  page,
  label,
  defaultLimit = AUDIT_BATCH,
  controlledOpen,
  index,
  selectedId,
  candidateId,
  onPick,
  onExpand,
}: {
  page: AuditPage<BoardNode>;
  label: string;
  defaultLimit?: number;
  controlledOpen?: { open: boolean; onToggle: () => void };
  index: AuditIndex;
  selectedId: string | null;
  candidateId?: string | null;
  onPick: (node: BoardNode) => void;
  onExpand: (key: string, action: AuditExpansionAction, defaultLimit?: number) => void;
}) {
  const isOpen = controlledOpen ? controlledOpen.open && page.open : page.open;

  return (
    <section aria-label={label} className="border-t pt-1.5">
      <button
        type="button"
        aria-label={`${label} · ${page.total}`}
        aria-expanded={isOpen}
        onClick={() => {
          if (controlledOpen) {
            const next = !isOpen;
            controlledOpen.onToggle();
            if (next && !page.open) onExpand(page.key, 'more', 0);
          } else {
            onExpand(page.key, 'toggle', defaultLimit);
          }
        }}
        className="flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight aria-hidden="true" className={cn('size-3 shrink-0 transition-transform', isOpen && 'rotate-90')} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="rounded bg-secondary/70 px-1.5 py-0 font-mono text-[10.5px] tabular-nums font-normal">{page.total}</span>
      </button>
      {isOpen && (
        <div className="mt-1 space-y-1">
          <AuditPageControls page={page} label={label} defaultLimit={defaultLimit} onExpand={onExpand} />
          <div className="flex flex-col gap-0.5">
            {page.items.map((item) => (
              <RecordRow
                key={item.id}
                node={item}
                index={index}
                selected={selectedId === item.id || candidateId === item.id}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
