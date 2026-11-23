import { useEffect } from 'react';
import { isAuditIssue, type AuditSelection } from './audit';
import type { BoardNode, WorkspaceMode } from '../types';

type NavigatePatch = {
  workspace?: WorkspaceMode;
  issueId?: string | null;
  candidateId?: string | null;
  node?: string | null;
};

type Options = {
  auditMode: boolean;
  audit: AuditSelection | null;
  auditGraphOpen: boolean;
  setAuditGraphOpen: (next: boolean) => void;
  issueId: string | null;
  candidateId: string | null;
  selectedId: string | null;
  navigateWorkspace: (patch: NavigatePatch) => void;
  clearSelection: () => void;
  closeSidebar: () => void;
  runTransition: (apply: () => void) => void;
};

/** Audit dossier/graph surface switching and issue/candidate stepping state. */
export function useAuditNavigation({
  auditMode,
  audit,
  auditGraphOpen,
  setAuditGraphOpen,
  issueId,
  candidateId,
  selectedId,
  navigateWorkspace,
  clearSelection,
  closeSidebar,
  runTransition,
}: Options) {
  const canShowAuditGraph = Boolean(audit && (audit.root || selectedId || audit.records.length === 1));
  const showAuditGraph = auditMode && auditGraphOpen && canShowAuditGraph;

  const switchAuditSurface = (next?: boolean) => {
    const target = typeof next === 'boolean' ? next : !auditGraphOpen;
    if (target !== auditGraphOpen) runTransition(() => setAuditGraphOpen(target));
  };

  const openAuditArgument = (node: BoardNode, parentIssueId?: string) => {
    if (isAuditIssue(node)) {
      navigateWorkspace({ issueId: node.id, candidateId: null, node: null });
    } else if (parentIssueId !== undefined) {
      navigateWorkspace({ issueId: parentIssueId, candidateId: node.id, node: null });
    } else {
      navigateWorkspace({ candidateId: node.id, node: null });
    }
    clearSelection();
    if (window.innerWidth < 1024) closeSidebar();
  };

  const chooseIssue = (id: string | null) => {
    if (id === null) setAuditGraphOpen(false);
    navigateWorkspace({ issueId: id, candidateId: null, node: null });
    clearSelection();
  };

  const chooseCandidate = (id: string | null) => {
    navigateWorkspace({ candidateId: id, node: null });
    clearSelection();
  };

  const auditCandidateList = audit ? (audit.issue ? audit.members : audit.candidates) : [];
  const auditCandidateIdx = audit?.candidate
    ? auditCandidateList.findIndex((item) => item.id === audit.candidate?.id)
    : -1;

  const stepAuditCandidate = (delta: 1 | -1) => {
    if (!auditCandidateList.length) return;
    if (auditCandidateIdx < 0) {
      const target = delta > 0 ? auditCandidateList[0] : auditCandidateList[auditCandidateList.length - 1];
      if (target) chooseCandidate(target.id);
      return;
    }
    const next = auditCandidateList[auditCandidateIdx + delta];
    if (next) chooseCandidate(next.id);
  };

  // A single authored issue should open immediately so the dossier is not an empty shell.
  // Omit `node` so an incoming ?node= deep link stays selected, and intentionally track navigation triggers only.
  useEffect(() => {
    if (!auditMode || !audit || issueId || candidateId || audit.issues.length !== 1) return;
    const sole = audit.issues[0];
    navigateWorkspace({ issueId: sole.id, candidateId: null });
  }, [auditMode, audit, issueId, candidateId]);

  return {
    auditGraphOpen,
    setAuditGraphOpen,
    canShowAuditGraph,
    showAuditGraph,
    switchAuditSurface,
    openAuditArgument,
    chooseIssue,
    chooseCandidate,
    stepAuditCandidate,
  };
}
