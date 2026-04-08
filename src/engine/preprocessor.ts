// ============================================================
// ANTIGRAVITY — Preprocessor (Module 2)
// Five pure transform functions for grammar normalization
// Each returns { result, log, changed }
// ============================================================

import type {
  Grammar,
  Production,
  TransformResult,
  PreprocessLogEntry,
  PDA,
  Transition,
} from './types';
import { computeNullable } from './grammar-parser';

let _ppIdCounter = 0;
function newId(): string { return `pp${++_ppIdCounter}`; }

// ─── Utility ─────────────────────────────────────────────────

function cloneGrammar(g: Grammar): Grammar {
  return {
    startSymbol: g.startSymbol,
    nonTerminals: new Set(g.nonTerminals),
    terminals: new Set(g.terminals),
    productions: g.productions.map(p => ({ ...p, rhs: [...p.rhs] })),
    nullableSet: new Set(g.nullableSet),
  };
}

function prodStr(p: Production): string {
  return `${p.lhs} → ${p.rhs.length === 0 ? 'ε' : p.rhs.join(' ')}`;
}

// ─── 1. Eliminate Left Recursion ─────────────────────────────

/**
 * Eliminates both direct and indirect left recursion.
 * For each A with A → Aα | β, replace with:
 *   A → β A'
 *   A' → α A' | ε
 */
export function eliminateLeftRecursion(g: Grammar): TransformResult<Grammar> {
  const result = cloneGrammar(g);
  const log: PreprocessLogEntry[] = [];
  let changed = false;

  // Order the non-terminals
  const nts: string[] = [result.startSymbol];
  for (const nt of result.nonTerminals) {
    if (nt !== result.startSymbol) nts.push(nt);
  }

  for (let i = 0; i < nts.length; i++) {
    const Ai = nts[i];

    // Step 1: Eliminate indirect left recursion via previous Aj (j < i)
    for (let j = 0; j < i; j++) {
      const Aj = nts[j];
      const aiProdsToReplace = result.productions.filter(
        p => p.lhs === Ai && p.rhs[0] === Aj
      );
      const ajProds = result.productions.filter(p => p.lhs === Aj);

      for (const oldProd of aiProdsToReplace) {
        // Remove oldProd
        const idx = result.productions.indexOf(oldProd);
        result.productions.splice(idx, 1);

        log.push({
          type: 'removed',
          message: `Remove indirect left recursion: ${prodStr(oldProd)}`,
          oldProduction: prodStr(oldProd),
        });

        // Add: Ai → ajRHS rest
        for (const ajProd of ajProds) {
          const newRhs = [...ajProd.rhs, ...oldProd.rhs.slice(1)];
          const newProd: Production = { lhs: Ai, rhs: newRhs, id: newId() };
          result.productions.push(newProd);
          log.push({
            type: 'added',
            message: `Substitute: ${prodStr(newProd)}`,
            newProduction: prodStr(newProd),
          });
          changed = true;
        }
      }
    }

    // Step 2: Eliminate direct left recursion for Ai
    const directRecursive = result.productions.filter(
      p => p.lhs === Ai && p.rhs[0] === Ai
    );
    const nonRecursive = result.productions.filter(
      p => p.lhs === Ai && p.rhs[0] !== Ai
    );

    if (directRecursive.length > 0) {
      changed = true;
      const prime = Ai + "'";
      result.nonTerminals.add(prime);
      nts.push(prime);

      // Remove all Ai productions
      result.productions = result.productions.filter(p => p.lhs !== Ai);

      for (const p of directRecursive) {
        log.push({
          type: 'removed',
          message: `Remove direct left recursion: ${prodStr(p)}`,
          oldProduction: prodStr(p),
        });
      }

      // Add: Ai → β A' for each non-recursive β
      if (nonRecursive.length === 0) {
        // Grammar is purely left recursive — make A'
        const newP: Production = { lhs: Ai, rhs: [prime], id: newId() };
        result.productions.push(newP);
        log.push({ type: 'added', message: `Add: ${prodStr(newP)}`, newProduction: prodStr(newP) });
      } else {
        for (const p of nonRecursive) {
          const newP: Production = { lhs: Ai, rhs: [...p.rhs, prime], id: newId() };
          result.productions.push(newP);
          log.push({ type: 'added', message: `Add: ${prodStr(newP)}`, newProduction: prodStr(newP) });
        }
      }

      // Add: A' → α A' for each recursive α
      for (const p of directRecursive) {
        const newP: Production = {
          lhs: prime,
          rhs: [...p.rhs.slice(1), prime],
          id: newId(),
        };
        result.productions.push(newP);
        log.push({ type: 'added', message: `Add: ${prodStr(newP)}`, newProduction: prodStr(newP) });
      }

      // Add: A' → ε
      const epsProd: Production = { lhs: prime, rhs: [], id: newId() };
      result.productions.push(epsProd);
      log.push({ type: 'added', message: `Add: ${prodStr(epsProd)}`, newProduction: prodStr(epsProd) });
    }
  }

  result.nullableSet = computeNullable(result.productions);
  if (!changed) {
    log.push({ type: 'info', message: 'No left recursion detected.' });
  }

  return { result, log, changed };
}

// ─── 2. Eliminate Unit Productions ───────────────────────────

/**
 * Unit production: A → B where B is a non-terminal.
 * For each A, compute the unit closure (all B reachable via unit chains),
 * then add A → β for each non-unit production B → β.
 */
export function eliminateUnitProductions(g: Grammar): TransformResult<Grammar> {
  const result = cloneGrammar(g);
  const log: PreprocessLogEntry[] = [];
  let changed = false;

  // Compute unit closure for each non-terminal
  const unitClosure = (start: string): Set<string> => {
    const visited = new Set<string>([start]);
    const queue = [start];
    while (queue.length > 0) {
      const nt = queue.shift()!;
      for (const p of result.productions) {
        if (p.lhs === nt && p.rhs.length === 1 && result.nonTerminals.has(p.rhs[0])) {
          const target = p.rhs[0];
          if (!visited.has(target)) {
            visited.add(target);
            queue.push(target);
          }
        }
      }
    }
    return visited;
  };

  const closures = new Map<string, Set<string>>();
  for (const nt of result.nonTerminals) {
    closures.set(nt, unitClosure(nt));
  }

  // Remove all unit productions
  const unitProds = result.productions.filter(
    p => p.rhs.length === 1 && result.nonTerminals.has(p.rhs[0])
  );
  for (const up of unitProds) {
    result.productions.splice(result.productions.indexOf(up), 1);
    log.push({
      type: 'removed',
      message: `Remove unit production: ${prodStr(up)}`,
      oldProduction: prodStr(up),
    });
    changed = true;
  }

  // Add non-unit productions reachable via unit chains
  const existing = new Set(result.productions.map(p => `${p.lhs}→${p.rhs.join(',')}`));
  for (const [A, closure] of closures) {
    for (const B of closure) {
      if (B === A) continue;
      // Add all non-unit productions of B to A
      for (const p of result.productions) {
        if (p.lhs !== B) continue;
        // Already non-unit (we removed units above)
        const key = `${A}→${p.rhs.join(',')}`;
        if (!existing.has(key)) {
          existing.add(key);
          const newP: Production = { lhs: A, rhs: [...p.rhs], id: newId() };
          result.productions.push(newP);
          log.push({
            type: 'added',
            message: `Add via unit closure (${A} →* ${B}): ${prodStr(newP)}`,
            newProduction: prodStr(newP),
          });
        }
      }
    }
  }

  result.nullableSet = computeNullable(result.productions);
  if (!changed) log.push({ type: 'info', message: 'No unit productions found.' });

  return { result, log, changed };
}

// ─── 3. Eliminate ε-Productions ──────────────────────────────

/**
 * For each nullable non-terminal A, for every production B → αAβ,
 * add B → αβ (with A omitted). Keep the original ε-production only
 * for the start symbol if needed.
 */
export function eliminateEpsilonProductions(g: Grammar): TransformResult<Grammar> {
  const result = cloneGrammar(g);
  const log: PreprocessLogEntry[] = [];
  let changed = false;

  const nullable = computeNullable(result.productions);
  if (nullable.size === 0) {
    log.push({ type: 'info', message: 'No ε-productions found.' });
    return { result, log, changed };
  }

  for (const nt of nullable) {
    log.push({ type: 'info', message: `Nullable: ${nt}` });
  }

  // Generate all subsets of nullable positions in a RHS
  function generateCompensating(lhs: string, rhs: string[]): Production[] {
    const nullablePositions: number[] = [];
    rhs.forEach((sym, i) => { if (nullable.has(sym)) nullablePositions.push(i); });

    const prodsToAdd: Production[] = [];
    const count = 1 << nullablePositions.length;

    for (let mask = 0; mask < count; mask++) {
      // mask bit k = 1 means we omit nullablePositions[k]
      const omit = new Set<number>();
      for (let k = 0; k < nullablePositions.length; k++) {
        if (mask & (1 << k)) omit.add(nullablePositions[k]);
      }
      const newRhs = rhs.filter((_, i) => !omit.has(i));
      if (newRhs.length === 0) continue; // will be added as ε-prod only for start
      prodsToAdd.push({ lhs, rhs: newRhs, id: newId() });
    }

    return prodsToAdd;
  }

  const existing = new Set(result.productions.map(p => `${p.lhs}→${p.rhs.join(',')}`));
  const originalProds = [...result.productions];

  for (const p of originalProds) {
    if (p.rhs.length === 0) continue; // skip existing ε-prods for now
    const compensating = generateCompensating(p.lhs, p.rhs);
    for (const cp of compensating) {
      const key = `${cp.lhs}→${cp.rhs.join(',')}`;
      if (!existing.has(key)) {
        existing.add(key);
        result.productions.push(cp);
        log.push({
          type: 'added',
          message: `Compensating production: ${prodStr(cp)}`,
          newProduction: prodStr(cp),
        });
        changed = true;
      }
    }
  }

  // Remove all ε-productions except S → ε if S is nullable
  result.productions = result.productions.filter(p => {
    if (p.rhs.length === 0) {
      if (p.lhs === result.startSymbol && nullable.has(result.startSymbol)) {
        return true; // Keep S → ε
      }
      log.push({
        type: 'removed',
        message: `Remove ε-production: ${prodStr(p)}`,
        oldProduction: prodStr(p),
      });
      changed = true;
      return false;
    }
    return true;
  });

  result.nullableSet = computeNullable(result.productions);
  return { result, log, changed };
}

// ─── 4. Convert to CNF ────────────────────────────────────────

/**
 * Chomsky Normal Form: every production is either A → BC or A → a.
 * Required for CYK algorithm.
 * 
 * Steps:
 * 1. TERM: Replace terminals in long RHS with new nonterminals Xa
 * 2. BIN: Break RHS of length > 2 into binary productions
 */
export function convertToCNF(g: Grammar): TransformResult<Grammar> {
  const result = cloneGrammar(g);
  const log: PreprocessLogEntry[] = [];
  let changed = false;

  // Step 0: First handle ε and unit productions
  const epsilon = eliminateEpsilonProductions(result);
  if (epsilon.changed) {
    result.productions = epsilon.result.productions;
    result.nonTerminals = epsilon.result.nonTerminals;
    result.terminals = epsilon.result.terminals;
    result.nullableSet = epsilon.result.nullableSet;
    log.push(...epsilon.log);
    changed = true;
  }

  const unit = eliminateUnitProductions(result);
  if (unit.changed) {
    result.productions = unit.result.productions;
    result.nonTerminals = unit.result.nonTerminals;
    result.terminals = unit.result.terminals;
    result.nullableSet = unit.result.nullableSet;
    log.push(...unit.log);
    changed = true;
  }

  // Step 1: TERM — replace terminals in mixed/long RHS
  const termMap = new Map<string, string>(); // terminal → new NT name

  const getTermNT = (terminal: string): string => {
    if (!termMap.has(terminal)) {
      // Generate a name like X_a, X_b, etc.
      const nt = `X_${terminal.replace(/[^A-Za-z0-9]/g, '_')}`;
      termMap.set(terminal, nt);
      result.nonTerminals.add(nt);
      result.productions.push({ lhs: nt, rhs: [terminal], id: newId() });
      log.push({
        type: 'added',
        message: `TERM: Add ${nt} → ${terminal}`,
        newProduction: `${nt} → ${terminal}`,
      });
    }
    return termMap.get(terminal)!;
  };

  const prodsToProcess = [...result.productions];
  for (const p of prodsToProcess) {
    if (p.rhs.length <= 1) continue; // A → ε or A → a: already fine
    
    // Check if any terminal appears in a multi-symbol RHS
    const hasMixedTerminal = p.rhs.some(s => result.terminals.has(s));
    if (!hasMixedTerminal) continue;

    const oldStr = prodStr(p);
    const newRhs = p.rhs.map(s => {
      if (result.terminals.has(s)) {
        changed = true;
        return getTermNT(s);
      }
      return s;
    });
    p.rhs = newRhs;
    log.push({
      type: 'added',
      message: `TERM: ${oldStr} → ${prodStr(p)}`,
      newProduction: prodStr(p),
    });
  }

  // Step 2: BIN — break long RHS into binary
  let i = 0;
  while (i < result.productions.length) {
    const p = result.productions[i];
    if (p.rhs.length > 2) {
      changed = true;
      const oldStr = prodStr(p);
      // Create chain: A → B1 [A1], A1 → B2 [A2], ..., An → Bn-1 Bn
      let currentLhs = p.lhs;
      const rhs = p.rhs;

      // Replace current production with A → B1 newNT
      const chainNT = `BIN_${currentLhs}_${p.id}`;
      result.nonTerminals.add(chainNT);

      p.rhs = [rhs[0], chainNT];
      log.push({
        type: 'added',
        message: `BIN: ${oldStr} → ${prodStr(p)}`,
        newProduction: prodStr(p),
      });

      // Chain remaining symbols
      currentLhs = chainNT;
      for (let k = 1; k < rhs.length - 2; k++) {
        const nextNT = `BIN_${p.lhs}_${p.id}_${k}`;
        result.nonTerminals.add(nextNT);
        const newP: Production = { lhs: currentLhs, rhs: [rhs[k], nextNT], id: newId() };
        result.productions.push(newP);
        log.push({ type: 'added', message: `BIN: Add ${prodStr(newP)}`, newProduction: prodStr(newP) });
        currentLhs = nextNT;
      }

      // Final pair
      const finalP: Production = {
        lhs: currentLhs,
        rhs: [rhs[rhs.length - 2], rhs[rhs.length - 1]],
        id: newId(),
      };
      result.productions.push(finalP);
      log.push({ type: 'added', message: `BIN: Add ${prodStr(finalP)}`, newProduction: prodStr(finalP) });
    } else {
      i++;
    }
  }

  result.nullableSet = computeNullable(result.productions);
  if (!changed) log.push({ type: 'info', message: 'Grammar is already in CNF.' });

  return { result, log, changed };
}

// ─── 5. Normalize PDA ─────────────────────────────────────────

/**
 * For the PDA→CFG triple construction, each transition must push
 * at most one symbol (beyond replacement). This ensures the triple
 * construction is directly applicable.
 * 
 * If a transition pushes [B1, B2, ..., Bm] (m > 1), we introduce
 * intermediate states to break it into a chain of single-push transitions.
 */
export function normalizePDA(pda: PDA): TransformResult<PDA> {
  const log: PreprocessLogEntry[] = [];
  let changed = false;

  const newTransitions: Transition[] = [];
  const newStates = new Set<string>(pda.states);
  let stateCounter = 0;

  for (const t of pda.transitions) {
    if (t.stackPush.length <= 1) {
      newTransitions.push(t);
      continue;
    }

    // Break into chain
    changed = true;
    const chain = t.stackPush;
    let currentFrom = t.fromState;
    let inputSym = t.inputSymbol;

    for (let k = 0; k < chain.length - 1; k++) {
      const nextState = `norm_${stateCounter++}`;
      newStates.add(nextState);
      const newT: Transition = {
        id: newId(),
        fromState: currentFrom,
        inputSymbol: inputSym,
        stackTop: k === 0 ? t.stackTop : chain[k - 1],
        toState: nextState,
        stackPush: [chain[k]],
        ruleType: t.ruleType,
        label: `normalize(${t.label})_${k}`,
      };
      newTransitions.push(newT);
      log.push({
        type: 'added',
        message: `Normalize multi-push: ${newT.label}`,
        newProduction: newT.label,
      });
      currentFrom = nextState;
      inputSym = null; // subsequent transitions are ε
    }

    // Final transition pushes last symbol
    const finalT: Transition = {
      id: newId(),
      fromState: currentFrom,
      inputSymbol: null,
      stackTop: chain[chain.length - 2],
      toState: t.toState,
      stackPush: [chain[chain.length - 1]],
      ruleType: t.ruleType,
      label: `normalize(${t.label})_final`,
    };
    newTransitions.push(finalT);
    log.push({
      type: 'added',
      message: `Normalize final: ${finalT.label}`,
      newProduction: finalT.label,
    });
  }

  const normalizedPDA: PDA = {
    ...pda,
    states: newStates,
    transitions: newTransitions,
  };

  if (!changed) log.push({ type: 'info', message: 'PDA is already normalized (all transitions push ≤ 1 symbol).' });

  return { result: normalizedPDA, log, changed };
}
