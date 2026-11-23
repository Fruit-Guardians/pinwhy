import type {
  BoardEdge,
  BoardNode,
  UltraSlice,
  UltraSliceStatus,
  UltraSnapshot,
} from '../../types';

export type UltraLens = 'constellation' | 'treemap' | 'gaps' | 'surface' | 'chains';
export type UltraFilter = 'all' | 'zero-node' | 'blind' | 'hits' | 'primitives' | 'awakened' | 'human';
export type BeaconTone = 'critical' | 'hot' | 'amber' | 'human';

export type UltraBeacon = {
  nodeId: string;
  tone: BeaconTone;
  title: string;
  type: string;
};

export type UltraOrbitalBar = {
  id: string;
  kind: 'slice' | 'node';
  sector: string;
  label: string;
  shortLabel: string;
  rangeLabel: string;
  sublabel: string;
  lines: number;
  status: UltraSliceStatus;
  shallowReason?: string | null;
  weight: number;
  angle: number;
  slice?: UltraSlice;
  nodeIds: string[];
  primaryNodeId: string | null;
  beacons: UltraBeacon[];
  matchesFilter: boolean;
};

export type UltraSectorView = {
  sector: string;
  parentSector?: string;
  index: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  bars: UltraOrbitalBar[];
  totalSlices: number;
  totalLines: number;
  coveredSlices: number;
  pendingSlices: number;
  staleSlices: number;
  shallowSlices: number;
  flaggedSlices: number;
  nodeIds: string[];
  findingsCount: number;
  openCount: number;
  primitivesCount: number;
  humanCount: number;
  matchesFilter: boolean;
};

export type UltraChord = {
  id: string;
  kind: string;
  label: string;
  sourceSector: string;
  targetSector: string;
  sourceAngle: number;
  targetAngle: number;
  sourceIndex: number;
  targetIndex: number;
  laneIndex: number;
  fromId: string;
  toId: string;
  sourceNodeId: string | null;
  targetNodeId: string | null;
  isChain: boolean;
  isAwakened?: boolean;
};

export type UltraSatellite = {
  agentId: string;
  shortName: string;
  nodeId: string;
  sector: string;
  angle: number;
};

export type UltraNextWave = {
  sector: string;
  totalLines: number;
  slices: UltraSlice[];
};

export type UltraSliceMicroGraph = {
  center: UltraOrbitalBar;
  callers: UltraOrbitalBar[];
  callees: UltraOrbitalBar[];
  linkedNodes: BoardNode[];
};

export type UltraIntraLink = {
  id: string;
  fromId: string;
  toId: string;
  fromAngle: number;
  toAngle: number;
  sector: string;
  unverified: boolean;
};

export type UltraModel = {
  sourceMode: 'ledger' | 'board-derived';
  initialized: boolean;
  title: string;
  scope: string | null;
  goal: BoardNode | null;
  breadthComplete: boolean;
  commitmentComplete: boolean;
  allClear: boolean;
  sectors: UltraSectorView[];
  displaySectors: UltraSectorView[];
  displaySectorMap: Map<string, UltraSectorView>;
  displayBars: UltraOrbitalBar[];
  multiSlicePaths: Set<string>;
  bars: UltraOrbitalBar[];
  chords: UltraChord[];
  displayChords: UltraChord[];
  displayIntraLinks: UltraIntraLink[];
  busLaneCount: number;
  satellites: UltraSatellite[];
  nextWave: UltraNextWave | null;
  nodeSectorMap: Map<string, string>;
  sliceSectorMap: Map<string, string>;
  sliceDisplaySectorMap: Map<string, string>;
  nodeDisplaySectorMap: Map<string, string>;
  barById: Map<string, UltraOrbitalBar>;
  sectorMap: Map<string, UltraSectorView>;
  byId: Map<string, BoardNode>;
  allNodes: BoardNode[];
  allEdges: BoardEdge[];
  gaps: UltraSnapshot['gaps'];
  metrics: {
    totalSlices: number;
    clearedSlices: number;
    zeroNodeCleared: number;
    flaggedSlices: number;
    shallowSlices: number;
    pendingSlices: number;
    totalLines: number;
    pendingLines: number;
    boardNodesCount: number;
    blindSpots: number;
    openThreads: number;
    findings: number;
    primitives: number;
    awakenedChains: number;
    humanSignals: number;
    coverageRatio: number;
  };
};
