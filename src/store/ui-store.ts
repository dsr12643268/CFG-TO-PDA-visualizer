// ============================================================
// ANTIGRAVITY — UI Store (Zustand)
// Panel visibility, mode toggle, UI preferences
// ============================================================

import { create } from 'zustand';

export type AppMode = 'cfg-to-pda' | 'pda-to-cfg' | 'theory';
export type ActivePanel = 'derivation' | 'state-space' | 'stack';

export interface UIStore {
  // App mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  // Input viewing toggle (CFG vs PDA)
  inputMode: 'cfg' | 'pda';
  setInputMode: (m: 'cfg' | 'pda') => void;

  // Preprocessing panel
  preprocessingPanelOpen: boolean;
  togglePreprocessingPanel: () => void;

  // Active simulation panel (for mobile/focus mode)
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;

  // BFS tree display
  showVisitedNodes: boolean;
  toggleShowVisitedNodes: () => void;

  // Help modal
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;

  // Stress test modal
  stressTestOpen: boolean;
  setStressTestOpen: (open: boolean) => void;

  // Theme/display
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  mode: 'cfg-to-pda',
  setMode: (mode) => set({ mode }),
  inputMode: 'cfg',
  setInputMode: (inputMode) => set({ inputMode }),

  preprocessingPanelOpen: false,
  togglePreprocessingPanel: () => set(s => ({ preprocessingPanelOpen: !s.preprocessingPanelOpen })),

  activePanel: 'state-space',
  setActivePanel: (activePanel) => set({ activePanel }),

  showVisitedNodes: true,
  toggleShowVisitedNodes: () => set(s => ({ showVisitedNodes: !s.showVisitedNodes })),

  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),

  stressTestOpen: false,
  setStressTestOpen: (stressTestOpen) => set({ stressTestOpen }),

  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
