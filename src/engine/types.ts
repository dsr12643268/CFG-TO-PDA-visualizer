// ============================================================
// ANTIGRAVITY — Shared Type Definitions
// All interfaces used across engine modules, stores, and UI
// ============================================================

// ─── Grammar Types ──────────────────────────────────────────

export interface Production {
  lhs: string;       // Left-hand side non-terminal
  rhs: string[];     // Right-hand side symbols ([] = ε-production)
  id: string;        // Unique id for display / referencing
}

export interface Grammar {
  startSymbol: string;
  nonTerminals: Set<string>;
  terminals: Set<string>;
  productions: Production[];
  nullableSet: Set<string>;  // Set of nullable non-terminals
}

// ─── PDA Types ───────────────────────────────────────────────

export interface Transition {
  id: string;
  fromState: string;
  inputSymbol: string | null;  // null = ε-transition
  stackTop: string;
  toState: string;
  stackPush: string[];         // symbols to push ([] = pop only)
  ruleType: 'expand' | 'match' | 'manual';
  sourceProduction?: Production;  // for Rule 1 (expand) transitions
  label: string;               // human-readable for display
  description?: string;        // longer explanation for UI panels
}

export interface PDA {
  states: Set<string>;
  inputAlphabet: Set<string>;   // Σ
  stackAlphabet: Set<string>;   // Γ
  transitions: Transition[];
  startState: string;
  startStackSymbol: string;
  acceptByEmptyStack: boolean;
  acceptStates?: Set<string>;   // for final-state acceptance
}

// ─── BFS / Simulation Types ──────────────────────────────────

export type ConfigStatus = 'active' | 'accepting' | 'rejected' | 'visited' | 'pending';

export interface Configuration {
  id: string;
  state: string;
  remaining: string;           // Unconsumed input suffix
  stack: string[];             // Stack contents (top first, index 0)
  parentId: string | null;
  ruleApplied: string;         // Human-readable rule description
  transitionApplied: Transition | null;
  status: ConfigStatus;
  depth: number;
  children: string[];          // child configuration IDs
}

// Shared simulation cursor — single source of truth for all 3 panels
export interface SimulationCursor {
  remaining_input: string;
  stack_contents: string[];
  last_rule_applied: string;
  activeConfigId: string | null;
  step: number;
}

export interface BFSResult {
  acceptingPaths: Configuration[][];  // ALL paths that led to acceptance
  totalExplored: number;
  isAmbiguous: boolean;               // true if acceptingPaths.length > 1
  configMap: Map<string, Configuration>;
  rootId: string | null;
}

// ─── CYK / Parse Tree Types ──────────────────────────────────

export interface ParseNode {
  symbol: string;
  production?: Production;
  children: ParseNode[];
  isTerminal: boolean;
  span: [number, number];  // [start, end] indices in input
}

export interface ParseResult {
  accepted: boolean;
  parseTrees: ParseNode[];
  isAmbiguous: boolean;
}

// ─── Preprocessing Types ─────────────────────────────────────

export interface TransformResult<T> {
  result: T;
  log: PreprocessLogEntry[];
  changed: boolean;
}

export interface PreprocessLogEntry {
  type: 'removed' | 'added' | 'info' | 'warning';
  message: string;
  oldProduction?: string;
  newProduction?: string;
}

// ─── Preset Grammar Example ───────────────────────────────────

export interface GrammarExample {
  id: string;
  name: string;
  description: string;
  rawInput: string;
  tags: string[];
}

// ─── Verification / Stress Test ──────────────────────────────

export interface TestResult {
  input: string;
  cfgAccepts: boolean;
  pdaAccepts: boolean;
  match: boolean;
  cfgParseTrees: number;
  pdaAcceptingPaths: number;
  pdaExplored: number;
}

export interface StressTestResult {
  results: TestResult[];
  totalTested: number;
  agreements: number;
  disagreements: number;
  cfgAcceptRate: number;
  pdaAcceptRate: number;
}
