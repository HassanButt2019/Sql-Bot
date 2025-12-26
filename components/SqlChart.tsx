import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis, ComposedChart
} from 'recharts';
import { PaletteIcon, CheckIcon, ChevronDownIcon } from 'lucide-react';

interface SqlChartProps {
  type: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter' | 'composed';
  data: any[];
  xAxis: string;
  yAxis: string;
  yAxisSecondary?: string;
  title: string;
  colorScheme?: 'default' | 'performance' | 'categorical' | 'warm' | 'cool' | 'trust' | 'growth' | 'alert';
  customColors?: string[];
  height?: number;
  onUpdateScheme?: (scheme: string) => void;
}

const SCHEMES: Record<string, { colors: string[]; label: string }> = {
  default: { label: 'Oceanic', colors: ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'] },
  trust: { label: 'Enterprise Blue', colors: ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8'] },
  growth: { label: 'Eco Growth', colors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'] },
  performance: { label: 'KPI Status', colors: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#6366f1', '#8b5cf6'] },
  categorical: { label: 'Vibrant Pop', colors: ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04'] },
  warm: { label: 'Sunset Heat', colors: ['#f43f5e', '#fb923c', '#fbbf24', '#f59e0b', '#ea580c', '#be123c'] },
  cool: { label: 'Arctic Chill', colors: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#4f46e5'] },
  alert: { label: 'Risk Alert', colors: ['#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2'] }
};

const CustomTooltip = ({ active, payload, label, xAxisName, yAxisName, type }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl min-w-[190px] animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/5">
        <div className="flex flex-col gap-3">
          <div className="border-b border-white/10 pb-2 mb-1">
            <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] mb-0.5">
              {xAxisName || 'Data Reference'}
            </p>
            <p className="text-white text-sm font-bold truncate">
              {label}
            </p>
          </div>

          <div className="space-y-2.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex flex-col">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full shadow-lg ring-2 ring-white/10" 
                      style={{ backgroundColor: entry.color || entry.fill || entry.stroke }} 
                    />
                    <span className="text-white/70 text-[11px] font-semibold truncate max-w-[110px]">
                      {entry.name || yAxisName}
                    </span>
                  </div>
                  <span className="text-white text-xs font-black font-mono">
                    {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                  </span>
                </div>
                {type === 'pie' && entry.payload?.percent && (
                  <div className="ml-4.5 mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400 rounded-full transition-all duration-500" 
                        style={{ width: `${(entry.payload.percent * 100).toFixed(1)}%` }} 
                      />
                    </div>
                    <p className="text-[9px] text-white/40 font-bold whitespace-nowrap">
                      {(entry.payload.percent * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const SqlChart: React.FC<SqlChartProps> = ({ 
  type, data, xAxis, yAxis, yAxisSecondary, title, colorScheme = 'default', customColors, height = 350, onUpdateScheme
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-slate-300" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <p className="font-bold text-sm tracking-tight uppercase italic">No data records found</p>
      </div>
    );
  }

  const activeScheme = SCHEMES[colorScheme] || SCHEMES.default;
  const colors = customColors || activeScheme.colors;
  const mainColor = colors[0];

  const tooltipCommonProps = {
    xAxisName: xAxis,
    yAxisName: yAxis,
    type: type
  };

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: '#f8fafc', radius: 8 }} 
              content={<CustomTooltip {...tooltipCommonProps} />} 
              isAnimationActive={false}
            />
            <Bar dataKey={yAxis} fill={mainColor} radius={[6, 6, 0, 0]} barSize={32} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip {...tooltipCommonProps} />} />
            <Line 
              type="monotone" 
              dataKey={yAxis} 
              stroke={mainColor} 
              strokeWidth={3} 
              dot={{ r: 4, fill: mainColor, strokeWidth: 2, stroke: '#fff' }} 
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`colorGradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={mainColor} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={mainColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip {...tooltipCommonProps} />} />
            <Area 
              type="monotone" 
              dataKey={yAxis} 
              stroke={mainColor} 
              strokeWidth={3} 
              fillOpacity={1} 
              fill={`url(#colorGradient-${title})`} 
            />
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={yAxis}
              nameKey={xAxis}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              stroke="none"
              animationDuration={800}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} className="hover:opacity-80 transition-opacity outline-none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip {...tooltipCommonProps} />} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
          </PieChart>
        );
      case 'radar':
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 8 }} />
            <Tooltip content={<CustomTooltip {...tooltipCommonProps} />} />
            <Radar
              name={yAxis}
              dataKey={yAxis}
              stroke={mainColor}
              fill={mainColor}
              fillOpacity={0.3}
            />
          </RadarChart>
        );
      case 'scatter':
        return (
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" dataKey={xAxis} name={xAxis} tick={{ fontSize: 10 }} axisLine={false} />
            <YAxis type="number" dataKey={yAxis} name={yAxis} tick={{ fontSize: 10 }} axisLine={false} />
            <ZAxis type="number" range={[64, 144]} />
            <Tooltip 
              content={<CustomTooltip {...tooltipCommonProps} />} 
              cursor={{ strokeDasharray: '3 3' }} 
            />
            <Scatter name={title} data={data} fill={mainColor} />
          </ScatterChart>
        );
      case 'composed':
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip {...tooltipCommonProps} />} />
            <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
            <Bar dataKey={yAxis} fill={mainColor} radius={[4, 4, 0, 0]} barSize={20} name="Primary Metric" />
            {yAxisSecondary && (
              <Line 
                type="monotone" 
                dataKey={yAxisSecondary} 
                stroke={colors[1] || '#fb923c'} 
                strokeWidth={2} 
                dot={{ r: 3, fill: '#fff', stroke: colors[1] || '#fb923c', strokeWidth: 2 }} 
                name="Secondary Trend"
              />
            )}
          </ComposedChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group/chart relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">{title}</h3>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${type === 'pie' ? 'bg-indigo-500' : 'bg-blue-500'} animate-pulse`} />
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Live Intelligence Analysis</p>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: height }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart() || <div>Chart type not supported</div>}
        </ResponsiveContainer>
      </div>

      {onUpdateScheme && (
        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Visual Palette</span>
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest hover:bg-white hover:shadow-md transition-all active:scale-95"
            >
              <PaletteIcon className="w-3 h-3" />
              <span>{activeScheme.label}</span>
              <ChevronDownIcon className={`w-2.5 h-2.5 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 bottom-full mb-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden p-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="px-3 py-2 border-b border-slate-50 mb-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Select Scheme</p>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {Object.entries(SCHEMES).map(([key, scheme]) => (
                      <button
                        key={key}
                        onClick={() => {
                          onUpdateScheme(key);
                          setIsMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${colorScheme === key ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                      >
                        <div className="flex -space-x-1">
                          {scheme.colors.slice(0, 3).map((c, i) => (
                            <div key={i} className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 flex-1 text-left">{scheme.label}</span>
                        {colorScheme === key && <CheckIcon className="w-3 h-3 text-blue-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SqlChart;