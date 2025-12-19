import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis, ComposedChart
} from 'recharts';

interface SqlChartProps {
  type: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter' | 'composed';
  data: any[];
  xAxis: string;
  yAxis: string;
  yAxisSecondary?: string;
  title: string;
  colorScheme?: 'default' | 'performance' | 'categorical' | 'warm' | 'cool';
  height?: number;
}

const SCHEMES = {
  default: ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'],
  performance: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#6366f1', '#8b5cf6'], // Green, Orange, Red
  categorical: ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04'],
  warm: ['#f43f5e', '#fb923c', '#fbbf24', '#f59e0b', '#ea580c', '#be123c'],
  cool: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#4f46e5']
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-2xl">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-8 mb-1 last:mb-0">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-300 text-xs font-medium">{entry.name}:</span>
            </span>
            <span className="text-white text-xs font-bold font-mono">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const SqlChart: React.FC<SqlChartProps> = ({ 
  type, data, xAxis, yAxis, yAxisSecondary, title, colorScheme = 'default', height = 350 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <ActivityIcon className="w-6 h-6 text-slate-300" />
        </div>
        <p className="font-bold text-sm tracking-tight uppercase italic">No data records found</p>
      </div>
    );
  }

  const colors = SCHEMES[colorScheme] || SCHEMES.default;
  const mainColor = colors[0];

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
            <Bar dataKey={yAxis} fill={mainColor} radius={[8, 8, 0, 0]} barSize={32} animationDuration={1500} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey={yAxis} 
              stroke={mainColor} 
              strokeWidth={4} 
              dot={{ r: 5, fill: mainColor, strokeWidth: 3, stroke: '#fff' }} 
              activeDot={{ r: 8, strokeWidth: 0 }}
              animationDuration={1500}
            />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`colorGradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={mainColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={mainColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey={yAxis} 
              stroke={mainColor} 
              strokeWidth={4} 
              fillOpacity={1} 
              fill={`url(#colorGradient-${title})`} 
              animationDuration={1500}
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
              innerRadius={70}
              outerRadius={110}
              paddingAngle={8}
              animationDuration={1500}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
          </PieChart>
        );
      case 'radar':
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name={yAxis}
              dataKey={yAxis}
              stroke={mainColor}
              fill={mainColor}
              fillOpacity={0.3}
              animationDuration={1500}
            />
          </RadarChart>
        );
      case 'scatter':
        return (
          <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" dataKey={xAxis} name={xAxis} tick={{ fontSize: 10 }} axisLine={false} label={{ value: xAxis, position: 'bottom', offset: 0, fontSize: 10 }} />
            <YAxis type="number" dataKey={yAxis} name={yAxis} tick={{ fontSize: 10 }} axisLine={false} label={{ value: yAxis, angle: -90, position: 'insideLeft', fontSize: 10 }} />
            <ZAxis type="number" range={[60, 400]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name={title} data={data} fill={mainColor} animationDuration={1500} />
          </ScatterChart>
        );
      case 'composed':
        return (
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={xAxis} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }} />
            <Bar dataKey={yAxis} fill={mainColor} radius={[6, 6, 0, 0]} barSize={24} />
            {yAxisSecondary && (
              <Line type="monotone" dataKey={yAxisSecondary} stroke={colors[2]} strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: colors[2], strokeWidth: 2 }} />
            )}
          </ComposedChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden group/chartcard">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xs font-black text-slate-400 tracking-[0.2em] uppercase mb-1">{title}</h3>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${type === 'pie' ? 'bg-indigo-500' : 'bg-blue-500'}`} />
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{type} Intelligence View</p>
          </div>
        </div>
        <div className="flex gap-1.5 opacity-0 group-hover/chartcard:opacity-100 transition-opacity">
           <div className="w-1.5 h-1.5 rounded-full bg-slate-100"></div>
           <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
           <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
        </div>
      </div>
      <div style={{ width: '100%', height: height }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart() || <div>Chart type not supported</div>}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Simple icon for empty state
const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
);

export default SqlChart;
