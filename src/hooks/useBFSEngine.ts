// ============================================================
// ANTIGRAVITY — useBFSEngine Hook
// Manages BFS step loop, animation timing, Web Worker integration
// ============================================================

import { useCallback, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/simulation-store';
import { bfsStep, computeStats } from '../engine/bfs-engine';
import type { PDA } from '../engine/types';

const SPEED_TO_INTERVAL: Record<number, number> = {
  0.5: 2000,
  1: 1000,
  2: 500,
  4: 250,
};

export function useBFSEngine(pda: PDA | null) {
  const {
    bfsState,
    mode,
    speed,
    play,
    pause,
    reset,
    initSimulation,
    setActiveConfig,
    addToHistory,
    cursor,
  } = useSimulationStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pdaRef = useRef<PDA | null>(pda);
  pdaRef.current = pda;

  const step = useCallback(() => {
    const { bfsState: currentBFS } = useSimulationStore.getState();
    const currentPDA = pdaRef.current;
    if (!currentBFS || !currentPDA || currentBFS.done) {
      useSimulationStore.setState({ mode: 'done' });
      return;
    }

    const prevStack = useSimulationStore.getState().cursor.stack_contents;
    const prevRemaining = useSimulationStore.getState().cursor.remaining_input;

    // Execute one BFS level
    const newFrontier = bfsStep(currentBFS, currentPDA);

    // Update stats and accepting paths atomically
    const stats = computeStats(currentBFS.configMap);
    useSimulationStore.setState({
      stats,
      acceptingPaths: [...currentBFS.acceptingPaths],
    });

    // Move active config to first new frontier item
    if (newFrontier.length > 0) {
      setActiveConfig(newFrontier[0]);

      // Add to transition history
      const newConfig = currentBFS.configMap.get(newFrontier[0]);
      if (newConfig) {
        addToHistory({
          step: currentBFS.step,
          rule: newConfig.ruleApplied,
          configId: newFrontier[0],
          stackBefore: prevStack,
          stackAfter: newConfig.stack,
          remainingBefore: prevRemaining,
          remainingAfter: newConfig.remaining,
        });
      }
    }

    if (currentBFS.done || newFrontier.length === 0) {
      useSimulationStore.setState({ mode: 'done' });
    }
  }, [setActiveConfig, addToHistory]);

  // Auto-play loop
  useEffect(() => {
    if (mode === 'running') {
      const interval = SPEED_TO_INTERVAL[speed] ?? 1000;
      intervalRef.current = setInterval(step, interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mode, speed, step]);

  const startSimulation = useCallback((input: string) => {
    if (!pdaRef.current) return;
    initSimulation(pdaRef.current, input);
  }, [initSimulation]);

  return {
    bfsState,
    mode,
    speed,
    cursor,
    step,
    play,
    pause,
    reset,
    startSimulation,
  };
}
