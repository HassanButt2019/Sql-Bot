import React, { useState } from 'react';
import { MapPinIcon, GlobeIcon } from 'lucide-react';

interface GeoDataPoint {
  location: string;
  value: number;
  lat?: number;
  lng?: number;
}

interface GeoMapProps {
  data: GeoDataPoint[];
  title: string;
  valueLabel?: string;
  colorScheme?: 'default' | 'heat' | 'cool';
  height?: number;
  mapType?: 'world' | 'usa' | 'custom';
}

// Simple US state coordinates for a basic choropleth
const US_STATES_COORDS: Record<string, { x: number; y: number }> = {
  'AL': { x: 72, y: 68 }, 'AK': { x: 15, y: 85 }, 'AZ': { x: 28, y: 62 },
  'AR': { x: 58, y: 58 }, 'CA': { x: 15, y: 48 }, 'CO': { x: 38, y: 48 },
  'CT': { x: 90, y: 35 }, 'DE': { x: 88, y: 42 }, 'FL': { x: 80, y: 80 },
  'GA': { x: 78, y: 65 }, 'HI': { x: 25, y: 90 }, 'ID': { x: 25, y: 28 },
  'IL': { x: 65, y: 42 }, 'IN': { x: 70, y: 42 }, 'IA': { x: 58, y: 38 },
  'KS': { x: 48, y: 48 }, 'KY': { x: 72, y: 50 }, 'LA': { x: 58, y: 72 },
  'ME': { x: 95, y: 18 }, 'MD': { x: 85, y: 42 }, 'MA': { x: 92, y: 32 },
  'MI': { x: 72, y: 32 }, 'MN': { x: 55, y: 25 }, 'MS': { x: 65, y: 68 },
  'MO': { x: 58, y: 50 }, 'MT': { x: 32, y: 22 }, 'NE': { x: 48, y: 38 },
  'NV': { x: 20, y: 42 }, 'NH': { x: 92, y: 25 }, 'NJ': { x: 88, y: 38 },
  'NM': { x: 35, y: 62 }, 'NY': { x: 85, y: 30 }, 'NC': { x: 82, y: 55 },
  'ND': { x: 48, y: 22 }, 'OH': { x: 75, y: 42 }, 'OK': { x: 48, y: 58 },
  'OR': { x: 18, y: 28 }, 'PA': { x: 82, y: 38 }, 'RI': { x: 93, y: 34 },
  'SC': { x: 80, y: 60 }, 'SD': { x: 48, y: 28 }, 'TN': { x: 70, y: 55 },
  'TX': { x: 45, y: 72 }, 'UT': { x: 28, y: 45 }, 'VT': { x: 90, y: 22 },
  'VA': { x: 82, y: 48 }, 'WA': { x: 18, y: 18 }, 'WV': { x: 78, y: 45 },
  'WI': { x: 62, y: 30 }, 'WY': { x: 35, y: 35 },
};

// Common region names to coordinates (for non-US data)
const REGION_COORDS: Record<string, { x: number; y: number }> = {
  'North America': { x: 25, y: 35 },
  'South America': { x: 35, y: 70 },
  'Europe': { x: 52, y: 30 },
  'Asia': { x: 72, y: 35 },
  'Africa': { x: 52, y: 55 },
  'Australia': { x: 85, y: 70 },
  'North': { x: 50, y: 20 },
  'South': { x: 50, y: 80 },
  'East': { x: 80, y: 50 },
  'West': { x: 20, y: 50 },
  'Central': { x: 50, y: 50 },
  'Northeast': { x: 75, y: 25 },
  'Southeast': { x: 75, y: 70 },
  'Northwest': { x: 25, y: 25 },
  'Southwest': { x: 25, y: 70 },
  'Midwest': { x: 50, y: 40 },
};

const COLOR_SCHEMES = {
  default: ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'],
  heat: ['#fef3c7', '#fcd34d', '#f59e0b', '#ea580c', '#b91c1c'],
  cool: ['#f0fdfa', '#99f6e4', '#2dd4bf', '#0d9488', '#115e59'],
};

const GeoMap: React.FC<GeoMapProps> = ({
  data,
  title,
  valueLabel = 'Value',
  colorScheme = 'default',
  height = 350,
  mapType = 'world'
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<GeoDataPoint | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 bg-slate-50 rounded-2xl h-full">
        <div className="text-center">
          <GlobeIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No geographic data</p>
        </div>
      </div>
    );
  }

  const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.default;
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const getColor = (value: number): string => {
    const normalized = (value - minValue) / valueRange;
    const index = Math.min(Math.floor(normalized * (colors.length - 1)), colors.length - 1);
    return colors[index];
  };

  const getPointSize = (value: number): number => {
    const normalized = (value - minValue) / valueRange;
    return 12 + normalized * 20; // Size range: 12-32
  };

  // Try to get coordinates for each data point
  const getCoordinates = (location: string): { x: number; y: number } | null => {
    if (!location || typeof location !== 'string') return null;
    const upperLocation = location.toUpperCase().trim();
    
    // Check if it's a US state abbreviation
    if (US_STATES_COORDS[upperLocation]) {
      return US_STATES_COORDS[upperLocation];
    }
    
    // Check if it's a known region
    for (const [region, coords] of Object.entries(REGION_COORDS)) {
      if (location.toLowerCase().includes(region.toLowerCase())) {
        return coords;
      }
    }
    
    // For unknown locations, distribute evenly
    const index = data.findIndex(d => d.location === location);
    const cols = Math.ceil(Math.sqrt(data.length));
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    return {
      x: 15 + (col / cols) * 70,
      y: 15 + (row / Math.ceil(data.length / cols)) * 70
    };
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" style={{ height }}>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        <GlobeIcon className="w-4 h-4" />
        {title}
      </h4>

      <div className="relative" style={{ height: height - 100 }}>
        {/* Map Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl overflow-hidden">
          {/* Simple grid pattern for map feel */}
          <svg width="100%" height="100%" className="absolute inset-0 opacity-10">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#94a3b8" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Data Points */}
          <svg width="100%" height="100%" className="relative z-10">
            {data.map((point, index) => {
              const coords = getCoordinates(point.location);
              if (!coords) return null;
              
              const size = getPointSize(point.value);
              const isHovered = hoveredPoint?.location === point.location;
              
              return (
                <g key={index}>
                  {/* Pulse animation for hovered point */}
                  {isHovered && (
                    <circle
                      cx={`${coords.x}%`}
                      cy={`${coords.y}%`}
                      r={size + 8}
                      fill={getColor(point.value)}
                      opacity={0.3}
                      className="animate-ping"
                    />
                  )}
                  
                  {/* Main bubble */}
                  <circle
                    cx={`${coords.x}%`}
                    cy={`${coords.y}%`}
                    r={isHovered ? size + 4 : size}
                    fill={getColor(point.value)}
                    stroke="white"
                    strokeWidth={2}
                    style={{ 
                      cursor: 'pointer',
                      filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={() => setHoveredPoint(point)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  
                  {/* Label */}
                  <text
                    x={`${coords.x}%`}
                    y={`${coords.y}%`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white text-[8px] font-bold pointer-events-none"
                  >
                    {point.location.length <= 3 ? point.location : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl z-20 min-w-[140px]">
            <div className="flex items-center gap-2 mb-1">
              <MapPinIcon className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-sm">{hoveredPoint.location}</span>
            </div>
            <p className="text-slate-300 text-xs">
              {valueLabel}: <span className="text-white font-bold">{hoveredPoint.value.toLocaleString()}</span>
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4 pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-400">{minValue.toLocaleString()}</span>
        <div className="flex h-3 rounded-full overflow-hidden">
          {colors.map((color, i) => (
            <div key={i} className="w-8 h-full" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span className="text-xs text-slate-400">{maxValue.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default GeoMap;
