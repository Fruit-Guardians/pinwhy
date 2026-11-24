import { t } from '../../../../i18n';
import { buildSliceMicroGraph, type UltraModel, type UltraOrbitalBar } from '../../../ultra';

function nodeToneStroke(bar: UltraOrbitalBar): string {
  if (bar.status === 'flagged' || bar.status === 'stale') return 'var(--u-crimson)';
  if (bar.status === 'shallow') return 'var(--u-amber)';
  if (bar.status === 'cleared') return 'var(--u-mint)';
  return 'var(--u-tick)';
}

function fitSvgText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 4) return text.slice(0, maxChars);
  return `${text.slice(0, maxChars - 1)}…`;
}

export function DependencyMicroGraph({
  model,
  sliceId,
  onSelectBar,
}: {
  model: UltraModel;
  sliceId: string;
  onSelectBar: (bar: UltraOrbitalBar) => void;
}) {
  const graph = buildSliceMicroGraph(model, sliceId);
  if (!graph) return null;
  const { center, callers, callees } = graph;
  const hasDeps = callers.length > 0 || callees.length > 0;
  const width = 348;
  const topCallers = callers.slice(0, 3);
  const topCallees = callees.slice(0, 3);

  const rowY = {
    callers: 16,
    center: topCallers.length ? 76 : 16,
    callees: topCallers.length ? 138 : 80,
  };
  const svgH = topCallees.length ? rowY.callees + 38 : rowY.center + 38;

  const spreadX = (count: number, boxW: number) => {
    if (count === 1) return [width / 2 - boxW / 2];
    if (count === 2) return [16, width - 16 - boxW];
    return [4, width / 2 - boxW / 2, width - 4 - boxW];
  };

  const callerW = topCallers.length >= 3 ? 108 : 144;
  const calleeW = topCallees.length >= 3 ? 108 : 144;
  const callerXs = spreadX(topCallers.length, callerW);
  const calleeXs = spreadX(topCallees.length, calleeW);
  const centerW = 216;
  const centerX = width / 2 - centerW / 2;

  const chipText = (bar: UltraOrbitalBar, boxW: number) => {
    const file = bar.shortLabel.split('/').pop() || bar.shortLabel;
    const maxChars = boxW >= 200 ? 22 : boxW >= 140 ? 15 : 10;
    return `${bar.id}·${fitSvgText(file, maxChars)}`;
  };

  return (
    <div className="mb-3 rounded-lg border border-[var(--u-line)] bg-[var(--u-bg)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="ultra-mono text-[10.5px] uppercase tracking-wider text-[var(--u-dim)]">
          {t('ultra.micrograph.title')} · {center.id}
        </span>
        <span
          className="ultra-mono text-[10.5px]"
          style={{
            color:
              center.slice?.dependencyCycle?.length || center.slice?.unverifiedDependencies?.length
                ? 'var(--u-amber)'
                : hasDeps
                  ? 'var(--u-mint)'
                  : 'var(--u-dim)',
          }}
        >
          {center.slice?.dependencyCycle?.length
            ? t('ultra.micrograph.cycle')
            : center.slice?.unverifiedDependencies?.length
              ? t('ultra.micrograph.unverified')
              : hasDeps
                ? t('ultra.micrograph.verified')
                : t('ultra.micrograph.none')}
        </span>
      </div>

      {hasDeps ? (
        <svg width="100%" viewBox={`0 0 ${width} ${svgH}`} className="block overflow-visible">
          <defs>
            <marker id="u-micro-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--u-dim)" />
            </marker>
          </defs>

          {topCallers.map((caller, idx) => {
            const sx = callerXs[idx] + callerW / 2;
            const sy = rowY.callers + 30;
            return (
              <path
                key={`e:in:${caller.id}`}
                d={`M ${sx} ${sy} L ${width / 2} ${rowY.center}`}
                fill="none"
                stroke={nodeToneStroke(caller)}
                strokeOpacity={0.8}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                className="ultra-trace-flow"
                markerEnd="url(#u-micro-arr)"
              />
            );
          })}

          {topCallees.map((callee, idx) => {
            const tx = calleeXs[idx] + calleeW / 2;
            const ty = rowY.callees;
            return (
              <path
                key={`e:out:${callee.id}`}
                d={`M ${width / 2} ${rowY.center + 32} L ${tx} ${ty}`}
                fill="none"
                stroke={nodeToneStroke(callee)}
                strokeOpacity={0.8}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                className="ultra-trace-flow"
                markerEnd="url(#u-micro-arr)"
              />
            );
          })}

          {topCallers.map((caller, idx) => {
            const x = callerXs[idx];
            const y = rowY.callers;
            return (
              <g key={`c:${caller.id}`} className="group cursor-pointer" onClick={() => onSelectBar(caller)}>
                <rect
                  x={x}
                  y={y}
                  width={callerW}
                  height={30}
                  rx={5}
                  fill="var(--u-raise)"
                  stroke={nodeToneStroke(caller)}
                  strokeWidth={1.1}
                  className="transition-all duration-150 group-hover:brightness-110"
                />
                <text x={x + callerW / 2} y={y + 19} textAnchor="middle" fill="var(--u-ink)" fontSize={10} className="ultra-mono">
                  {chipText(caller, callerW)}
                </text>
              </g>
            );
          })}

          <g>
            <rect x={centerX} y={rowY.center} width={centerW} height={32} rx={5} fill="var(--u-raise-2)" stroke="var(--u-ink)" strokeWidth={1.5} />
            <text x={width / 2} y={rowY.center + 20} textAnchor="middle" fill="var(--u-ink)" fontSize={10.5} fontWeight={600} className="ultra-mono">
              {chipText(center, centerW)}
            </text>
          </g>

          {topCallees.map((callee, idx) => {
            const x = calleeXs[idx];
            const y = rowY.callees;
            return (
              <g key={`o:${callee.id}`} className="group cursor-pointer" onClick={() => onSelectBar(callee)}>
                <rect
                  x={x}
                  y={y}
                  width={calleeW}
                  height={30}
                  rx={5}
                  fill="var(--u-raise)"
                  stroke={nodeToneStroke(callee)}
                  strokeWidth={1.1}
                  className="transition-all duration-150 group-hover:brightness-110"
                />
                <text x={x + calleeW / 2} y={y + 19} textAnchor="middle" fill="var(--u-ink)" fontSize={10} className="ultra-mono">
                  {chipText(callee, calleeW)}
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}
