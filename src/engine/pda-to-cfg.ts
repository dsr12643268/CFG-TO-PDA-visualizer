// ============================================================
// ANTIGRAVITY — PDA → CFG Converter (Module 4)
// Triple construction: non-terminals are triples [p, A, q]
// ============================================================

import type { Grammar, PDA, Production, Transition } from './types';

let _pdaCfgIdCounter = 0;
function newId(): string { return `pc${++_pdaCfgIdCounter}`; }

/**
 * Convert a PDA to a CFG using the triple construction.
 * 
 * For each transition (p, a, A) → (r, B₁B₂...Bₘ) in δ:
 * Add productions:
 *   [p, A, q] → a [r, B₁, q₁][q₁, B₂, q₂]...[qₘ₋₁, Bₘ, q]
 * for all combinations of states q₁, ..., qₘ₋₁, q ∈ Q
 * 
 * Start symbol: new S' with S' → [q₀, Z₀, q] for each q ∈ Q
 * 
 * Note: For this construction to work cleanly, each transition should
 * push at most one symbol. Call normalizePDA() first if needed.
 */
export function pdaToCFG(pda: PDA): Grammar {
  _pdaCfgIdCounter = 0;
  const productions: Production[] = [];
  const nonTerminals = new Set<string>();
  const terminals = new Set<string>(pda.inputAlphabet);
  const states = [...pda.states];

  // Helper: create triple non-terminal name
  const triple = (p: string, A: string, q: string): string => `[${p},${A},${q}]`;

  // Add start productions: S' → [q₀, Z₀, q] for each q ∈ Q
  const startSymbol = "S'";
  nonTerminals.add(startSymbol);

  for (const q of states) {
    const nt = triple(pda.startState, pda.startStackSymbol, q);
    nonTerminals.add(nt);
    productions.push({
      lhs: startSymbol,
      rhs: [nt],
      id: newId(),
    });
  }

  // For each transition in the PDA
  for (const t of pda.transitions) {
    const { fromState: p, inputSymbol: a, stackTop: A, toState: r, stackPush: Bs } = t;
    // a is the input consumed (null = ε)
    const aSymbols = a !== null ? [a] : [];
    const m = Bs.length;

    if (m === 0) {
      // Transition: (p, a, A) → (r, ε) — just pop
      // Add [p, A, q] → a for each state q = r (since no symbols pushed)
      // [p, A, r] → a (or ε if a not consumed)
      const lhsNT = triple(p, A, r);
      nonTerminals.add(lhsNT);
      productions.push({
        lhs: lhsNT,
        rhs: [...aSymbols],
        id: newId(),
      });
    } else if (m === 1) {
      // Transition: (p, a, A) → (r, B)
      // [p, A, q] → a [r, B, q] for each q ∈ Q
      for (const q of states) {
        const lhsNT = triple(p, A, q);
        const rhsNT = triple(r, Bs[0], q);
        nonTerminals.add(lhsNT);
        nonTerminals.add(rhsNT);
        productions.push({
          lhs: lhsNT,
          rhs: [...aSymbols, rhsNT],
          id: newId(),
        });
      }
    } else {
      // Transition: (p, a, A) → (r, B₁B₂...Bₘ), m ≥ 2
      // [p, A, q] → a [r, B₁, q₁][q₁, B₂, q₂]...[qₘ₋₁, Bₘ, q]
      // for all q₁, ..., qₘ₋₁, q ∈ Q
      generateTripleProductions(
        p, a, A, r, Bs, states,
        nonTerminals, productions, newId
      );
    }
  }

  // Compute terminals properly (exclude non-terminals)
  const computedTerminals = new Set<string>();
  for (const prod of productions) {
    for (const sym of prod.rhs) {
      if (!nonTerminals.has(sym) && sym !== '') {
        computedTerminals.add(sym);
      }
    }
  }

  return {
    startSymbol,
    nonTerminals,
    terminals: computedTerminals,
    productions,
    nullableSet: new Set(),
  };
}

/**
 * Generate triple productions for transition with m ≥ 2 pushed symbols.
 * Recursively generates all combinations of intermediate states.
 */
function generateTripleProductions(
  p: string,
  a: string | null,
  A: string,
  r: string,
  Bs: string[],
  states: string[],
  nonTerminals: Set<string>,
  productions: Production[],
  getId: () => string
): void {
  const triple = (x: string, B: string, y: string) => `[${x},${B},${y}]`;
  const aSymbols = a !== null ? [a] : [];
  const m = Bs.length;

  // Generate all (m-1)-tuples of intermediate states
  function* cartesian(
    stateList: string[],
    count: number
  ): Generator<string[]> {
    if (count === 0) { yield []; return; }
    for (const s of stateList) {
      for (const rest of cartesian(stateList, count - 1)) {
        yield [s, ...rest];
      }
    }
  }

  for (const finalQ of states) {
    for (const intermediates of cartesian(states, m - 1)) {
      // Sequence: r, q₁, q₂, ..., qₘ₋₁, finalQ
      const stateSeq = [r, ...intermediates, finalQ];

      const lhsNT = triple(p, A, finalQ);
      nonTerminals.add(lhsNT);

      const rhs: string[] = [...aSymbols];
      for (let i = 0; i < m; i++) {
        const tripleNT = triple(stateSeq[i], Bs[i], stateSeq[i + 1]);
        nonTerminals.add(tripleNT);
        rhs.push(tripleNT);
      }

      productions.push({ lhs: lhsNT, rhs, id: getId() });
    }
  }
}

/**
 * Format triple non-terminal for display in a readable way
 */
export function formatTriple(nt: string): string {
  // [p,A,q] → 〈p, A, q〉
  return nt.replace(/\[([^,\]]+),([^,\]]+),([^\]]+)\]/, '〈$1, $2, $3〉');
}
