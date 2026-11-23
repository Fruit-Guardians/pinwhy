import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { getNodesBounds, getViewportForBounds, useNodesInitialized, useReactFlow, type Edge } from '@xyflow/react';
import { focusedIds, frameStrategy, pickFocus } from '../canvas/canvas-state';
import { absolutePosition, NODE_H, NODE_W, type CanvasNode } from '../canvas/graph';
import type { ViewMode } from '../types';
import type { MotionMode } from '../view-transition';

type Options = {
  viewportRef: RefObject<HTMLDivElement | null>;
  canvasRef?: RefObject<HTMLDivElement | null>;
  canvasActive?: boolean;
  fitAll?: boolean;
  inspectorWidth?: number;
  pendingFocus: RefObject<string | null>;
  layoutRevision: number;
  mode: ViewMode;
  follow: boolean;
  currentId: string | null;
  selectedId: string | null;
  motionMode?: MotionMode;
};

/** Framing and following move the reader's viewport, never the recorded agent cursor. */
export function useWorkspaceViewport({
  viewportRef,
  canvasRef,
  canvasActive = true,
  fitAll = false,
  inspectorWidth = 380,
  pendingFocus,
  layoutRevision,
  mode,
  follow,
  currentId,
  selectedId,
  motionMode = 'fluid',
}: Options) {
  const initialized = useNodesInitialized();
  const { fitView, getNode, getNodes, setCenter, setViewport } = useReactFlow<CanvasNode>();
  const framedRevision = useRef(0);
  const lastCurrent = useRef<string | null>(null);
  const prevInspectorOpen = useRef(Boolean(selectedId));
  const live = useRef({ follow: false, currentId: null as string | null, selectedId: null as string | null });
  const [osReduced, setOsReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motion = osReduced || motionMode === 'reduced' ? 0 : 350;
  live.current = { follow: follow && mode !== 'all', currentId, selectedId };

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setOsReduced(preference.matches); };
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!canvasActive) framedRevision.current = 0;
  }, [canvasActive]);

  const measureBox = useCallback(() => canvasRef?.current ?? viewportRef.current, [canvasRef, viewportRef]);

  const centerOnNode = useCallback((id: string, reserveInspector = true, duration = motion) => {
    const node = getNode(id);
    if (!node) return;
    const width = measureBox()?.clientWidth || 700;
    // The desktop inspector floats over the right edge; centre in the remaining space.
    const overlay = reserveInspector && width >= 640 ? Math.min(inspectorWidth + 24, width * .5) : 0;
    const zoom = Math.min(1, Math.max(.55, (width - overlay) / (NODE_W + 48)));
    const pos = absolutePosition(node, getNode);
    setCenter(
      pos.x + (node.data.compact ? 120 : NODE_W / 2) + overlay / (2 * zoom),
      pos.y + Number(node.style?.height || NODE_H) / 2,
      { zoom, duration },
    );
  }, [getNode, setCenter, measureBox, inspectorWidth, motion]);

  const fitBoard = useCallback((reserveInspector = false, duration = motion) => {
    const cards = getNodes().filter((node) => !node.data.group);
    const box = measureBox();
    if (!cards.length || !box || !box.clientWidth || !box.clientHeight) {
      fitView({ padding: .14, duration, minZoom: .08, maxZoom: 1 });
      return;
    }
    const overlay = reserveInspector && box.clientWidth >= 640 ? Math.min(inspectorWidth + 24, box.clientWidth * 0.5) : 0;
    const availW = Math.max(240, box.clientWidth - overlay);
    const vp = getViewportForBounds(getNodesBounds(cards), availW, box.clientHeight, 0.08, 1, 0.14);
    setViewport(vp, { duration });
  }, [getNodes, measureBox, inspectorWidth, fitView, setViewport, motion]);

  useEffect(() => {
    if (!canvasActive || !initialized || !layoutRevision || framedRevision.current === layoutRevision) return;
    const frame = requestAnimationFrame(() => {
      const duration = framedRevision.current === 0 ? 0 : motion;
      framedRevision.current = layoutRevision;
      if (fitAll) {
        pendingFocus.current = null;
        fitBoard(Boolean(live.current.selectedId), duration);
        return;
      }
      const following = live.current.follow && live.current.currentId && getNode(live.current.currentId) ? live.current.currentId : null;
      // A view switch can leave a requested node waiting for the next layout.
      const requested = pendingFocus.current && getNode(pendingFocus.current) ? pendingFocus.current : null;
      if (requested) {
        centerOnNode(requested, true, duration);
        pendingFocus.current = null;
      } else if (following) centerOnNode(following, Boolean(live.current.selectedId), duration);
      else {
        const cards = getNodes().filter((node) => !node.data.group);
        const box = measureBox();
        const fitZoom = mode !== 'all' && cards.length && box
          ? getViewportForBounds(getNodesBounds(cards), box.clientWidth, box.clientHeight, .08, 1, .14).zoom
          : 1;
        const start = frameStrategy(fitZoom) === 'focus'
          ? pickFocus(cards.map((node) => ({ id: node.id, degree: node.data.degree, ts: node.data.item.ts })), live.current.currentId)
          : null;
        if (start) centerOnNode(start, false, duration);
        else fitView({ padding: .14, duration, minZoom: .08, maxZoom: 1 });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [canvasActive, initialized, layoutRevision, fitAll, fitBoard, centerOnNode, fitView, getNode, getNodes, mode, motion, pendingFocus, measureBox]);

  useEffect(() => {
    const inspectorOpen = Boolean(selectedId);
    const changed = inspectorOpen !== prevInspectorOpen.current;
    prevInspectorOpen.current = inspectorOpen;
    if (!fitAll || !canvasActive || !initialized || !changed || framedRevision.current !== layoutRevision) return;
    const frame = requestAnimationFrame(() => fitBoard(inspectorOpen, motion));
    return () => cancelAnimationFrame(frame);
  }, [fitAll, canvasActive, initialized, selectedId, layoutRevision, fitBoard, motion]);

  useEffect(() => {
    const previous = lastCurrent.current;
    lastCurrent.current = currentId;
    if (fitAll || !currentId || previous === currentId || !follow || mode === 'all') return;
    const frame = requestAnimationFrame(() => centerOnNode(currentId, Boolean(live.current.selectedId)));
    return () => cancelAnimationFrame(frame);
  }, [fitAll, currentId, follow, mode, centerOnNode]);

  const fitCanvas = useCallback(() => {
    if (fitAll) fitBoard(Boolean(live.current.selectedId), motion);
    else fitView({ padding: .14, duration: motion });
  }, [fitAll, fitBoard, fitView, motion]);

  const focusNeighborhood = useCallback((id: string, currentEdges: Edge[]) => {
    const ids = focusedIds(id, currentEdges);
    const all = getNodes();
    const byNodeId = new Map(all.map((node) => [node.id, node]));
    const targets = all
      .filter((node) => !node.data.group && ids.has(node.id))
      .map((node) => (node.parentId ? { ...node, position: absolutePosition(node, byNodeId) } : node));
    if (targets.length <= 1) {
      centerOnNode(id, true, motion);
      return;
    }
    const box = measureBox();
    const width = box?.clientWidth || 900;
    const height = box?.clientHeight || 640;
    const overlay = width >= 640 ? Math.min(430, width * 0.48) : 0;
    const vp = getViewportForBounds(getNodesBounds(targets), Math.max(240, width - overlay), height, 0.22, 0.96, 0.18);
    setViewport(vp, { duration: motion });
  }, [getNodes, centerOnNode, motion, measureBox, setViewport]);

  return { centerOnNode, fitCanvas, focusNeighborhood, motion };
}
