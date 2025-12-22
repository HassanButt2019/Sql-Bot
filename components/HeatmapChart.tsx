import React, { useState } from 'react';

interface HeatmapData {
  x: string;
  y: string;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapData[];
  xCategories?: string[];
  yCategories?: string[];
  title: string;
  colorScheme?: 'default' | 'warm' | 'cool' | 'diverging';
  height?: number;
  valueLabel?: string;
}

const HeatmapChart: React.FC<HeatmapChartProps> = ({
  data,
  xCategories,
  yCategories,
  title,
  colorScheme = 'default',
  height = 350,
  valueLabel = 'Value'
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ x: string; y: string; value: number } | null>(null);

  // Defensive: Ensure data is an array
  const safeData = Array.isArray(data) ? data : [];

  // Extract unique categories if not provided, handle empty data
  const xCats = xCategories || (safeData.length > 0 ? [...new Set(safeData.map(d => d.x))] : []);
  const yCats = yCategories || (safeData.length > 0 ? [...new Set(safeData.map(d => d.y))] : []);

  // Defensive: If no categories, show empty state
  if (!xCats || !yCats || xCats.length === 0 || yCats.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center" style={{ height }}>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</h4>
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm">
          No data available for heatmap.
        </div>
      </div>
    );
  }

  // Calculate min/max values for color scaling
  const values = safeData.map(d => d.value);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 1;
  const valueRange = maxValue - minValue || 1;

  // Color schemes
  const colorSchemes = {
    default: ['#eff6ff', '#bfdbfe', '#60a5fa', '#3b82f6', '#1d4ed8', '#1e3a8a'],
    warm: ['#fef3c7', '#fcd34d', '#f59e0b', '#d97706', '#b45309', '#78350f'],
    cool: ['#f0fdfa', '#99f6e4', '#2dd4bf', '#14b8a6', '#0d9488', '#115e59'],
    diverging: ['#ef4444', '#fca5a5', '#fef2f2', '#f0fdf4', '#86efac', '#22c55e']
  };

  const colors = colorSchemes[colorScheme] || colorSchemes.default;

  // Get color for value
  const getColor = (value: number): string => {
    const normalized = (value - minValue) / valueRange;
    const index = Math.min(Math.floor(normalized * (colors.length - 1)), colors.length - 1);
    return colors[index];
  };

  // Get value for cell
  const getCellValue = (x: string, y: string): number | null => {
    const cell = safeData.find(d => d.x === x && d.y === y);
    return cell?.value ?? null;
  };

  // Calculate cell dimensions
  const cellWidth = Math.max(40, Math.min(80, 600 / xCats.length));
  const cellHeight = Math.max(30, Math.min(50, (height - 80) / yCats.length));
  const labelWidth = 100;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" style={{ height }}>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
        {title}
      </h4>

      <div className="flex flex-col h-[calc(100%-40px)]">
        {/* Heatmap container */}
        <div className="flex-1 overflow-auto">
          <div className="flex">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-start pr-2" style={{ paddingTop: cellHeight / 2 + 20 }}>
              {yCats && yCats.length > 0 && yCats.map((yLabel) => (
                <div
                  key={yLabel}
                  className="text-xs font-medium text-slate-500 truncate text-right"
                  style={{ height: cellHeight, lineHeight: `${cellHeight}px`, width: labelWidth }}
                  title={yLabel}
                >
                  {yLabel.length > 12 ? yLabel.slice(0, 12) + '...' : yLabel}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex flex-col">
              {/* X-axis labels */}
              <div className="flex mb-2">
                {xCats && xCats.length > 0 && xCats.map((xLabel) => (
                  <div
                    key={xLabel}
                    className="text-xs font-medium text-slate-500 text-center truncate"
                    style={{ width: cellWidth, transform: 'rotate(-45deg)', transformOrigin: 'bottom left', height: 20 }}
                    title={xLabel}
                  >
                    {xLabel.length > 8 ? xLabel.slice(0, 8) + '...' : xLabel}
                  </div>
                ))}
              </div>

              {/* Cells */}
              {yCats && yCats.length > 0 && yCats.map((yLabel) => (
                <div key={yLabel} className="flex">
                  {xCats && xCats.length > 0 && xCats.map((xLabel) => {
                    const value = getCellValue(xLabel, yLabel);
                    const isHovered = hoveredCell?.x === xLabel && hoveredCell?.y === yLabel;
                    
                    return (
                      <div
                        key={`${xLabel}-${yLabel}`}
                        className={`border border-white/50 rounded-sm transition-all cursor-pointer ${
                          isHovered ? 'ring-2 ring-slate-900 ring-offset-1 z-10' : ''
                        }`}
                        style={{
                          width: cellWidth,
                          height: cellHeight,
                          backgroundColor: value !== null ? getColor(value) : '#f1f5f9'
                        }}
                        onMouseEnter={() => value !== null && setHoveredCell({ x: xLabel, y: yLabel, value })}
                        onMouseLeave={() => setHoveredCell(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredCell && (
          <div className="absolute bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs z-20 pointer-events-none"
            style={{ 
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-bold">{hoveredCell.x} × {hoveredCell.y}</div>
            <div className="text-slate-300">{valueLabel}: {hoveredCell.value.toLocaleString()}</div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-4 pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400">{minValue.toLocaleString()}</span>
          <div className="flex h-3 rounded-full overflow-hidden">
            {colors.map((color, i) => (
              <div key={i} className="w-6 h-full" style={{ backgroundColor: color }} />
            ))}
          </div>
          <span className="text-xs text-slate-400">{maxValue.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

export default HeatmapChart;
