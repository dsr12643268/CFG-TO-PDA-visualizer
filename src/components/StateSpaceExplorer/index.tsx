import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Play, Pause, SkipForward, RotateCcw, ZoomIn, Eye, EyeOff } from 'lucide-react';
import { useSimulationStore } from '../../store/simulation-store';
import { usePDAStore } from '../../store/pda-store';
import { bfsStep, computeStats } from '../../engine/bfs-engine';
import type { Configuration } from '../../engine/types';

// ─── D3 Node shape ────────────────────────────────────────────
interface D3Node {
  id: string;
  x: number;
  y: number;
  depth: number;
  config: Configuration;
}

interface D3Link {
  source: D3Node;
  target: D3Node;
  label: string;
}

const NODE_WIDTH = 130;
const NODE_HEIGHT = 64;
const LEVEL_GAP = 100;
const NODE_GAP = 20;

// Status → color
const STATUS_COLOR: Record<string, string> = {
  active: 'var(--color-active)',
  accepting: 'var(--color-accept)',
  rejected: '#3a3835',
  visited: '#2a2a2a',
  pending: 'var(--border-panel)',
};

const STATUS_TEXT: Record<string, string> = {
  active: 'var(--color-active)',
  accepting: 'var(--color-accept)',
  rejected: 'var(--text-tertiary)',
  visited: 'var(--text-tertiary)',
  pending: 'var(--text-secondary)',
};

export function StateSpaceExplorer() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    bfsState, mode, speed, stats,
    setActiveConfig, addToHistory, cursor,
    play, pause, reset, initSimulation,
    acceptingPaths,
  } = useSimulationStore();

  const { pda } = usePDAStore();
  const [showVisited, setShowVisited] = useState(true);
  const [inputVal, setInputVal] = useState('aabb');

  // Current step state for controls
  const isPlaying = mode === 'running';
  const isDone = mode === 'done';

  // ─── Step forward one BFS level ───────────────────────────
  const stepBFS = useCallback(() => {
    const { bfsState: bs } = useSimulationStore.getState();
    const currentPDA = pda;
    if (!bs || !currentPDA || bs.done) {
      useSimulationStore.setState({ mode: 'done' });
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const prevStack = useSimulationStore.getState().cursor.stack_contents;
    const prevRemaining = useSimulationStore.getState().cursor.remaining_input;

    const newFrontier = bfsStep(bs, currentPDA);
    const newStats = computeStats(bs.configMap);

    useSimulationStore.setState({
      stats: newStats,
      acceptingPaths: [...bs.acceptingPaths],
    });

    if (newFrontier.length > 0) {
      const firstConfig = bs.configMap.get(newFrontier[0]);
      if (firstConfig) {
        setActiveConfig(newFrontier[0]);
        addToHistory({
          step: bs.step,
          rule: firstConfig.ruleApplied,
          configId: newFrontier[0],
          stackBefore: prevStack,
          stackAfter: firstConfig.stack,
          remainingBefore: prevRemaining,
          remainingAfter: firstConfig.remaining,
        });
      }
    }

    if (bs.done || newFrontier.length === 0) {
      useSimulationStore.setState({ mode: 'done' });
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    // Force re-render
    renderTree();
  }, [pda, setActiveConfig, addToHistory]);

  // ─── Play / Pause ─────────────────────────────────────────
  useEffect(() => {
    if (isPlaying && pda) {
      const delay = Math.round(1200 / speed);
      intervalRef.current = setInterval(stepBFS, delay);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, stepBFS, pda]);

  // ─── D3 Rendering ─────────────────────────────────────────
  const renderTree = useCallback(() => {
    const { bfsState: bs } = useSimulationStore.getState();
    const { activeConfigId } = useSimulationStore.getState();
    if (!svgRef.current || !bs) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 800;

    // Collect all configs grouped by depth
    const byDepth = new Map<number, Configuration[]>();
    for (const config of bs.configMap.values()) {
      if (!showVisited && config.status === 'visited') continue;
      const d = config.depth;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(config);
    }

    const maxDepth = byDepth.size > 0 ? Math.max(...byDepth.keys()) : 0;

    // Assign x, y positions
    const nodeMap = new Map<string, D3Node>();
    for (const [depth, configs] of byDepth.entries()) {
      const total = configs.length;
      const totalWidth = total * NODE_WIDTH + (total - 1) * NODE_GAP;
      const startX = (width - totalWidth) / 2;
      configs.forEach((config, i) => {
        nodeMap.set(config.id, {
          id: config.id,
          x: startX + i * (NODE_WIDTH + NODE_GAP),
          y: depth * (NODE_HEIGHT + LEVEL_GAP) + 30,
          depth,
          config,
        });
      });
    }

    // Build links
    const links: D3Link[] = [];
    for (const node of nodeMap.values()) {
      for (const childId of node.config.children) {
        if (nodeMap.has(childId)) {
          const childNode = nodeMap.get(childId)!;
          links.push({
            source: node,
            target: childNode,
            label: childNode.config.ruleApplied.length > 20
              ? childNode.config.ruleApplied.slice(0, 18) + '…'
              : childNode.config.ruleApplied,
          });
        }
      }
    }

    // ─── D3 update pattern ────────────────────────────────
    svg.attr('viewBox', `0 0 ${width} ${maxDepth * (NODE_HEIGHT + LEVEL_GAP) + NODE_HEIGHT + 60}`)
       .attr('width', width)
       .attr('height', `100%`);

    // Zoom group
    let gMain = svg.select<SVGGElement>('g.main-group');
    if (gMain.empty()) {
      gMain = svg.append('g').attr('class', 'main-group');
      // Setup zoom
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
          gMain.attr('transform', event.transform);
        });
      svg.call(zoom);
    }

    // ─── Links ────────────────────────────────────────────
    const linkSel = gMain.selectAll<SVGLineElement, D3Link>('line.tree-link')
      .data(links, d => `${d.source.id}-${d.target.id}`);

    const linkEnter = linkSel.enter()
      .append('line')
      .attr('class', 'tree-link')
      .attr('x1', d => d.source.x + NODE_WIDTH / 2)
      .attr('y1', d => d.source.y + NODE_HEIGHT)
      .attr('x2', d => d.target.x + NODE_WIDTH / 2)
      .attr('y2', d => d.target.y)
      .attr('stroke-width', 1)
      .attr('opacity', 0);

    linkEnter.transition().duration(200).attr('opacity', 1);

    // Update all (enter + existing)
    linkSel.merge(linkEnter)
      .attr('x1', d => d.source.x + NODE_WIDTH / 2)
      .attr('y1', d => d.source.y + NODE_HEIGHT)
      .attr('x2', d => d.target.x + NODE_WIDTH / 2)
      .attr('y2', d => d.target.y)
      .attr('stroke', d => {
        if (d.target.config.status === 'accepting') return 'var(--color-accept)';
        if (d.target.config.status === 'rejected') return 'var(--border-subtle)';
        if (d.target.config.status === 'visited') return 'var(--color-visited)';
        return 'var(--border-panel)';
      });

    linkSel.exit().remove();

    // ─── Link labels ─────────────────────────────────────
    const labelSel = gMain.selectAll<SVGTextElement, D3Link>('text.link-label')
      .data(links, d => `lbl-${d.source.id}-${d.target.id}`);

    const labelEnter = labelSel.enter()
      .append('text')
      .attr('class', 'link-label')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', 8)
      .attr('fill', 'var(--text-tertiary)')
      .attr('text-anchor', 'middle')
      .attr('x', d => (d.source.x + d.target.x) / 2 + NODE_WIDTH / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2 + NODE_HEIGHT / 2 + 4)
      .attr('opacity', 0);

    labelEnter.transition().duration(200).attr('opacity', 0.7);

    labelSel.merge(labelEnter)
      .attr('x', d => (d.source.x + d.target.x) / 2 + NODE_WIDTH / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2 + NODE_HEIGHT / 2 + 4)
      .text(d => d.label);

    labelSel.exit().remove();

    // ─── Nodes ────────────────────────────────────────────
    const nodes = [...nodeMap.values()];
    const nodeSel = gMain.selectAll<SVGGElement, D3Node>('g.bfs-node-g')
      .data(nodes, d => d.id);

    const nodeEnter = nodeSel.enter()
      .append('g')
      .attr('class', 'bfs-node-g')
      .attr('cursor', 'pointer')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('opacity', 0)
      .on('click', (_event, d) => {
        setActiveConfig(d.id);
        renderTree();
      });

    // Background rect
    nodeEnter.append('rect')
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT)
      .attr('rx', 6)
      .attr('fill', 'var(--bg-panel)')
      .attr('stroke', d => STATUS_COLOR[d.config.status] ?? 'var(--border-panel)')
      .attr('stroke-width', d => d.id === activeConfigId ? 2 : 1);

    // State label (top row)
    nodeEnter.append('text')
      .attr('x', 8)
      .attr('y', 14)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', 9)
      .attr('fill', 'var(--text-secondary)')
      .text(d => `q=${d.config.state}`);

    // Status dot
    nodeEnter.append('circle')
      .attr('cx', NODE_WIDTH - 10)
      .attr('cy', 10)
      .attr('r', 4)
      .attr('fill', d => STATUS_COLOR[d.config.status] ?? 'var(--border-panel)');

    // Remaining input
    nodeEnter.append('text')
      .attr('x', 8)
      .attr('y', 28)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', 10)
      .attr('fill', d => STATUS_TEXT[d.config.status] ?? 'var(--text-mono)')
      .text(d => {
        const rem = d.config.remaining || 'ε';
        return rem.length > 12 ? rem.slice(0, 10) + '…' : rem;
      });

    // Stack display
    nodeEnter.append('text')
      .attr('x', 8)
      .attr('y', 42)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', 9)
      .attr('fill', 'var(--accent)')
      .text(d => {
        const s = d.config.stack.slice(0, 5);
        const str = '[' + s.join('') + (d.config.stack.length > 5 ? '…' : '') + ']';
        return str;
      });

    // Status text bottom
    nodeEnter.append('text')
      .attr('x', 8)
      .attr('y', 57)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', 8)
      .attr('fill', d => STATUS_COLOR[d.config.status] ?? 'var(--text-tertiary)')
      .text(d => d.config.status.toUpperCase());

    // Animate in
    nodeEnter.transition().duration(200)
      .attr('opacity', 1)
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Update existing nodes (color updates, selection)
    const nodeMerge = nodeEnter.merge(nodeSel);

    nodeMerge.transition().duration(150)
      .attr('transform', d => `translate(${d.x},${d.y})`);

    nodeMerge.select('rect')
      .attr('stroke', d => d.id === activeConfigId ? 'var(--accent)' : (STATUS_COLOR[d.config.status] ?? 'var(--border-panel)'))
      .attr('stroke-width', d => d.id === activeConfigId ? 2.5 : 1)
      .attr('fill', d => d.id === activeConfigId ? 'var(--accent-glow)' : 'var(--bg-panel)');

    nodeSel.exit().remove();
  }, [showVisited, setActiveConfig]);

  // Re-render when bfsState or activeConfig changes
  useEffect(() => {
    renderTree();
  }, [bfsState, renderTree, cursor.activeConfigId]);

  // Setup resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => renderTree());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [renderTree]);

  const handleResetView = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 3]);
    svg.call(zoom.transform, d3.zoomIdentity);
  };

  const handleInit = () => {
    if (!pda) return;
    initSimulation(pda, inputVal);
    setTimeout(renderTree, 50);
  };

  return (
    <div className="sim-panel hero-panel anim-panel-3" role="region" aria-label="State Space Explorer">
      {/* Header */}
      <div className="panel-header" style={{ flexShrink: 0 }}>
        <span className="panel-title">
          <span className="panel-title-accent">STATE-SPACE</span> EXPLORER
        </span>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => setShowVisited(v => !v)}
          title={showVisited ? 'Hide visited nodes' : 'Show visited nodes'}
          aria-label={showVisited ? 'Hide visited nodes' : 'Show visited nodes'}
        >
          {showVisited ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleResetView}
          aria-label="Reset zoom/pan"
        >
          <ZoomIn size={12} /> Reset View
        </button>
      </div>

      {/* Live counters */}
      <div className="counter-row">
        <div className="counter-badge">
          <span className="label">Explored</span>
          <span className="value" style={{ color: 'var(--text-primary)' }}>{stats.total}</span>
        </div>
        <div className="counter-badge">
          <span className="label">Active</span>
          <span className="value" style={{ color: 'var(--color-active)' }}>{stats.active}</span>
        </div>
        <div className="counter-badge">
          <span className="label">Accepted</span>
          <span className="value" style={{ color: 'var(--color-accept)' }}>{stats.accepting}</span>
        </div>
        <div className="counter-badge">
          <span className="label">Rejected</span>
          <span className="value" style={{ color: 'var(--color-reject)' }}>{stats.rejected}</span>
        </div>
        <div className="counter-badge">
          <span className="label">Visited</span>
          <span className="value" style={{ color: 'var(--text-tertiary)' }}>{stats.visited}</span>
        </div>
        {acceptingPaths.length > 1 && (
          <div className="counter-badge">
            <span className="label" style={{ color: 'var(--color-accept)' }}>⚠ AMBIGUOUS</span>
            <span className="value" style={{ color: 'var(--color-accept)' }}>{acceptingPaths.length} paths</span>
          </div>
        )}
      </div>

      {/* Input + controls row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <input
          id="bfs-input-string"
          type="text"
          className="text-input"
          style={{ flex: 1, minWidth: 0, fontSize: 12 }}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          placeholder="Input string (e.g. aabb)"
          aria-label="Input string for BFS simulation"
          onKeyDown={e => { if (e.key === 'Enter') handleInit(); }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleInit}
          disabled={!pda}
          aria-label="Initialize BFS simulation"
        >
          Init
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border-grid)', margin: '0 2px' }} />

        {/* Play/Pause */}
        <button
          id="btn-bfs-play-pause"
          className="btn btn-sm"
          onClick={isPlaying ? pause : play}
          disabled={!bfsState || isDone}
          aria-label={isPlaying ? 'Pause BFS' : 'Play BFS'}
        >
          {isPlaying ? <Pause size={11} /> : <Play size={11} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        {/* Step */}
        <button
          id="btn-bfs-step"
          className="btn btn-sm"
          onClick={stepBFS}
          disabled={!bfsState || isDone || isPlaying}
          aria-label="Step BFS forward"
        >
          <SkipForward size={11} />
          Step
        </button>

        {/* Reset */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { reset(); }}
          aria-label="Reset BFS"
        >
          <RotateCcw size={11} />
        </button>

        {/* Speed slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
          <span>Speed</span>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.5}
            value={speed}
            onChange={e => useSimulationStore.setState({ speed: parseFloat(e.target.value) })}
            style={{ width: 60, accentColor: 'var(--accent)' }}
            aria-label="BFS animation speed"
          />
          <span style={{ fontFamily: 'var(--font-mono)', minWidth: 24 }}>{speed}x</span>
        </div>
      </div>

      {/* D3 SVG canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-void)' }}
      >
        {!bfsState ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12, gap: 8,
          }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>∅</div>
            <div>Convert a grammar and initialize the simulation</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.6 }}>
              to explore the full state space
            </div>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="d3-svg"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            role="img"
            aria-label="BFS state space tree"
          />
        )}

        {/* Done overlay */}
        {isDone && bfsState && (
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: acceptingPaths.length > 0 ? 'var(--color-accept-dim)' : 'var(--color-reject-dim)',
            border: `1px solid ${acceptingPaths.length > 0 ? 'var(--color-accept)' : 'var(--color-reject)'}`,
            borderRadius: 'var(--r-lg)',
            padding: '6px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: acceptingPaths.length > 0 ? 'var(--color-accept)' : 'var(--color-reject)',
          }}>
            {acceptingPaths.length > 0
              ? `✓ ${acceptingPaths.length} accepting path${acceptingPaths.length > 1 ? 's' : ''} found`
              : '✗ String rejected — no accepting paths'
            }
          </div>
        )}
      </div>
    </div>
  );
}
