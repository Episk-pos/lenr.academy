import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../contexts/DatabaseContext';
import { useTheme } from '../contexts/ThemeContext';
import type { IsotopeChartProps, ChartNuclide } from '../types';
import {
  getAllNuclidesForChart,
  getValleyOfStabilityPoints,
  getStabilityColor,
  getReactionPathColor,
  MAGIC_NUMBERS,
  isMagicNumber,
} from '../services/isotopeChartService';

const CELL_SIZE = 8;  // Base cell size in pixels
const PADDING = 60;   // Padding for axis labels
const GRID_INTERVAL = 5;  // Draw grid lines every N cells

export default function IsotopeChart({
  highlightedNuclides = [],
  reactionPaths = [],
  showValleyOfStability = true,
  showMagicNumbers = true,
  onNuclideClick,
}: IsotopeChartProps) {
  const { db } = useDatabase();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNuclide, setHoveredNuclide] = useState<ChartNuclide | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const isDark = theme === 'dark';

  // Load all nuclides from database
  const nuclides = useMemo(() => {
    if (!db) return [];
    return getAllNuclidesForChart(db);
  }, [db]);

  // Calculate chart dimensions
  const { maxZ, maxN, chartWidth, chartHeight } = useMemo(() => {
    const maxZ = Math.max(...nuclides.map(n => n.Z), 94);
    const maxN = Math.max(...nuclides.map(n => n.N), 150);
    const chartWidth = PADDING + (maxZ + 1) * CELL_SIZE + PADDING;
    const chartHeight = PADDING + (maxN + 1) * CELL_SIZE + PADDING;
    return { maxZ, maxN, chartWidth, chartHeight };
  }, [nuclides]);

  // Create lookup map for nuclides by Z-N coordinates
  const nuclideMap = useMemo(() => {
    const map = new Map<string, ChartNuclide>();
    nuclides.forEach(n => {
      map.set(`${n.Z}-${n.N}`, n);
    });
    return map;
  }, [nuclides]);

  // Valley of stability points
  const valleyPoints = useMemo(() => getValleyOfStabilityPoints(maxZ), [maxZ]);

  // Convert highlighted nuclides to Set for O(1) lookup
  const highlightedSet = useMemo(() => new Set(highlightedNuclides), [highlightedNuclides]);

  // Draw the chart on canvas
  useEffect(() => {
    if (!canvasRef.current || nuclides.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = chartWidth;
    canvas.height = chartHeight;

    // Clear canvas
    ctx.fillStyle = isDark ? '#111827' : '#ffffff';  // gray-900 / white
    ctx.fillRect(0, 0, chartWidth, chartHeight);

    // Draw grid lines
    ctx.strokeStyle = isDark ? '#374151' : '#e5e7eb';  // gray-700 / gray-200
    ctx.lineWidth = 0.5;

    for (let z = 0; z <= maxZ; z += GRID_INTERVAL) {
      const x = PADDING + z * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, PADDING + maxN * CELL_SIZE);
      ctx.stroke();
    }

    for (let n = 0; n <= maxN; n += GRID_INTERVAL) {
      const y = PADDING + (maxN - n) * CELL_SIZE;  // Invert Y axis (N increases upward)
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(PADDING + maxZ * CELL_SIZE, y);
      ctx.stroke();
    }

    // Draw nuclide cells
    nuclides.forEach(nuclide => {
      const x = PADDING + nuclide.Z * CELL_SIZE;
      const y = PADDING + (maxN - nuclide.N) * CELL_SIZE;  // Invert Y axis

      // Get color based on stability
      const color = getStabilityColor(nuclide.stability, isDark);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);

      // Highlight if in highlighted set
      if (highlightedSet.has(`${nuclide.Z}-${nuclide.A}`)) {
        ctx.strokeStyle = '#fbbf24';  // amber-400
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, y - 1, CELL_SIZE + 1, CELL_SIZE + 1);
      }
    });

    // Draw axis labels
    ctx.fillStyle = isDark ? '#e5e7eb' : '#1f2937';  // gray-200 / gray-800
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Z axis label
    ctx.save();
    ctx.translate(chartWidth / 2, chartHeight - 20);
    ctx.fillText('Proton Number (Z)', 0, 0);
    ctx.restore();

    // N axis label
    ctx.save();
    ctx.translate(20, chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Neutron Number (N)', 0, 0);
    ctx.restore();

    // Draw Z axis tick labels
    ctx.font = '10px sans-serif';
    for (let z = 0; z <= maxZ; z += 10) {
      const x = PADDING + z * CELL_SIZE;
      ctx.fillText(z.toString(), x, PADDING - 10);
    }

    // Draw N axis tick labels
    for (let n = 0; n <= maxN; n += 10) {
      const y = PADDING + (maxN - n) * CELL_SIZE;
      ctx.textAlign = 'right';
      ctx.fillText(n.toString(), PADDING - 10, y);
    }

  }, [nuclides, chartWidth, chartHeight, maxZ, maxN, isDark, highlightedSet]);

  // Handle mouse move for hover tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    // Convert canvas coordinates to Z, N
    const Z = Math.floor((canvasX - PADDING) / CELL_SIZE);
    const N = maxN - Math.floor((canvasY - PADDING) / CELL_SIZE);

    // Look up nuclide at this position
    const nuclide = nuclideMap.get(`${Z}-${N}`);

    if (nuclide) {
      setHoveredNuclide(nuclide);
      setMousePos({ x: e.clientX, y: e.clientY });
    } else {
      setHoveredNuclide(null);
      setMousePos(null);
    }
  }, [maxN, nuclideMap]);

  const handleMouseLeave = useCallback(() => {
    setHoveredNuclide(null);
    setMousePos(null);
  }, []);

  // Handle click on nuclide
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const Z = Math.floor((canvasX - PADDING) / CELL_SIZE);
    const N = maxN - Math.floor((canvasY - PADDING) / CELL_SIZE);

    const nuclide = nuclideMap.get(`${Z}-${N}`);

    if (nuclide) {
      if (onNuclideClick) {
        onNuclideClick(nuclide.Z, nuclide.A, nuclide.E);
      } else {
        // Default: navigate to element data page
        navigate(`/element-data?Z=${nuclide.Z}&A=${nuclide.A}`);
      }
    }
  }, [maxN, nuclideMap, onNuclideClick, navigate]);

  if (!db || nuclides.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 dark:text-gray-400">
        Loading isotope chart...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={5}
        centerOnInit
        wheel={{ step: 0.1 }}
        doubleClick={{ mode: 'reset' }}
      >
        <TransformComponent
          wrapperClass="!w-full !h-full"
          contentClass="!w-full !h-full flex items-center justify-center"
        >
          <div className="relative" style={{ width: chartWidth, height: chartHeight }}>
            {/* Canvas for nuclide cells and grid */}
            <canvas
              ref={canvasRef}
              className="cursor-pointer"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
            />

            {/* SVG overlay for valley, magic numbers, and reaction paths */}
            <svg
              width={chartWidth}
              height={chartHeight}
              className="absolute top-0 left-0 pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              {/* Valley of stability line */}
              {showValleyOfStability && (
                <polyline
                  points={valleyPoints
                    .map(([z, n]) => {
                      const x = PADDING + z * CELL_SIZE + CELL_SIZE / 2;
                      const y = PADDING + (maxN - n) * CELL_SIZE + CELL_SIZE / 2;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  opacity="0.6"
                />
              )}

              {/* Magic number lines */}
              {showMagicNumbers && MAGIC_NUMBERS.map(magic => {
                if (magic > maxZ && magic > maxN) return null;

                return (
                  <g key={`magic-${magic}`}>
                    {/* Vertical line for magic Z */}
                    {magic <= maxZ && (
                      <line
                        x1={PADDING + magic * CELL_SIZE}
                        y1={PADDING}
                        x2={PADDING + magic * CELL_SIZE}
                        y2={PADDING + maxN * CELL_SIZE}
                        stroke="#8b5cf6"
                        strokeWidth="1.5"
                        strokeDasharray="3,3"
                        opacity="0.4"
                      />
                    )}
                    {/* Horizontal line for magic N */}
                    {magic <= maxN && (
                      <line
                        x1={PADDING}
                        y1={PADDING + (maxN - magic) * CELL_SIZE}
                        x2={PADDING + maxZ * CELL_SIZE}
                        y2={PADDING + (maxN - magic) * CELL_SIZE}
                        stroke="#8b5cf6"
                        strokeWidth="1.5"
                        strokeDasharray="3,3"
                        opacity="0.4"
                      />
                    )}
                  </g>
                );
              })}

              {/* Reaction pathways */}
              {reactionPaths.map((pathway, idx) => {
                // Calculate average position of "from" nuclides
                const fromX = pathway.from.reduce((sum, n) => sum + PADDING + n.Z * CELL_SIZE + CELL_SIZE / 2, 0) / pathway.from.length;
                const fromY = pathway.from.reduce((sum, n) => sum + PADDING + (maxN - n.N) * CELL_SIZE + CELL_SIZE / 2, 0) / pathway.from.length;

                // Calculate average position of "to" nuclides
                const toX = pathway.to.reduce((sum, n) => sum + PADDING + n.Z * CELL_SIZE + CELL_SIZE / 2, 0) / pathway.to.length;
                const toY = pathway.to.reduce((sum, n) => sum + PADDING + (maxN - n.N) * CELL_SIZE + CELL_SIZE / 2, 0) / pathway.to.length;

                const color = getReactionPathColor(pathway.reactionType);

                return (
                  <g key={`pathway-${idx}`}>
                    <defs>
                      <marker
                        id={`arrowhead-${idx}`}
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="3"
                        orient="auto"
                      >
                        <polygon
                          points="0 0, 10 3, 0 6"
                          fill={color}
                        />
                      </marker>
                    </defs>
                    <line
                      x1={fromX}
                      y1={fromY}
                      x2={toX}
                      y2={toY}
                      stroke={color}
                      strokeWidth="2"
                      markerEnd={`url(#arrowhead-${idx})`}
                      opacity="0.7"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Hover tooltip */}
      {hoveredNuclide && mousePos && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 text-sm pointer-events-none"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y + 15,
          }}
        >
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {hoveredNuclide.E}-{hoveredNuclide.A}
          </div>
          <div className="text-gray-600 dark:text-gray-400 text-xs mt-1 space-y-0.5">
            <div>Z: {hoveredNuclide.Z} (protons)</div>
            <div>N: {hoveredNuclide.N} (neutrons)</div>
            <div>A: {hoveredNuclide.A} (mass)</div>
            {hoveredNuclide.logHalfLife !== undefined && (
              <div>
                Half-life: {hoveredNuclide.logHalfLife > 9
                  ? 'Stable'
                  : `10^${hoveredNuclide.logHalfLife.toFixed(1)} years`}
              </div>
            )}
            <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 italic">
              {isMagicNumber(hoveredNuclide.Z) && <div>Magic Z ({hoveredNuclide.Z})</div>}
              {isMagicNumber(hoveredNuclide.N) && <div>Magic N ({hoveredNuclide.N})</div>}
              {!isMagicNumber(hoveredNuclide.Z) && !isMagicNumber(hoveredNuclide.N) && (
                <div>Click to view details</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
