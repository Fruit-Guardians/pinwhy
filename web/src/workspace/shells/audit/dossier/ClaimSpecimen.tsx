import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TypeDot } from '../../../../canvas/SecurityNode';
import { t } from '../../../../i18n';
import { nodeAccent, presentNode, typeLabel } from '../../../../presentation';
import type { BoardNode } from '../../../../types';
import { recordActor, type AuditProvenance } from '../../../audit';
import type { NodeChange } from '../../../use-workspace-presentation';
import {
  ChangeDeltaBadge,
  formatActorName,
  isRetiredNode,
  LocationChip,
  OrthogonalReadout,
  PostureBadge,
  renderInlineCode,
  StatusPill,
  type CssVars,
} from '../shared';

export function ClaimSpecimen({
  node,
  selected,
  provenance,
  showProvenance = true,
  multiActor = false,
  actors = [],
  spotlightActor = null,
  change,
  isFresh,
  onSpotlightActor,
  onSelect,
  onClearSelection,
}: {
  node: BoardNode;
  selected: boolean;
  provenance?: AuditProvenance;
  showProvenance?: boolean;
  multiActor?: boolean;
  actors?: string[];
  spotlightActor?: string | null;
  change?: NodeChange;
  isFresh?: boolean;
  onSpotlightActor?: (actor: string | null) => void;
  onSelect: (id: string) => void;
  onClearSelection?: () => void;
}) {
  const { headline, summary, detail } = presentNode(node);
  const retired = isRetiredNode(node);
  const proposer = recordActor(node);
  const showSpotlightBar = showProvenance && Boolean(onSpotlightActor) && multiActor && actors.length > 1;

  const toggleInspect = () => {
    if (selected && onClearSelection) onClearSelection();
    else onSelect(node.id);
  };

  return (
    <div
      style={{ '--c': nodeAccent(node.type) } as CssVars}
      className={cn(
        'relative rounded-xl border bg-card p-4 transition-all',
        selected ? 'border-foreground/35 shadow-sm' : 'shadow-xs',
        isFresh && 'fresh-pulse',
      )}
    >
      <i aria-hidden="true" className={cn('absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-(--c)', retired && 'opacity-45')} />
      <div className="flex flex-col gap-3.5 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div className="min-w-0 flex-1 pl-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <TypeDot type={node.type} className="size-1.5" />
              {typeLabel(node.type)}
            </span>
            <span className="rounded border bg-secondary/70 px-1.5 py-0 font-mono text-[10.5px]">{node.id}</span>
            <ChangeDeltaBadge change={change} compact />
            {retired && <StatusPill status={node.status} compact />}
            <PostureBadge provenance={provenance} multiActor={multiActor} show={showProvenance} />
            {showProvenance && multiActor && proposer && !showSpotlightBar && (
              <span className="rounded border bg-secondary/50 px-1.5 py-0 font-mono text-[10px]">
                {formatActorName(proposer)}
              </span>
            )}
          </div>

          <h3 className={cn(
            'm-0 mt-1.5 text-base font-semibold leading-6 tracking-[-0.01em]',
            retired ? 'text-foreground/80' : 'text-foreground',
          )}>
            {headline}
          </h3>

          {summary && (
            <p className="m-0 mt-1 whitespace-pre-wrap text-[12.5px] leading-5 text-subtle [overflow-wrap:anywhere]">
              {renderInlineCode(summary)}
            </p>
          )}
          {detail && (
            <p className="m-0 mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {renderInlineCode(detail)}
            </p>
          )}

          <LocationChip node={node} />
        </div>

        <div className="flex shrink-0 flex-wrap items-start gap-2 @2xl:flex-col @2xl:items-end">
          <OrthogonalReadout node={node} />
          <Button
            type="button"
            size="sm"
            variant={selected ? 'outline' : 'ghost'}
            aria-pressed={selected}
            onClick={toggleInspect}
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {selected ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
            {t('audit.inspectRoot')}
          </Button>
        </div>
      </div>

      {showSpotlightBar && onSpotlightActor && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2.5 pl-1.5 text-[11px]">
          <span className="font-medium text-muted-foreground">{t('audit.spotlightLabel')}：</span>
          <button
            type="button"
            aria-pressed={spotlightActor === null}
            onClick={() => onSpotlightActor(null)}
            className={cn(
              'rounded-md border px-2 py-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              spotlightActor === null
                ? 'border-foreground bg-secondary font-semibold text-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t('audit.spotlightAll', { n: actors.length })}
          </button>
          {actors.map((actor) => {
            const active = spotlightActor === actor;
            const isProposer = actor === proposer;
            return (
              <button
                key={actor}
                type="button"
                aria-pressed={active}
                onClick={() => onSpotlightActor(active ? null : actor)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-foreground bg-secondary font-semibold text-foreground'
                    : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="font-mono">{formatActorName(actor)}</span>
                {isProposer && <span className="text-[10px] opacity-75">({t('audit.proposerTag')})</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
