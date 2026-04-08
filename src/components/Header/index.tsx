import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useUIStore } from '../../store/ui-store';

export function Header() {
  const { mode, setMode, togglePreprocessingPanel, preprocessingPanelOpen, setHelpOpen } = useUIStore();

  return (
    <header className="header anim-header">
      {/* Logo */}
      <div className="header-logo">
        <div className="logo-sigma">Σ</div>
        <div className="logo-text">
          <div className="logo-title">CFG PDA Visualizer</div>
          <div className="logo-subtitle">FORMAL LANGUAGES TOOLKIT</div>
        </div>
      </div>

      <div className="header-spacer" />

      {/* Mode Toggle Pills */}
      <div className="mode-pills" role="tablist" aria-label="App mode">
        <button
          className={`pill-btn ${mode === 'cfg-to-pda' ? 'active neon-cyan' : ''}`}
          role="tab"
          aria-selected={mode === 'cfg-to-pda'}
          onClick={() => { setMode('cfg-to-pda'); useUIStore.getState().setInputMode('cfg'); }}
        >
          CFG → PDA
        </button>
        <button
          className={`pill-btn ${mode === 'pda-to-cfg' ? 'active neon-cyan' : ''}`}
          role="tab"
          aria-selected={mode === 'pda-to-cfg'}
          onClick={() => { setMode('pda-to-cfg'); useUIStore.getState().setInputMode('pda'); }}
        >
          PDA → CFG
        </button>
        <button
          className={`pill-btn ${mode === 'theory' ? 'active neon-purple' : ''}`}
          role="tab"
          aria-selected={mode === 'theory'}
          onClick={() => setMode('theory')}
        >
          Theory
        </button>
      </div>

      {/* Preprocessing toggle */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={togglePreprocessingPanel}
        aria-expanded={preprocessingPanelOpen}
        aria-controls="preprocessing-panel"
      >
        Preprocess
        {preprocessingPanelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Help */}
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => setHelpOpen(true)}
        aria-label="Help"
      >
        <HelpCircle size={15} />
      </button>
    </header>
  );
}
