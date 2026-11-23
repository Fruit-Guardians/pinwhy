import {
  shortSectorLabel,
  type UltraChord,
  type UltraIntraLink,
  type UltraModel,
  type UltraOrbitalBar,
  type UltraSatellite,
} from '../../../ultra';
import { CX, CY, R_CHORD, R_SAT, R_SLICE_1, polar, type HoverTip } from './geometry';

export function ConstellationChords({
  chords,
  intraLinks,
  satellites,
  model,
  selectedSector,
  selectedBarId,
  selectedNodeId,
  hoverBarId,
  hoverSec,
  hoverChordId,
  guardClick,
  setHoverChordId,
  setTip,
  onSelectSector,
  onSelectBar,
  onSelectNode,
}: {
  chords: UltraChord[];
  intraLinks: UltraIntraLink[];
  satellites: UltraSatellite[];
  model: UltraModel;
  selectedSector: string | null;
  selectedBarId: string | null;
  selectedNodeId: string | null;
  hoverBarId: string | null;
  hoverSec: string | null;
  hoverChordId: string | null;
  guardClick: () => boolean;
  setHoverChordId: (id: string | null) => void;
  setTip: (tip: HoverTip | null | ((prev: HoverTip | null) => HoverTip | null)) => void;
  onSelectSector: (sector: string) => void;
  onSelectBar: (bar: UltraOrbitalBar) => void;
  onSelectNode: (nodeId: string, sector?: string) => void;
}) {
  return (
    <>
      {chords.map((chord) => {
        const p1 = polar(CX, CY, R_CHORD, chord.sourceAngle);
        const p2 = polar(CX, CY, R_CHORD, chord.targetAngle);
        const touchesSelected =
          (selectedSector && (chord.sourceSector === selectedSector || chord.targetSector === selectedSector)) ||
          (selectedBarId && (chord.fromId === selectedBarId || chord.toId === selectedBarId)) ||
          (selectedNodeId && (chord.sourceNodeId === selectedNodeId || chord.targetNodeId === selectedNodeId));
        const touchesHover = hoverChordId === chord.id || hoverSec === chord.sourceSector || hoverSec === chord.targetSector;
        const hot = Boolean(touchesSelected || touchesHover);
        const stroke = chord.isAwakened
          ? 'var(--u-amber)'
          : chord.kind === 'contradicts'
            ? 'var(--u-crimson)'
            : chord.kind === 'supports'
              ? 'var(--u-mint)'
              : 'var(--u-cyan)';

        return (
          <g
            key={chord.id}
            data-slice-interactive="chord"
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => {
              setHoverChordId(chord.id);
              setTip({
                x: e.clientX,
                y: e.clientY,
                title: `${shortSectorLabel(chord.sourceSector)} → ${shortSectorLabel(chord.targetSector)}`,
                subtitle: `${chord.kind}: ${chord.label}`,
                accent: stroke,
              });
            }}
            onMouseMove={(e) => setTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))}
            onMouseLeave={() => { setHoverChordId(null); setTip(null); }}
            onClick={(e) => {
              e.stopPropagation();
              if (guardClick()) return;
              if (chord.targetNodeId) onSelectNode(chord.targetNodeId, chord.targetSector);
              else {
                const targetBar = model.barById.get(chord.toId);
                if (targetBar) onSelectBar(targetBar);
                else onSelectSector(chord.targetSector);
              }
            }}
          >
            <path
              d={`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${CX} ${CY} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
            />
            <path
              d={`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${CX} ${CY} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`}
              fill="none"
              stroke={stroke}
              strokeWidth={hot ? 2.4 : 1.5}
              strokeOpacity={hot ? 0.96 : 0.62}
              strokeDasharray={chord.isAwakened ? '5 4' : undefined}
              className={hot ? 'ultra-trace-flow' : undefined}
            />
            <circle cx={p1.x} cy={p1.y} r={hot ? 3.8 : 2.8} fill={stroke} />
            <circle cx={p2.x} cy={p2.y} r={hot ? 3.8 : 2.8} fill={stroke} />
          </g>
        );
      })}

      {intraLinks.map((link) => {
        const focused =
          link.unverified ||
          selectedBarId === link.fromId ||
          selectedBarId === link.toId ||
          hoverBarId === link.fromId ||
          hoverBarId === link.toId ||
          selectedSector === link.sector;
        if (!focused) return null;
        const p1 = polar(CX, CY, R_SLICE_1 - 4, link.fromAngle);
        const p2 = polar(CX, CY, R_SLICE_1 - 4, link.toAngle);
        const midA = (link.fromAngle + link.toAngle) / 2;
        const ctrl = polar(CX, CY, R_CHORD + 10, midA);
        const stroke = link.unverified ? 'var(--u-amber)' : 'var(--u-cyan)';
        return (
          <path
            key={link.id}
            data-ultra-intra-link={link.id}
            d={`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${ctrl.x.toFixed(1)} ${ctrl.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`}
            fill="none"
            stroke={stroke}
            strokeWidth={link.unverified ? 1.7 : 2}
            strokeDasharray={link.unverified ? '4 4' : '6 4'}
            className="ultra-trace-flow pointer-events-none"
            opacity={0.92}
          />
        );
      })}

      {satellites.map((sat) => {
        const p = polar(CX, CY, R_SAT, sat.angle);
        return (
          <g
            key={sat.agentId}
            data-slice-interactive="sat"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (guardClick()) return;
              onSelectNode(sat.nodeId, sat.sector);
            }}
          >
            <circle cx={p.x} cy={p.y} r={6} fill="var(--u-sat-halo)" className="ultra-sat-ring" />
            <circle cx={p.x} cy={p.y} r={3.5} fill="var(--u-mint)" stroke="var(--u-bg)" strokeWidth={1.2} />
          </g>
        );
      })}
    </>
  );
}
