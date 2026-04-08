// ============================================================
// ANTIGRAVITY — PDA Store (Zustand)
// State for the PDA Editor panel
// ============================================================

import { create } from 'zustand';
import type { PDA, Transition } from '../engine/types';

export interface PDAStore {
  pda: PDA | null;
  setPDA: (pda: PDA) => void;

  // Manual editing
  manualTransitions: Transition[];
  addTransition: (t: Transition) => void;
  removeTransition: (id: string) => void;
  updateTransition: (id: string, updates: Partial<Transition>) => void;

  // Source
  pdaSource: 'converted' | 'manual';
  setPDASource: (src: 'converted' | 'manual') => void;

  clearPDA: () => void;
}

let _manualTCounter = 0;

function rebuildPDA(transitions: Transition[]): PDA | null {
  if (transitions.length === 0) return null;
  const states = new Set<string>();
  const inputAlphabet = new Set<string>();
  const stackAlphabet = new Set<string>();
  for (const t of transitions) {
    states.add(t.fromState);
    states.add(t.toState);
    if (t.inputSymbol) inputAlphabet.add(t.inputSymbol);
    stackAlphabet.add(t.stackTop);
    t.stackPush.forEach(s => stackAlphabet.add(s));
  }
  return {
    states, inputAlphabet, stackAlphabet,
    transitions,
    startState: transitions[0].fromState,
    startStackSymbol: transitions[0].stackTop,
    acceptByEmptyStack: true,
  };
}

export const usePDAStore = create<PDAStore>((set, get) => ({
  pda: null,
  manualTransitions: [],
  pdaSource: 'converted',

  setPDA: (pda) => set({ pda, pdaSource: 'converted' }),

  addTransition: (t) => {
    const newT: Transition = {
      ...t,
      id: `manual_${++_manualTCounter}`,
      ruleType: 'manual',
      label: `δ(${t.fromState}, ${t.inputSymbol ?? 'ε'}, ${t.stackTop}) = (${t.toState}, ${t.stackPush.join('') || 'ε'})`,
    };
    const updated = [...get().manualTransitions, newT];
    set({ manualTransitions: updated, pda: rebuildPDA(updated) ?? get().pda, pdaSource: 'manual' });
  },

  removeTransition: (id) => {
    const updated = get().manualTransitions.filter(t => t.id !== id);
    set({ manualTransitions: updated, pda: rebuildPDA(updated) ?? get().pda });
  },

  updateTransition: (id, updates) => {
    const updated = get().manualTransitions.map(t => t.id === id ? { ...t, ...updates } : t);
    set({ manualTransitions: updated, pda: rebuildPDA(updated) ?? get().pda });
  },

  setPDASource: (src) => set({ pdaSource: src }),

  clearPDA: () => set({ pda: null, manualTransitions: [], pdaSource: 'converted' }),
}));
