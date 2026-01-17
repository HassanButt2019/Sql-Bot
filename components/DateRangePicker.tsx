import React, { useState, useRef, useEffect } from 'react';
import { CalendarIcon, ChevronDownIcon, XIcon, CheckIcon } from 'lucide-react';
import { DateRangeFilter } from '../types';

interface DateRangePickerProps {
  value: DateRangeFilter;
  onChange: (filter: DateRangeFilter) => void;
  className?: string;
}

const PRESETS: { id: DateRangeFilter['preset']; label: string; getValue: () => { start: string; end: string } }[] = [
  {
    id: 'today',
    label: 'Today',
    getValue: () => {
      const today = new Date().toISOString().split('T')[0];
      return { start: today, end: today };
    }
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    getValue: () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      return { start: yesterday, end: yesterday };
    }
  },
  {
    id: 'last7days',
    label: 'Last 7 Days',
    getValue: () => {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      return { start, end };
    }
  },
  {
    id: 'last30days',
    label: 'Last 30 Days',
    getValue: () => {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      return { start, end };
    }
  },
  {
    id: 'thisMonth',
    label: 'This Month',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];
      return { start, end };
    }
  },
  {
    id: 'lastMonth',
    label: 'Last Month',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { start, end };
    }
  },
  {
    id: 'thisQuarter',
    label: 'This Quarter',
    getValue: () => {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];
      return { start, end };
    }
  },
  {
    id: 'thisYear',
    label: 'This Year',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const end = new Date().toISOString().split('T')[0];
      return { start, end };
    }
  }
];

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(value.preset === 'custom');
  const [customStart, setCustomStart] = useState(value.startDate || '');
  const [customEnd, setCustomEnd] = useState(value.endDate || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    const { start, end } = preset.getValue();
    onChange({
      startDate: start,
      endDate: end,
      preset: preset.id
    });
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onChange({
        startDate: customStart,
        endDate: customEnd,
        preset: 'custom'
      });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange({
      startDate: null,
      endDate: null,
      preset: null
    });
    setCustomStart('');
    setCustomEnd('');
    setIsOpen(false);
  };

  const getDisplayLabel = (): string => {
    if (!value.preset && !value.startDate) return 'All Time';
    if (value.preset && value.preset !== 'custom') {
      return PRESETS.find(p => p.id === value.preset)?.label || 'Custom';
    }
    if (value.startDate && value.endDate) {
      const start = new Date(value.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = new Date(value.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${start} - ${end}`;
    }
    return 'Select Range';
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
          isOpen 
            ? 'bg-blue-50 border-blue-300 text-blue-700' 
            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
        }`}
      >
        <CalendarIcon className="w-4 h-4" />
        <span>{getDisplayLabel()}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          {/* Preset options */}
          <div className="p-2 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2">Quick Select</p>
            <div className="grid grid-cols-2 gap-1">
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    value.preset === preset.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{preset.label}</span>
                  {value.preset === preset.id && <CheckIcon className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Custom range */}
          <div className="p-4">
            <button
              onClick={() => setIsCustomMode(!isCustomMode)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3"
            >
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${isCustomMode ? 'rotate-180' : ''}`} />
              Custom Range
            </button>

            {isCustomMode && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Start Date</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">End Date</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCustomApply}
                  disabled={!customStart || !customEnd}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply Custom Range
                </button>
              </div>
            )}
          </div>

          {/* Clear button */}
          {(value.startDate || value.preset) && (
            <div className="p-2 border-t border-slate-100">
              <button
                onClick={handleClear}
                className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <XIcon className="w-4 h-4" />
                Clear Filter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
