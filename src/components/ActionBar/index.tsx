import { useState } from 'react';
import { Play, SkipForward, RotateCcw, ArrowRightLeft } from 'lucide-react';
import { useGrammarStore } from '../../store/grammar-store';
import { usePDAStore } from '../../store/pda-store';
import { useSimulationStore } from '../../store/simulation-store';
import { cfgToPDA } from '../../engine/cfg-to-pda';
import { pdaToCFG } from '../../engine/pda-to-cfg';
import { grammarToString } from '../../engine/grammar-parser';
import { useGrammarStore as _gs } from '../../store/grammar-store';

export function ActionBar() {
  const { activeGrammar } = useGrammarStore();
  const { pda, setPDA } = usePDAStore();
  const { mode, initSimulation, reset: resetSim, step: simStep } = useSimulationStore();
  const [converting, setConverting] = useState(false);

  const handleCFGtoPDA = () => {
    if (!activeGrammar) return;
    setConverting(true);
    setTimeout(() => {
      const newPDA = cfgToPDA(activeGrammar);
      setPDA(newPDA);
      setConverting(false);
    }, 30);
  };

  const handlePDAtoFG = () => {
    if (!pda) return;
    setConverting(true);
    setTimeout(() => {
      const grammar = pdaToCFG(pda);
      _gs.setState({
        grammar,
        activeGrammar: grammar,
        rawInput: grammarToString(grammar),
        parseErrors: [],
      });
      setConverting(false);
    }, 30);
  };

  const handleRunSim = () => {
    if (!pda) return;
    const { inputString } = useSimulationStore.getState();
    initSimulation(pda, inputString ?? '');
  };

  return (
    <div className="action-bar">
      {/* Conversion buttons */}
      <button
        id="btn-convert-cfg-pda"
        className={`btn btn-primary ${converting ? 'btn-converting' : ''}`}
        onClick={handleCFGtoPDA}
        disabled={!activeGrammar || converting}
        aria-label="Convert CFG to PDA"
      >
        <ArrowRightLeft size={13} />
        CFG → PDA
      </button>

      <button
        id="btn-convert-pda-cfg"
        className="btn"
        onClick={handlePDAtoFG}
        disabled={!pda || converting}
        aria-label="Convert PDA to CFG"
      >
        <ArrowRightLeft size={13} />
        PDA → CFG
      </button>

      <div className="action-bar-separator" />

      {/* Simulation controls */}
      <button
        id="btn-run-sim"
        className="btn"
        onClick={handleRunSim}
        disabled={!pda}
        aria-label="Initialize simulation"
      >
        <Play size={12} />
        Init Sim
      </button>

      <button
        id="btn-reset-sim"
        className="btn btn-ghost"
        onClick={resetSim}
        aria-label="Reset simulation"
      >
        <RotateCcw size={12} />
        Reset
      </button>

      <div style={{ flex: 1 }} />

      {/* Status indicator */}
      {converting && (
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          Converting...
        </span>
      )}
      {mode === 'done' && (
        <span style={{ fontSize: 11, color: 'var(--color-accept)', fontFamily: 'var(--font-mono)' }}>
          ✓ BFS complete
        </span>
      )}
      {mode === 'running' && (
        <span style={{ fontSize: 11, color: 'var(--color-active)', fontFamily: 'var(--font-mono)' }}>
          ⟳ Running...
        </span>
      )}
    </div>
  );
}
