// ============================================================
// ANTIGRAVITY — Simulation Store (Zustand)
// Single shared cursor for all 3 simulation panels
// ALL panels read from this store — atomic updates only
// ============================================================

import { create } from 'zustand';
import type { SimulationCursor, Configuration, BFSEngineState } from '../engine/types';
import { createBFSEngine, bfsStep, computeStats, type BFSStats } from '../engine/bfs-engine';
import type { PDA } from '../engine/types';

export type SimulationMode = 'idle' | 'running' | 'paused' | 'done';

export interface TransitionHistoryEntry {
  step: number;
  rule: string;
  configId: string;
  stackBefore: string[];
  stackAfter: string[];
  remainingBefore: string;
  remainingAfter: string;
}

export interface SimulationStore {
  // ─── Cursor (shared across all 3 panels) ───────────────────
  cursor: SimulationCursor;
  setCursor: (cursor: SimulationCursor) => void;

  // ─── BFS Engine State ──────────────────────────────────────
  bfsState: BFSEngineState | null;
  inputString: string;
  setInputString: (s: string) => void;

  // ─── Simulation Controls ───────────────────────────────────
  mode: SimulationMode;
  speed: number; // 1 = 1x, 2 = 2x, etc.

  initSimulation: (pda: PDA, input: string) => void;
  stepForward: () => string[]; // returns new frontier IDs
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;

  // ─── Stats ─────────────────────────────────────────────────
  stats: BFSStats;

  // ─── Active Config for panel sync ─────────────────────────
  activeConfigId: string | null;
  setActiveConfig: (id: string | null) => void;

  // ─── Transition History (for Stack panel) ─────────────────
  transitionHistory: TransitionHistoryEntry[];
  addToHistory: (entry: TransitionHistoryEntry) => void;

  // ─── Accepting paths ──────────────────────────────────────
  acceptingPaths: string[][];
}

const DEFAULT_CURSOR: SimulationCursor = {
  remaining_input: '',
  stack_contents: [],
  last_rule_applied: '',
  activeConfigId: null,
  step: 0,
};

const DEFAULT_STATS: BFSStats = {
  total: 0,
  active: 0,
  accepting: 0,
  rejected: 0,
  visited: 0,
  depth: 0,
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  cursor: DEFAULT_CURSOR,
  bfsState: null,
  inputString: '',
  mode: 'idle',
  speed: 1,
  stats: DEFAULT_STATS,
  activeConfigId: null,
  transitionHistory: [],
  acceptingPaths: [],

  setCursor: (cursor) => set({ cursor }),

  setInputString: (s) => set({ inputString: s }),

  initSimulation: (pda, input) => {
    const bfsState = createBFSEngine(pda, input);
    const rootConfig = bfsState.rootId
      ? bfsState.configMap.get(bfsState.rootId)
      : null;

    set({
      bfsState,
      inputString: input,
      mode: 'paused',
      activeConfigId: bfsState.rootId,
      transitionHistory: [],
      acceptingPaths: [],
      stats: {
        total: 1,
        active: rootConfig?.status === 'active' ? 1 : 0,
        accepting: rootConfig?.status === 'accepting' ? 1 : 0,
        rejected: 0,
        visited: 0,
        depth: 0,
      },
      cursor: {
        remaining_input: input,
        stack_contents: rootConfig?.stack ?? [],
        last_rule_applied: 'Initial configuration',
        activeConfigId: bfsState.rootId,
        step: 0,
      },
    });
  },

  stepForward: () => {
    const { bfsState, cursor } = get();
    if (!bfsState || bfsState.done) {
      set({ mode: 'done' });
      return [];
    }

    // We need the PDA — it's stored in the BFS state's closure
    // The store doesn't hold the PDA directly; it's passed during stepForward
    // For architectural reasons, we compute the step in the hook instead
    // This method just returns the current frontier
    set(state => ({
      cursor: { ...state.cursor, step: state.cursor.step + 1 },
      stats: computeStats(bfsState.configMap),
      acceptingPaths: bfsState.acceptingPaths,
    }));

    return bfsState.frontier;
  },

  play: () => set({ mode: 'running' }),
  pause: () => set({ mode: 'paused' }),
  reset: () => set({
    bfsState: null,
    mode: 'idle',
    cursor: DEFAULT_CURSOR,
    stats: DEFAULT_STATS,
    activeConfigId: null,
    transitionHistory: [],
    acceptingPaths: [],
  }),

  setSpeed: (speed) => set({ speed }),

  setActiveConfig: (id) => {
    const { bfsState } = get();
    if (!bfsState || !id) {
      set({ activeConfigId: null });
      return;
    }

    const config = bfsState.configMap.get(id);
    if (!config) return;

    set({
      activeConfigId: id,
      // Atomically update cursor for all 3 panels
      cursor: {
        remaining_input: config.remaining,
        stack_contents: config.stack,
        last_rule_applied: config.ruleApplied,
        activeConfigId: id,
        step: get().cursor.step,
      },
    });
  },

  addToHistory: (entry) => {
    set(state => ({
      transitionHistory: [entry, ...state.transitionHistory].slice(0, 50),
    }));
  },
}));
