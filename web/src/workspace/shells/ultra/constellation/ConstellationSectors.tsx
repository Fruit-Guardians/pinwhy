import { t } from '../../../../i18n';
import { shortSectorLabel, type UltraModel, type UltraOrbitalBar, type UltraSectorView } from '../../../ultra';
import {
  CX,
  CY,
  R_HUB,
  R_INNER_1,
  R_INNER_2,
  R_LABEL,
  R_SLICE_1,
  R_SLICE_2,
  arcRingPath,
  polar,
  sliceAppearance,
  type AdjustedSectorLabel,
  type HoverTip,
} from './geometry';

export function ConstellationSectors({
  sectors,
  labels,
  model,
  pct,
  filterActive,
  selectedSector,
  selectedBarId,
  hoverBarId,
  hoverSec,
  guardClick,
  setHoverBarId,
  setHoverSec,
  setTip,
  onSelectSector,
  onSelectBar,
}: {
  sectors: UltraSectorView[];
  labels: AdjustedSectorLabel[];
  model: UltraModel;
  pct: number;
  filterActive: boolean;
  selectedSector: string | null;
  selectedBarId: string | null;
  hoverBarId: string | null;
  hoverSec: string | null;
  guardClick: () => boolean;
  setHoverBarId: (id: string | null) => void;
  setHoverSec: (sec: string | null) => void;
  setTip: (tip: HoverTip | null | ((prev: HoverTip | null) => HoverTip | null)) => void;
  onSelectSector: (sector: string) => void;
  onSelectBar: (bar: UltraOrbitalBar) => void;
}) {
  const hubRingR = R_HUB + 6;
  const hubCirc = 2 * Math.PI * hubRingR;
  const hubOffset = hubCirc * (1 - Math.max(0, Math.min(1, model.metrics.coverageRatio)));

  return (
    <>
      {sectors.map((sec) => {
        const doneRatio = sec.totalSlices > 0 ? sec.coveredSlices / sec.totalSlices : 0;
        const secSelected = selectedSector === sec.sector || hoverSec === sec.sector;
        const hasFindings = sec.findingsCount > 0 || sec.flaggedSlices > 0;
        const secSpan = sec.endAngle - sec.startAngle;
        const arcCol = hasFindings ? 'var(--u-crimson)' : 'var(--u-mint)';
        const arcFill = hasFindings ? 'var(--u-sector-hit-fill)' : 'var(--u-sector-ok-fill)';
        const sliceGap = Math.min(0.01, (secSpan * 0.22) / Math.max(1, sec.bars.length));
        const pad = Math.min(0.02, secSpan * 0.08);
        const sliceSpan = Math.max(0.012, (secSpan - pad * 2 - sliceGap * Math.max(0, sec.bars.length - 1)) / Math.max(1, sec.bars.length));

        return (
          <g key={sec.sector}>
            <g
              data-slice-interactive="sector"
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                setHoverSec(sec.sector);
                setTip({
                  x: e.clientX,
                  y: e.clientY,
                  title: sec.sector,
                  subtitle: `${sec.coveredSlices}/${sec.totalSlices} ${t('ultra.metric.cleared')} · ${sec.totalLines}L · ${sec.findingsCount} ${t('ultra.metric.findings')}`,
                  accent: arcCol,
                });
              }}
              onMouseMove={(e) => setTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))}
              onMouseLeave={() => { setHoverSec(null); setTip(null); }}
              onClick={(e) => {
                e.stopPropagation();
                if (guardClick()) return;
                onSelectSector(sec.sector);
              }}
            >
              <path
                d={arcRingPath(CX, CY, R_INNER_1, R_INNER_2, sec.startAngle, sec.endAngle)}
                fill="var(--u-raise)"
                stroke={secSelected ? 'var(--u-cyan)' : 'var(--u-line)'}
                strokeWidth={secSelected ? 1.4 : 1}
              />
              {doneRatio > 0 && (
                <path
                  d={arcRingPath(CX, CY, R_INNER_1, R_INNER_2, sec.startAngle, sec.startAngle + secSpan * doneRatio)}
                  fill={arcFill}
                  stroke={arcCol}
                  strokeWidth={1.2}
                />
              )}
            </g>

            {sec.bars.map((bar, idx) => {
              const sa1 = sec.startAngle + pad + idx * (sliceSpan + sliceGap);
              const sa2 = sa1 + sliceSpan;
              const mid = (sa1 + sa2) / 2;
              const isSel = selectedBarId === bar.id;
              const isHov = hoverBarId === bar.id;
              const rOuter = isSel ? R_SLICE_2 + 12 : isHov ? R_SLICE_2 + 6 : R_SLICE_2;
              const { fill, opacity, outerColor, hasZeroNodes, hasHuman } = sliceAppearance(bar, isSel, isHov, filterActive);
              const pipPos = polar(CX, CY, rOuter + 9, mid);

              return (
                <g
                  key={bar.id}
                  data-slice-interactive="bar"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    setHoverBarId(bar.id);
                    setTip({
                      x: e.clientX,
                      y: e.clientY,
                      title: bar.label,
                      subtitle: `${t(`ultra.sliceStatus.${bar.status}`)}${hasZeroNodes ? ` · ${t('ultra.treemap.zeroBadge')}` : ` · ${bar.nodeIds.length} ${t('ultra.metric.nodes')}`}${bar.sublabel ? ` — ${bar.sublabel}` : ''}`,
                      accent: fill,
                    });
                  }}
                  onMouseMove={(e) => setTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))}
                  onMouseLeave={() => { setHoverBarId(null); setTip(null); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (guardClick()) return;
                    onSelectBar(bar);
                  }}
                >
                  <path
                    d={arcRingPath(CX, CY, R_SLICE_1, rOuter, sa1, sa2)}
                    fill={fill}
                    fillOpacity={opacity}
                    stroke={outerColor}
                    strokeWidth={isSel ? 2.2 : isHov ? 1.6 : 1.1}
                    className="ultra-arc-slice"
                  />
                  {bar.status === 'flagged' && (
                    <circle cx={pipPos.x} cy={pipPos.y} r={3.4} fill="var(--u-crimson)" opacity={opacity} />
                  )}
                  {hasHuman && (
                    <circle cx={pipPos.x} cy={pipPos.y} r={4.5} fill="none" stroke="var(--u-cyan)" strokeWidth={1.6} />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {labels.map(({ sector: sec, x, y, anchor }) => {
        const isSel = selectedSector === sec.sector || hoverSec === sec.sector;
        const dimmed = filterActive && !sec.matchesFilter;
        const countNote = sec.findingsCount > 0 ? `${sec.findingsCount} 命中` : sec.shallowSlices > 0 ? `${sec.shallowSlices} 浅审` : '0 异常';
        const tickStart = polar(CX, CY, R_SLICE_2 + 5, sec.midAngle);
        const tickEnd = polar(CX, CY, R_LABEL - 10, sec.midAngle);
        return (
          <g
            key={`lbl:${sec.sector}`}
            data-slice-interactive="label"
            style={{ cursor: 'pointer', opacity: dimmed ? 0.28 : 1, transition: 'opacity 0.18s ease' }}
            onClick={(e) => {
              e.stopPropagation();
              if (guardClick()) return;
              onSelectSector(sec.sector);
            }}
          >
            <line
              x1={tickStart.x}
              y1={tickStart.y}
              x2={tickEnd.x}
              y2={tickEnd.y}
              stroke={isSel ? 'var(--u-cyan)' : 'var(--u-tick)'}
              strokeWidth={isSel ? 1.3 : 0.9}
              strokeOpacity={isSel ? 0.9 : 0.65}
            />
            <text
              x={x}
              y={y}
              textAnchor={anchor}
              className="ultra-mono"
              fontSize={12}
              fontWeight={isSel ? 700 : 600}
              fill={isSel ? 'var(--u-cyan)' : 'var(--u-ink)'}
            >
              {shortSectorLabel(sec.sector)}
            </text>
            <text
              x={x}
              y={y + 15}
              textAnchor={anchor}
              className="ultra-mono"
              fontSize={10.5}
              fill={sec.findingsCount > 0 ? 'var(--u-crimson)' : 'var(--u-dim)'}
            >
              {sec.coveredSlices}/{sec.totalSlices} · {countNote}
            </text>
          </g>
        );
      })}

      <g>
        <circle cx={CX} cy={CY} r={R_HUB} fill="var(--u-surface)" stroke="var(--u-line)" strokeWidth={1.2} />
        <circle cx={CX} cy={CY} r={hubRingR} fill="none" stroke="var(--u-line-soft)" strokeWidth={2.8} />
        <circle
          cx={CX}
          cy={CY}
          r={hubRingR}
          fill="none"
          stroke={model.metrics.shallowSlices > 0 && model.metrics.coverageRatio === 1 ? 'var(--u-amber)' : 'var(--u-mint)'}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeDasharray={hubCirc}
          strokeDashoffset={hubOffset}
          transform={`rotate(-90 ${CX} ${CY})`}
          className="ultra-ring-progress"
        />
        <text x={CX} y={CY - 3} textAnchor="middle" fill="var(--u-ink)" fontSize={19} fontWeight={700} className="ultra-mono">
          {pct}%
        </text>
        <text x={CX} y={CY + 14} textAnchor="middle" fill="var(--u-dim)" fontSize={9.5} className="ultra-mono">
          {model.metrics.clearedSlices}/{model.metrics.totalSlices} SLICES
        </text>
      </g>
    </>
  );
}
