import React from 'react';
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { KPICardConfig } from '../types';

interface KPICardProps {
  title: string;
  config: KPICardConfig;
  colorScheme?: string;
  height?: number;
}

const KPICard: React.FC<KPICardProps> = ({ title, config, colorScheme = 'default', height = 150 }) => {
  const {
    value,
    previousValue,
    changePercentage,
    changeDirection,
    sparklineData,
    target,
    unit = '',
    format = 'number'
  } = config;

  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return val >= 1000000 
          ? `${(val / 1000000).toFixed(1)}M`
          : val >= 1000 
            ? `${(val / 1000).toFixed(1)}K`
            : val.toLocaleString();
    }
  };

  const getChangeColor = () => {
    if (!changeDirection || changeDirection === 'stable') return 'text-slate-500';
    return changeDirection === 'up' ? 'text-green-500' : 'text-red-500';
  };

  const getChangeBgColor = () => {
    if (!changeDirection || changeDirection === 'stable') return 'bg-slate-100';
    return changeDirection === 'up' ? 'bg-green-50' : 'bg-red-50';
  };

  const getSparklineColor = () => {
    switch (colorScheme) {
      case 'growth': return '#10b981';
      case 'alert': return '#ef4444';
      case 'trust': return '#3b82f6';
      default: return '#6366f1';
    }
  };

  const ChangeIcon = changeDirection === 'up' 
    ? TrendingUpIcon 
    : changeDirection === 'down' 
      ? TrendingDownIcon 
      : MinusIcon;

  // Convert sparkline data to chart format
  const sparklineChartData = sparklineData?.map((val, idx) => ({ index: idx, value: val })) || [];

  // Calculate target progress
  const targetProgress = target && typeof value === 'number' ? Math.min((value / target) * 100, 100) : null;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-all" style={{ height }}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate pr-2">
            {title}
          </h4>
          {changePercentage !== undefined && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${getChangeBgColor()} ${getChangeColor()}`}>
              <ChangeIcon className="w-3 h-3" />
              <span>{Math.abs(changePercentage).toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Main Value */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {formatValue(value)}{unit && <span className="text-lg text-slate-400 ml-1">{unit}</span>}
          </div>
          
          {previousValue !== undefined && (
            <p className="text-xs text-slate-400 mt-1">
              Previous: {formatValue(previousValue)}
            </p>
          )}
        </div>

        {/* Sparkline */}
        {sparklineChartData.length > 0 && (
          <div className="h-12 mt-2 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineChartData}>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      return (
                        <div className="bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold">
                          {formatValue(payload[0].value as number)}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={getSparklineColor()} 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: getSparklineColor() }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Target Progress Bar */}
        {targetProgress !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 font-medium">Target</span>
              <span className="font-bold text-slate-600">{targetProgress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${targetProgress}%`,
                  backgroundColor: targetProgress >= 100 ? '#10b981' : targetProgress >= 70 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
