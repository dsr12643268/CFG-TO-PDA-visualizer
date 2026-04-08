// ============================================================
// ANTIGRAVITY — Grammar Store (Zustand)
// State for the CFG Editor panel and grammar lifecycle
// ============================================================

import { create } from 'zustand';
import type { Grammar, PreprocessLogEntry } from '../engine/types';
import { parseGrammar, type ParseError } from '../engine/grammar-parser';
import {
  eliminateLeftRecursion,
  eliminateUnitProductions,
  eliminateEpsilonProductions,
  convertToCNF,
} from '../engine/preprocessor';

export interface PreprocessingToggles {
  eliminateLeftRecursion: boolean;
  eliminateUnitProductions: boolean;
  eliminateEpsilonProductions: boolean;
  convertToCNF: boolean;
}

export interface GrammarStore {
  // Raw input
  rawInput: string;
  setRawInput: (input: string) => void;

  // Parsed grammar
  grammar: Grammar | null;
  parseErrors: ParseError[];
  parseGrammar: () => void;

  // Preprocessing
  preprocessingToggles: PreprocessingToggles;
  setPreprocessingToggle: (key: keyof PreprocessingToggles, value: boolean) => void;
  preprocessedGrammar: Grammar | null;
  preprocessLog: PreprocessLogEntry[];
  runPreprocessing: () => void;

  // Active grammar (preprocessed if any toggle is on, else raw parsed)
  activeGrammar: Grammar | null;

  // Actions
  clearGrammar: () => void;
  loadExample: (rawInput: string) => void;
}

export const useGrammarStore = create<GrammarStore>((set, get) => ({
  rawInput: 'S → aSb | ab',
  grammar: null,
  parseErrors: [],
  preprocessingToggles: {
    eliminateLeftRecursion: false,
    eliminateUnitProductions: false,
    eliminateEpsilonProductions: false,
    convertToCNF: false,
  },
  preprocessedGrammar: null,
  preprocessLog: [],
  activeGrammar: null,

  setRawInput: (input) => {
    set({ rawInput: input });
    // Auto-parse on change
    const result = parseGrammar(input);
    set({
      grammar: result.grammar,
      parseErrors: result.errors,
      activeGrammar: result.grammar,
      preprocessedGrammar: null,
      preprocessLog: [],
    });
  },

  parseGrammar: () => {
    const { rawInput } = get();
    const result = parseGrammar(rawInput);
    set({
      grammar: result.grammar,
      parseErrors: result.errors,
      activeGrammar: result.grammar,
      preprocessedGrammar: null,
      preprocessLog: [],
    });
  },

  setPreprocessingToggle: (key, value) => {
    set(state => ({
      preprocessingToggles: { ...state.preprocessingToggles, [key]: value },
    }));
    // Re-run preprocessing with new toggle state
    get().runPreprocessing();
  },

  runPreprocessing: () => {
    const { grammar, preprocessingToggles } = get();
    if (!grammar) return;

    let current = grammar;
    const allLogs: PreprocessLogEntry[] = [];

    if (preprocessingToggles.eliminateLeftRecursion) {
      const r = eliminateLeftRecursion(current);
      current = r.result;
      allLogs.push(...r.log);
    }
    if (preprocessingToggles.eliminateUnitProductions) {
      const r = eliminateUnitProductions(current);
      current = r.result;
      allLogs.push(...r.log);
    }
    if (preprocessingToggles.eliminateEpsilonProductions) {
      const r = eliminateEpsilonProductions(current);
      current = r.result;
      allLogs.push(...r.log);
    }
    if (preprocessingToggles.convertToCNF) {
      const r = convertToCNF(current);
      current = r.result;
      allLogs.push(...r.log);
    }

    const hasAnyToggle = Object.values(preprocessingToggles).some(v => v);

    set({
      preprocessedGrammar: hasAnyToggle ? current : null,
      preprocessLog: allLogs,
      activeGrammar: hasAnyToggle ? current : grammar,
    });
  },

  clearGrammar: () => {
    set({
      rawInput: '',
      grammar: null,
      parseErrors: [],
      preprocessedGrammar: null,
      preprocessLog: [],
      activeGrammar: null,
    });
  },

  loadExample: (rawInput: string) => {
    const result = parseGrammar(rawInput);
    set({
      rawInput,
      grammar: result.grammar,
      parseErrors: result.errors,
      activeGrammar: result.grammar,
      preprocessedGrammar: null,
      preprocessLog: [],
      preprocessingToggles: {
        eliminateLeftRecursion: false,
        eliminateUnitProductions: false,
        eliminateEpsilonProductions: false,
        convertToCNF: false,
      },
    });
  },
}));
