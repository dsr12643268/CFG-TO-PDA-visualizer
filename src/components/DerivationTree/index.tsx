import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { useSimulationStore } from '../../store/simulation-store';
import { useGrammarStore } from '../../store/grammar-store';

const NODE_R = 18;

export function DerivationTree() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { cursor } = useSimulationStore();
  const { grammar } = useGrammarStore();

  const renderTree = useCallback(() => {
    if (!svgRef.current || !grammar) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 300;

    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'deriv-group');

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', event => g.attr('transform', event.transform));
    svg.call(zoom);

    const stack = cursor.stack_contents;
    const startSymbol = grammar.startSymbol;

    // Show start symbol at root
    g.append('circle')
      .attr('cx', width / 2)
      .attr('cy', 60)
      .attr('r', NODE_R)
      .attr('fill', 'var(--bg-panel)')
      .attr('stroke', 'var(--accent)')
      .attr('stroke-width', 2);

    g.append('text')
      .attr('x', width / 2)
      .attr('y', 64)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', 14)
      .attr('font-weight', 700)
      .attr('fill', 'var(--accent)')
      .text(startSymbol);

    // Draw stack as frontier below
    const frontierItems = stack.filter(s => s !== '$');
    if (frontierItems.length === 0) return;

    const nodeW = NODE_R * 2 + 16;
    const totalW = frontierItems.length * nodeW;
    const startX = width / 2 - totalW / 2 + NODE_R + 8;

    g.append('line')
      .attr('x1', width / 2)
      .attr('y1', 60 + NODE_R)
      .attr('x2', width / 2)
      .attr('y2', 60 + NODE_R + 30)
      .attr('stroke', 'var(--border-panel)')
      .attr('stroke-width', 1);

    frontierItems.forEach((sym, i) => {
      const isNT = grammar.nonTerminals.has(sym);
      const cx = startX + i * nodeW;
      const cy = 60 + NODE_R + 30 + NODE_R;

      g.append('line')
        .attr('x1', width / 2)
        .attr('y1', 60 + NODE_R + 30)
        .attr('x2', cx)
        .attr('y2', cy - NODE_R)
        .attr('stroke', 'var(--border-panel)')
        .attr('stroke-width', 1);

      g.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', NODE_R)
        .attr('fill', 'var(--bg-panel)')
        .attr('stroke', i === 0 && isNT ? 'var(--color-active)' : isNT ? 'var(--accent-dim)' : 'var(--border-panel)')
        .attr('stroke-width', i === 0 ? 2 : 1);

      g.append('text')
        .attr('x', cx)
        .attr('y', cy + 4)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'var(--font-mono)')
        .attr('font-size', 11)
        .attr('font-weight', i === 0 ? 700 : 400)
        .attr('fill', i === 0 && isNT ? 'var(--color-active)' : isNT ? 'var(--accent)' : 'var(--text-primary)')
        .text(sym);

      if (i === 0 && isNT) {
        g.append('text')
          .attr('x', cx)
          .attr('y', cy + NODE_R + 12)
          .attr('text-anchor', 'middle')
          .attr('font-family', 'var(--font-display)')
          .attr('font-size', 7)
          .attr('fill', 'var(--color-active)')
          .text('← FRONTIER');
      }
    });

  }, [cursor, grammar]);

  useEffect(() => {
    renderTree();
  }, [renderTree]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => renderTree());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [renderTree]);

  return (
    <div className="sim-panel" style={{ borderRight: '1px solid var(--border-grid)' }} role="region" aria-label="Derivation Tree">
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-title-accent">DERIVATION</span> TREE
        </span>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 12,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {[
          { color: 'var(--accent)', label: 'Non-terminal' },
          { color: 'var(--text-primary)', label: 'Terminal' },
          { color: 'var(--color-active)', label: 'Frontier' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg-void)' }}
      >
        {!grammar ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11,
          }}>
            Parse a grammar to see the derivation tree
          </div>
        ) : (
          <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%' }}
            role="img"
            aria-label="CFG derivation tree"
          />
        )}
      </div>
    </div>
  );
}
