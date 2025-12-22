import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ComboChartProps {
  data: any[];
  xAxis: string;
  barDataKey: string;
  lineDataKey: string;
  areaDataKey?: string;
  title: string;
  barLabel?: string;
  lineLabel?: string;
  areaLabel?: string;
  colorScheme?: 'default' | 'growth' | 'trust' | 'warm';
  height?: number;
  showGrid?: boolean;
}

const COLOR_SCHEMES = {
  default: { bar: '#3b82f6', line: '#f59e0b', area: '#10b981' },
  growth: { bar: '#10b981', line: '#059669', area: '#34d399' },
  trust: { bar: '#1e40af', line: '#3b82f6', area: '#60a5fa' },
  warm: { bar: '#f97316', line: '#ef4444', area: '#fbbf24' }
};

const ComboChart: React.FC<ComboChartProps> = ({
  data,
  xAxis,
  barDataKey,
  lineDataKey,
  areaDataKey,
  title,
  barLabel,
  lineLabel,
  areaLabel,
  colorScheme = 'default',
  height = 350,
  showGrid = true
}) => {
  const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.default;

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 bg-slate-50 rounded-2xl h-full">
        <p className="text-sm font-medium">No data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl min-w-[180px]">
          <p className="text-white font-bold text-sm mb-2 border-b border-white/10 pb-2">
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-white/70 text-xs font-medium">
                  {entry.name}
                </span>
              </div>
              <span className="text-white text-xs font-bold">
                {typeof entry.value === 'number' 
                  ? entry.value.toLocaleString() 
                  : entry.value
                }
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" style={{ height }}>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
        {title}
      </h4>
      
      <div style={{ width: '100%', height: height - 60 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            {showGrid && (
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#f1f5f9" 
                vertical={false} 
              />
            )}
            <XAxis 
              dataKey={xAxis} 
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
              axisLine={false} 
              tickLine={false}
              dy={10}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
              axisLine={false} 
              tickLine={false}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
              axisLine={false} 
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="top" 
              align="right" 
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
            />
            
            {/* Area (optional, renders behind bar) */}
            {areaDataKey && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey={areaDataKey}
                name={areaLabel || areaDataKey}
                fill={colors.area}
                fillOpacity={0.2}
                stroke={colors.area}
                strokeWidth={2}
              />
            )}
            
            {/* Bar */}
            <Bar
              yAxisId="left"
              dataKey={barDataKey}
              name={barLabel || barDataKey}
              fill={colors.bar}
              radius={[4, 4, 0, 0]}
              barSize={24}
            />
            
            {/* Line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey={lineDataKey}
              name={lineLabel || lineDataKey}
              stroke={colors.line}
              strokeWidth={3}
              dot={{ r: 4, fill: colors.line, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ComboChart;
