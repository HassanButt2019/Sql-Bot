import React from 'react';

interface GaugeChartProps {
  value: number;
  min?: number;
  max?: number;
  title: string;
  unit?: string;
  thresholds?: { value: number; color: string; label?: string }[];
  height?: number;
}

const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  min = 0,
  max = 100,
  title,
  unit = '',
  thresholds = [
    { value: 30, color: '#ef4444', label: 'Low' },
    { value: 70, color: '#f59e0b', label: 'Medium' },
    { value: 100, color: '#10b981', label: 'High' }
  ],
  height = 200
}) => {
  // Normalize value to percentage
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  
  // Calculate angle for gauge needle (180 degree arc, from -90 to 90)
  const angle = (percentage / 100) * 180 - 90;
  
  // Get color based on thresholds
  const getColor = () => {
    const normalizedValue = (value - min) / (max - min) * 100;
    for (let i = 0; i < thresholds.length; i++) {
      if (normalizedValue <= thresholds[i].value) {
        return thresholds[i].color;
      }
    }
    return thresholds[thresholds.length - 1]?.color || '#3b82f6';
  };

  const color = getColor();

  // SVG dimensions
  const svgWidth = 200;
  const svgHeight = 120;
  const cx = svgWidth / 2;
  const cy = svgHeight - 10;
  const radius = 80;
  const strokeWidth = 12;

  // Create arc path for background
  const createArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians)
    };
  };

  // Create threshold arcs
  const createThresholdArcs = () => {
    const arcs = [];
    let prevValue = 0;
    
    for (let i = 0; i < thresholds.length; i++) {
      const startAngle = (prevValue / 100) * 180;
      const endAngle = (Math.min(thresholds[i].value, 100) / 100) * 180;
      
      arcs.push(
        <path
          key={i}
          d={createArc(startAngle, endAngle)}
          fill="none"
          stroke={thresholds[i].color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.2}
        />
      );
      
      prevValue = thresholds[i].value;
    }
    
    return arcs;
  };

  // Active arc (filled portion)
  const activeArcPath = createArc(0, (percentage / 100) * 180);

  // Format display value
  const formatValue = (val: number): string => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toFixed(0);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" style={{ height }}>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">
        {title}
      </h4>
      
      <div className="flex flex-col items-center">
        <svg width={svgWidth} height={svgHeight} className="overflow-visible">
          {/* Background arcs (thresholds) */}
          {createThresholdArcs()}
          
          {/* Active arc */}
          <path
            d={activeArcPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${color}40)`
            }}
          />
          
          {/* Needle */}
          <g transform={`rotate(${angle}, ${cx}, ${cy})`}>
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - radius + 20}
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={8} fill={color} />
            <circle cx={cx} cy={cy} r={4} fill="white" />
          </g>
          
          {/* Min/Max labels */}
          <text x={cx - radius - 5} y={cy + 5} textAnchor="end" className="fill-slate-400 text-xs font-medium">
            {formatValue(min)}
          </text>
          <text x={cx + radius + 5} y={cy + 5} textAnchor="start" className="fill-slate-400 text-xs font-medium">
            {formatValue(max)}
          </text>
        </svg>
        
        {/* Value display */}
        <div className="text-center -mt-2">
          <span className="text-3xl font-black" style={{ color }}>
            {formatValue(value)}
          </span>
          {unit && <span className="text-lg text-slate-400 ml-1">{unit}</span>}
          <p className="text-xs text-slate-400 mt-1">
            {percentage.toFixed(0)}% of target
          </p>
        </div>
      </div>
      
      {/* Threshold legend */}
      <div className="flex items-center justify-center gap-4 mt-4">
        {thresholds.map((t, i) => (
          <div key={i} className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: t.color }}
            />
            <span className="text-xs text-slate-500">{t.label || `≤${t.value}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GaugeChart;
