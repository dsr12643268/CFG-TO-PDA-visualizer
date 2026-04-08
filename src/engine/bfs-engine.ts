// ============================================================
// ANTIGRAVITY — BFS Engine (Module 5)
// Async generator for step-by-step BFS over PDA configurations
// C = (q, w_remaining, γ) — configuration triple
// Visited-set prevents infinite loops
// ============================================================

import type {
  Configuration,
  ConfigStatus,
  PDA,
  BFSResult,
  SimulationCursor,
  Transition,
} from './types';

let _configIdCounter = 0;
function newConfigId(): string { return `c${++_configIdCounter}`; }

// ─── Configuration Key (for visited-set) ─────────────────────

function configKey(state: string, remaining: string, stack: string[]): string {
  return `${state}|${remaining}|${stack.join(',')}`;
}

// ─── Stack Operations ─────────────────────────────────────────

/**
 * Apply a transition to a configuration, returning the new configuration.
 * Returns null if the transition is not applicable.
 */
function applyTransition(
  config: Configuration,
  t: Transition,
  pda: PDA
): Configuration | null {
  const { state, remaining, stack } = config;

  // Check state matches
  if (t.fromState !== state) return null;

  // Check stack top
  if (stack.length === 0 || stack[0] !== t.stackTop) return null;

  // Check input symbol
  if (t.inputSymbol !== null) {
    if (remaining.length === 0 || remaining[0] !== t.inputSymbol) return null;
  }

  // Build new stack: pop stackTop, push t.stackPush
  // stackPush is in order [B1, B2, ..., Bm] where B1 goes on top
  const newStack = [...t.stackPush, ...stack.slice(1)];

  // Remove bottom-of-stack marker if it's the only thing left
  const newRemaining = t.inputSymbol !== null ? remaining.slice(1) : remaining;

  const newConfig: Configuration = {
    id: newConfigId(),
    state: t.toState,
    remaining: newRemaining,
    stack: newStack,
    parentId: config.id,
    ruleApplied: t.label,
    transitionApplied: t,
    status: 'pending',
    depth: config.depth + 1,
    children: [],
  };

  // Determine status — support both empty-stack and final-state acceptance
  const isAcceptState = pda.acceptStates ? pda.acceptStates.has(newConfig.state) : false;
  const isEmptyStack = newStack.length === 0;
  const isInputDone = newRemaining.length === 0;

  if (pda.acceptByEmptyStack) {
    // Legacy: accept by empty stack and empty input
    if (isEmptyStack && isInputDone) {
      newConfig.status = 'accepting';
    } else if (isEmptyStack && !isInputDone) {
      newConfig.status = 'rejected';
    } else {
      newConfig.status = 'active';
    }
  } else {
    // 3-state NPDA: accept when in q_accept with all input consumed
    if (isAcceptState && isInputDone) {
      newConfig.status = 'accepting';
    } else if (isAcceptState && !isInputDone) {
      newConfig.status = 'rejected'; // q_accept but input remains
    } else {
      // Keep active; let BFS naturally find dead-ends
      newConfig.status = 'active';
    }
  }

  return newConfig;
}


/**
 * Check if a configuration can make further progress
 * (used to mark dead-ends as rejected early)
 */
function canMakeProgress(config: Configuration, pda: PDA): boolean {
  if (config.stack.length === 0) return config.remaining.length === 0;
  const stackTop = config.stack[0];
  return pda.transitions.some(t => {
    if (t.fromState !== config.state) return false;
    if (t.stackTop !== stackTop) return false;
    if (t.inputSymbol !== null && (config.remaining.length === 0 || config.remaining[0] !== t.inputSymbol)) return false;
    return true;
  });
}

// ─── BFS Engine ───────────────────────────────────────────────

export interface BFSEngineState {
  configMap: Map<string, Configuration>;
  frontier: string[];          // Current BFS frontier (config IDs)
  visited: Set<string>;        // Visited configuration keys
  step: number;
  rootId: string | null;
  acceptingPaths: string[][];  // Each path is array of config IDs (root → leaf)
  totalExplored: number;
  done: boolean;
}

export function createBFSEngine(pda: PDA, input: string): BFSEngineState {
  _configIdCounter = 0;

  // Initial configuration: start state, full input, initial stack symbol only
  const initialStack = [pda.startStackSymbol];
  const rootId = newConfigId();

  const initialConfig: Configuration = {
    id: rootId,
    state: pda.startState,
    remaining: input,
    stack: initialStack,
    parentId: null,
    ruleApplied: 'Initial configuration',
    transitionApplied: null,
    status: 'active',
    depth: 0,
    children: [],
  };

  const configMap = new Map<string, Configuration>();
  configMap.set(rootId, initialConfig);

  const visited = new Set<string>();
  const key = configKey(initialConfig.state, initialConfig.remaining, initialConfig.stack);
  visited.add(key);

  return {
    configMap,
    frontier: [rootId],
    visited,
    step: 0,
    rootId,
    acceptingPaths: [],
    totalExplored: 1,
    done: false,
  };
}

/**
 * Advance the BFS by one full level (all configs in the current frontier).
 * Returns the new frontier (list of config IDs generated in this step).
 * Returns empty array when BFS is done.
 * 
 * CRITICAL: Visited-set check is mandatory here.
 */
export function bfsStep(state: BFSEngineState, pda: PDA): string[] {
  if (state.done || state.frontier.length === 0) {
    state.done = true;
    return [];
  }

  const newFrontier: string[] = [];
  const { configMap, visited } = state;

  for (const configId of state.frontier) {
    const config = configMap.get(configId)!;

    // Don't expand terminal states
    if (config.status === 'accepting' || config.status === 'rejected' || config.status === 'visited') {
      continue;
    }

    // Find all applicable transitions
    const applicableTransitions = pda.transitions.filter(t => {
      if (t.fromState !== config.state) return false;
      if (config.stack.length === 0 || config.stack[0] !== t.stackTop) return false;
      if (t.inputSymbol !== null) {
        if (config.remaining.length === 0 || config.remaining[0] !== t.inputSymbol) return false;
      }
      return true;
    });

    if (applicableTransitions.length === 0) {
      // Dead end — mark as rejected
      config.status = 'rejected';
      continue;
    }

    for (const t of applicableTransitions) {
      const newConfig = applyTransition(config, t, pda);
      if (!newConfig) continue;

      const key = configKey(newConfig.state, newConfig.remaining, newConfig.stack);

      // ─── VISITED-SET CHECK ─────────────────────────────────
      if (visited.has(key)) {
        // Already seen this configuration — mark as visited (pruned)
        const visitedConfig: Configuration = {
          ...newConfig,
          id: newConfigId(),
          status: 'visited',
        };
        configMap.set(visitedConfig.id, visitedConfig);
        config.children.push(visitedConfig.id);
        state.totalExplored++;
        continue;
      }
      // ───────────────────────────────────────────────────────

      visited.add(key);
      configMap.set(newConfig.id, newConfig);
      config.children.push(newConfig.id);
      state.totalExplored++;

      if (newConfig.status === 'accepting') {
        // Trace path from root to this accepting config
        const path = tracePath(newConfig.id, configMap);
        state.acceptingPaths.push(path);
      }

      if (newConfig.status === 'active') {
        newFrontier.push(newConfig.id);
      }
    }
  }

  state.frontier = newFrontier;
  state.step++;

  if (newFrontier.length === 0) {
    state.done = true;
  }

  return newFrontier;
}

/**
 * Run BFS to completion (non-interactive, for verification panel and stress tests).
 * Has a configurable maximum to prevent runaway computation.
 */
export function runBFSToCompletion(
  pda: PDA,
  input: string,
  maxConfigs = 5000
): BFSResult {
  const state = createBFSEngine(pda, input);

  while (!state.done && state.totalExplored < maxConfigs) {
    bfsStep(state, pda);
  }

  if (state.totalExplored >= maxConfigs && !state.done) {
    // Mark all remaining active as rejected (truncation)
    for (const id of state.frontier) {
      const c = state.configMap.get(id);
      if (c) c.status = 'rejected';
    }
  }

  return {
    acceptingPaths: state.acceptingPaths.map(path =>
      path.map(id => state.configMap.get(id)!).filter(Boolean)
    ),
    totalExplored: state.totalExplored,
    isAmbiguous: state.acceptingPaths.length > 1,
    configMap: state.configMap,
    rootId: state.rootId,
  };
}

// ─── Path Tracing ─────────────────────────────────────────────

/**
 * Trace the path from root to a given config ID.
 * Returns array of config IDs from root (index 0) to leaf.
 */
export function tracePath(
  configId: string,
  configMap: Map<string, Configuration>
): string[] {
  const path: string[] = [];
  let current: Configuration | undefined = configMap.get(configId);
  while (current) {
    path.unshift(current.id);
    if (current.parentId === null) break;
    current = configMap.get(current.parentId);
  }
  return path;
}

// ─── Simulation Cursor Builder ────────────────────────────────

export function buildCursor(
  config: Configuration,
  step: number
): SimulationCursor {
  return {
    remaining_input: config.remaining,
    stack_contents: config.stack,
    last_rule_applied: config.ruleApplied,
    activeConfigId: config.id,
    step,
  };
}

// ─── Statistics ───────────────────────────────────────────────

export interface BFSStats {
  total: number;
  active: number;
  accepting: number;
  rejected: number;
  visited: number;
  depth: number;
}

export function computeStats(configMap: Map<string, Configuration>): BFSStats {
  let active = 0, accepting = 0, rejected = 0, visited = 0, maxDepth = 0;

  for (const config of configMap.values()) {
    switch (config.status) {
      case 'active': case 'pending': active++; break;
      case 'accepting': accepting++; break;
      case 'rejected': rejected++; break;
      case 'visited': visited++; break;
    }
    if (config.depth > maxDepth) maxDepth = config.depth;
  }

  return {
    total: configMap.size,
    active,
    accepting,
    rejected,
    visited,
    depth: maxDepth,
  };
}
