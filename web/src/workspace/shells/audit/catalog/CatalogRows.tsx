import { cn } from '@/lib/utils';
import { TypeDot } from '../../../../canvas/SecurityNode';
import { SeverityBadge } from '../../../../SeverityBadge';
import { t } from '../../../../i18n';
import { nodeAccent, presentNode, typeLabel } from '../../../../presentation';
import type { BoardNode } from '../../../../types';
import type { AuditIndex } from '../../../audit';
import type { NodeChange } from '../../../use-workspace-presentation';
import { ChangeDeltaBadge, ConfidencePill, isRetiredNode, PostureBadge, type CssVars } from '../shared';

export function DialecticalMicroPulse({ node, index }: { node: BoardNode; index: AuditIndex }) {
  const args = index.arguments.get(node.id);
  const supports = args?.support.length ?? 0;
  const contradictions = args?.contradiction.length ?? 0;
  if (supports === 0 && contradictions === 0) return null;
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[10.5px] tabular-nums">
      {supports > 0 && <span className="font-medium text-(--rel-support)" title={t('audit.support')}>+{supports}</span>}
      {contradictions > 0 && <span className="font-semibold text-(--rel-oppose)" title={t('audit.contradiction')}>−{contradictions}</span>}
    </span>
  );
}

export function CandidateTreeRow({
  node,
  index,
  active,
  showProvenance = true,
  multiActor,
  change,
  isFresh,
  onOpen,
}: {
  node: BoardNode;
  index: AuditIndex;
  active: boolean;
  showProvenance?: boolean;
  multiActor: boolean;
  change?: NodeChange;
  isFresh?: boolean;
  onOpen: (node: BoardNode) => void;
}) {
  const retired = isRetiredNode(node);
  const { headline } = presentNode(node);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onOpen(node)}
      title={node.title}
      style={{ '--c': nodeAccent(node.type) } as CssVars}
      className={cn(
        'relative flex w-full flex-col gap-1.5 rounded-lg border py-1.5 pr-2 pl-2.5 text-left text-xs outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-strong bg-card shadow-xs'
          : 'border-transparent hover:border-border/80 hover:bg-accent/55',
        isFresh && 'fresh-pulse',
      )}
    >
      {active && <i aria-hidden="true" className="absolute bottom-1.5 left-0 top-1.5 w-[2.5px] rounded-r-full bg-(--c)" />}
      <span className="flex w-full items-start justify-between gap-1.5">
        <span className={cn(
          'min-w-0 flex-1 line-clamp-2 text-[12.5px] leading-[18px]',
          active ? 'font-medium text-foreground' : 'text-foreground/95',
          retired && 'text-muted-foreground line-through decoration-muted-foreground/45 decoration-1',
        )}>
          {headline}
        </span>
        <DialecticalMicroPulse node={node} index={index} />
      </span>
      <span className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
        <span className="font-mono">{node.id}</span>
        <ChangeDeltaBadge change={change} compact />
        {node.severity && <SeverityBadge severity={node.severity} className="px-1 py-0 text-[10px]" />}
        <ConfidencePill confidence={node.confidence} compact />
        <PostureBadge provenance={index.provenance.get(node.id)} multiActor={multiActor} show={showProvenance} compact />
      </span>
    </button>
  );
}

export function RecordRow({
  node,
  index,
  selected,
  onPick,
}: {
  node: BoardNode;
  index: AuditIndex;
  selected: boolean;
  onPick: (node: BoardNode) => void;
}) {
  const retired = isRetiredNode(node);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onPick(node)}
      title={node.title}
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'bg-card shadow-2xs ring-1 ring-border',
      )}
    >
      <TypeDot type={node.type} className={cn('mt-1.5 shrink-0', retired && 'opacity-50')} />
      <span className="min-w-0 flex-1">
        <span className={cn('line-clamp-2 leading-4 text-foreground', retired && 'text-muted-foreground line-through decoration-muted-foreground/45')}>
          {presentNode(node).headline}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1 text-[10.5px] text-muted-foreground">
          <span>{typeLabel(node.type)}</span>
          <span className="font-mono">{node.id}</span>
          {node.severity && <SeverityBadge severity={node.severity} className="px-1 py-0 text-[10px]" />}
          <ConfidencePill confidence={node.confidence} compact />
          <DialecticalMicroPulse node={node} index={index} />
        </span>
      </span>
    </button>
  );
}
