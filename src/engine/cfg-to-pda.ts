// ============================================================
// CFG PDA Visualizer — CFG → PDA Converter
// 3-state NPDA construction: q_start → q_loop → q_accept
// Acceptance by FINAL STATE (q_accept)
// ============================================================

import type { Grammar, PDA, Transition } from './types';

let _tIdCounter = 0;
function newTId(): string { return `t${++_tIdCounter}`; }

/**
 * Convert a CFG to a PDA using the standard 3-state construction.
 *
 * States: Q = { q_start, q_loop, q_accept }
 *
 * Step 0 (Init): δ(q_start, ε, Z₀) = (q_loop, S Z₀)
 *   Push start symbol S on top of bottom-marker Z₀.
 *
 * Rule 1 (expand): δ(q_loop, ε, A) ∋ (q_loop, α)  for every A → α
 *   Non-deterministically expand variable A to production body α.
 *
 * Rule 2 (match):  δ(q_loop, a, a) = (q_loop, ε)  for every terminal a ∈ Σ
 *   Match terminal on stack with terminal in input.
 *
 * Rule 3 (accept): δ(q_loop, ε, Z₀) = (q_accept, Z₀)
 *   When only Z₀ remains and input is exhausted → accept.
 *
 * Acceptance: by FINAL STATE q_accept
 */
export function cfgToPDA(grammar: Grammar): PDA {
  _tIdCounter = 0;
  const transitions: Transition[] = [];

  const Z0 = 'Z\u2080'; // Bottom of stack marker

  // Step 0 — Initialize: q_start → q_loop, push S on top of Z₀
  transitions.push({
    id: newTId(),
    fromState: 'q_start',
    inputSymbol: null,
    stackTop: Z0,
    toState: 'q_loop',
    stackPush: [grammar.startSymbol, Z0],
    ruleType: 'expand',
    label: `\u03b4(q_start, \u03b5, ${Z0}) = (q_loop, ${grammar.startSymbol}${Z0})`,
    description: `Initialize: push start symbol ${grammar.startSymbol} on top of bottom marker ${Z0}. No input is read.`,
  });

  // Rule 1: For every production A → α, add expand transition in q_loop
  for (const prod of grammar.productions) {
    const rhs = prod.rhs;
    const rhsStr = rhs.length === 0 ? 'ε' : rhs.join('');
    transitions.push({
      id: newTId(),
      fromState: 'q_loop',
      inputSymbol: null,
      stackTop: prod.lhs,
      toState: 'q_loop',
      stackPush: [...rhs],
      ruleType: 'expand',
      sourceProduction: prod,
      label: `\u03b4(q_loop, \u03b5, ${prod.lhs}) = (q_loop, ${rhsStr})`,
      description: `Rule ${prod.lhs} \u2192 ${rhsStr}: \u03b5-move, pop ${prod.lhs}, push RHS reversed = ${rhsStr} on top`,
    });
  }

  // Rule 2: For every terminal a, match transition
  for (const terminal of grammar.terminals) {
    transitions.push({
      id: newTId(),
      fromState: 'q_loop',
      inputSymbol: terminal,
      stackTop: terminal,
      toState: 'q_loop',
      stackPush: [],
      ruleType: 'match',
      label: `\u03b4(q_loop, ${terminal}, ${terminal}) = (q_loop, \u03b5)`,
      description: `Match terminal '${terminal}': read from input AND pop from stack simultaneously`,
    });
  }

  // Rule 3: Accept — when stack has only Z₀ left, move to q_accept
  transitions.push({
    id: newTId(),
    fromState: 'q_loop',
    inputSymbol: null,
    stackTop: Z0,
    toState: 'q_accept',
    stackPush: [Z0],
    ruleType: 'expand',
    label: `\u03b4(q_loop, \u03b5, ${Z0}) = (q_accept, ${Z0})`,
    description: `All grammar symbols expanded & matched — ${Z0} resurfaces \u2192 accept`,
  });

  const stackAlphabet = new Set<string>([
    ...grammar.nonTerminals,
    ...grammar.terminals,
    Z0,
  ]);

  return {
    states: new Set(['q_start', 'q_loop', 'q_accept']),
    inputAlphabet: new Set(grammar.terminals),
    stackAlphabet,
    transitions,
    startState: 'q_start',
    startStackSymbol: Z0,
    acceptByEmptyStack: false,
    acceptStates: new Set(['q_accept']),
  };
}

/**
 * Format a PDA transition as a human-readable string
 */
export function formatTransition(t: Transition): string {
  const input = t.inputSymbol ?? 'ε';
  const push = t.stackPush.length === 0 ? 'ε' : t.stackPush.join('');
  return `δ(${t.fromState}, ${input}, ${t.stackTop}) = (${t.toState}, ${push})`;
}

/**
 * Get a human-readable description of a transition for the UI
 */
export function transitionDescription(t: Transition): string {
  if ((t as any).description) return (t as any).description;
  if (t.ruleType === 'expand') {
    const prod = t.sourceProduction;
    if (prod) {
      const rhs = prod.rhs.length === 0 ? 'ε' : prod.rhs.join(' ');
      return `Rule 1 — Expand: ${prod.lhs} → ${rhs}`;
    }
    return `Rule 1 — Expand (non-terminal)`;
  }
  if (t.ruleType === 'match') {
    return `Rule 2 — Match terminal: ${t.inputSymbol}`;
  }
  return t.label;
}

/**
 * Format the full transition function δ as a multi-line string for display
 */
export function formatPDATransitionFunction(pda: PDA): string {
  const lines = pda.transitions.map(t => formatTransition(t));
  return lines.join('\n');
}

/**
 * Format PDA metadata for display
 */
export function pdaMetadata(pda: PDA): Record<string, string> {
  return {
    'States (Q)': `{ ${[...pda.states].join(', ')} }`,
    'Input Alphabet (Σ)': `{ ${[...pda.inputAlphabet].join(', ')} }`,
    'Stack Alphabet (Γ)': `{ ${[...pda.stackAlphabet].join(', ')} }`,
    'Start State': pda.startState,
    'Start Stack Symbol': pda.startStackSymbol,
    'Accept Condition': pda.acceptByEmptyStack ? 'Empty Stack' : 'Final State (q_accept)',
    'Transitions': `${pda.transitions.length} rules`,
  };
}
