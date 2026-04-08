// ============================================================
// ANTIGRAVITY — CYK Parser (Module 6)
// Cocke-Younger-Kasami algorithm for CFG recognition
// Requires CNF grammar. Returns ALL parse trees (for ambiguity detection)
// O(n³ · |G|) time complexity
// ============================================================

import type { Grammar, ParseNode, ParseResult, Production } from './types';
import { convertToCNF } from './preprocessor';

// ─── CYK Table Entry ─────────────────────────────────────────

interface CYKEntry {
  symbol: string;
  splitPoint: number;   // for A → B C, where B spans [i, k] and C [k+1, j]
  leftEntry?: CYKEntry; // tree for B
  rightEntry?: CYKEntry; // tree for C
  production?: Production;
  isTerminal: boolean;
}

// ─── Main CYK Parser ─────────────────────────────────────────

/**
 * Run the CYK algorithm on a grammar and input string.
 * 
 * Pre-processes the grammar to CNF first (unless already in CNF).
 * Returns all parse trees (multiple = ambiguous grammar).
 * 
 * @param grammar - The input grammar (will be converted to CNF internally)
 * @param input - The input string as array of tokens
 */
export function cyk(grammar: Grammar, input: string | string[]): ParseResult {
  // Tokenize input
  const tokens: string[] = typeof input === 'string'
    ? tokenize(input, grammar.terminals)
    : input;

  const n = tokens.length;

  // Empty string check
  if (n === 0) {
    const accepted = grammar.nullableSet.has(grammar.startSymbol) ||
      grammar.productions.some(p => p.lhs === grammar.startSymbol && p.rhs.length === 0);
    if (accepted) {
      return {
        accepted: true,
        parseTrees: [{
          symbol: grammar.startSymbol,
          production: grammar.productions.find(p => p.lhs === grammar.startSymbol && p.rhs.length === 0),
          children: [],
          isTerminal: false,
          span: [0, -1],
        }],
        isAmbiguous: false,
      };
    }
    return { accepted: false, parseTrees: [], isAmbiguous: false };
  }

  // Convert to CNF
  const cnfResult = convertToCNF(grammar);
  const cnfGrammar = cnfResult.result;

  // CYK table: table[i][j] = list of CYKEntry (all NTs that span [i, j])
  const table: CYKEntry[][][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => [])
  );

  // Fill diagonal (terminals, span length 1)
  for (let i = 0; i < n; i++) {
    const token = tokens[i];
    // Find all A → token productions
    for (const prod of cnfGrammar.productions) {
      if (prod.rhs.length === 1 && prod.rhs[0] === token) {
        table[i][i].push({
          symbol: prod.lhs,
          splitPoint: i,
          isTerminal: false,
          production: prod,
          leftEntry: {
            symbol: token,
            splitPoint: i,
            isTerminal: true,
            span: [i, i],
          } as CYKEntry,
          span: [i, i],
        } as CYKEntry);
      }
    }
    // Also add the terminal itself
    table[i][i].push({
      symbol: token,
      splitPoint: i,
      isTerminal: true,
      span: [i, i],
    } as CYKEntry);
  }

  // Fill table for spans of length 2 to n
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i <= n - len; i++) {
      const j = i + len - 1;

      for (let k = i; k < j; k++) {
        // Try all binary productions A → B C
        for (const prod of cnfGrammar.productions) {
          if (prod.rhs.length !== 2) continue;
          const [B, C] = prod.rhs;

          const leftMatches = table[i][k].filter(e => e.symbol === B && !e.isTerminal);
          const rightMatches = table[k + 1][j].filter(e => e.symbol === C && !e.isTerminal);

          for (const leftEntry of leftMatches) {
            for (const rightEntry of rightMatches) {
              table[i][j].push({
                symbol: prod.lhs,
                splitPoint: k,
                leftEntry,
                rightEntry,
                production: prod,
                isTerminal: false,
                span: [i, j],
              } as CYKEntry);
            }
          }
        }
      }
    }
  }

  // Find all entries at [0][n-1] matching the start symbol
  const startEntries = table[0][n - 1].filter(
    e => e.symbol === cnfGrammar.startSymbol || e.symbol === grammar.startSymbol
  );

  if (startEntries.length === 0) {
    return { accepted: false, parseTrees: [], isAmbiguous: false };
  }

  // Build parse trees from CYK entries
  // Limit to 10 parse trees to prevent explosion
  const MAX_TREES = 10;
  const parseTrees: ParseNode[] = [];

  for (const entry of startEntries) {
    if (parseTrees.length >= MAX_TREES) break;
    try {
      const tree = buildParseTree(entry, tokens, grammar.startSymbol);
      parseTrees.push(tree);
    } catch {
      // Skip malformed entries
    }
  }

  return {
    accepted: true,
    parseTrees,
    isAmbiguous: parseTrees.length > 1,
  };
}

// ─── Parse Tree Builder ───────────────────────────────────────

function buildParseTree(
  entry: CYKEntry,
  tokens: string[],
  rootSymbol: string
): ParseNode {
  const span = (entry as { span?: [number, number] }).span ?? [0, 0];

  if (entry.isTerminal) {
    return {
      symbol: entry.symbol,
      children: [],
      isTerminal: true,
      span,
    };
  }

  if (!entry.leftEntry && !entry.rightEntry) {
    // Unit production A → a (terminal)
    const child: ParseNode = {
      symbol: entry.leftEntry
        ? (entry.leftEntry as CYKEntry).symbol
        : tokens[span[0]] ?? '?',
      children: [],
      isTerminal: true,
      span,
    };
    return {
      symbol: entry.symbol,
      production: entry.production,
      children: [child],
      isTerminal: false,
      span,
    };
  }

  const children: ParseNode[] = [];
  if (entry.leftEntry) {
    children.push(buildParseTree(entry.leftEntry, tokens, rootSymbol));
  }
  if (entry.rightEntry) {
    children.push(buildParseTree(entry.rightEntry, tokens, rootSymbol));
  }

  return {
    symbol: entry.symbol,
    production: entry.production,
    children,
    isTerminal: false,
    span,
  };
}

// ─── Tokenizer for CYK Input ─────────────────────────────────

/**
 * Tokenize an input string based on the grammar's terminal symbols.
 * Handles multi-character terminals like 'id', 'if', 'then'.
 */
function tokenize(input: string, terminals: Set<string>): string[] {
  const tokens: string[] = [];
  let i = 0;
  const s = input.trim();

  // Sort terminals by length (longest first) for greedy matching
  const sortedTerminals = [...terminals].sort((a, b) => b.length - a.length);

  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }

    let matched = false;
    for (const term of sortedTerminals) {
      if (s.startsWith(term, i)) {
        tokens.push(term);
        i += term.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Single character token
      tokens.push(s[i]);
      i++;
    }
  }

  return tokens;
}

/**
 * Simple wrapper: check if a string is in the language of a grammar.
 * Uses CYK internally.
 */
export function accepts(grammar: Grammar, input: string): ParseResult {
  return cyk(grammar, input);
}
