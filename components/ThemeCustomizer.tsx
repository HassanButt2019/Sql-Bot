import React, { useState } from 'react';
import { PaletteIcon, SunIcon, MoonIcon, MonitorIcon, CheckIcon, XIcon } from 'lucide-react';
import { ThemeConfig, ThemeMode } from '../types';

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeConfig;
  onThemeChange: (theme: ThemeConfig) => void;
}

const DEFAULT_PALETTES = [
  { name: 'Ocean', colors: ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'] },
  { name: 'Forest', colors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'] },
  { name: 'Sunset', colors: ['#f43f5e', '#fb923c', '#fbbf24', '#f59e0b', '#ea580c', '#be123c'] },
  { name: 'Arctic', colors: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#4f46e5'] },
  { name: 'Enterprise', colors: ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8'] },
  { name: 'Vibrant', colors: ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04'] },
];

const PRIMARY_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Slate', value: '#64748b' },
];

const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({ isOpen, onClose, theme, onThemeChange }) => {
  const [localTheme, setLocalTheme] = useState<ThemeConfig>(theme);

  if (!isOpen) return null;

  const handleModeChange = (mode: ThemeMode) => {
    setLocalTheme(prev => ({ ...prev, mode }));
  };

  const handlePrimaryColorChange = (color: string) => {
    setLocalTheme(prev => ({ ...prev, primaryColor: color }));
  };

  const handlePaletteChange = (colors: string[]) => {
    setLocalTheme(prev => ({ ...prev, chartPalette: colors }));
  };

  const handleApply = () => {
    onThemeChange(localTheme);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PaletteIcon className="w-5 h-5" />
            <h2 className="text-lg font-bold">Theme Customization</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Mode Selection */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">
              Appearance Mode
            </label>
            <div className="flex gap-2">
              {[
                { mode: 'light' as ThemeMode, icon: SunIcon, label: 'Light' },
                { mode: 'dark' as ThemeMode, icon: MoonIcon, label: 'Dark' },
                { mode: 'auto' as ThemeMode, icon: MonitorIcon, label: 'System' },
              ].map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                    localTheme.mode === mode
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Color */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">
              Primary Color
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIMARY_COLORS.map(({ name, value }) => (
                <button
                  key={value}
                  onClick={() => handlePrimaryColorChange(value)}
                  className={`w-10 h-10 rounded-xl transition-all ${
                    localTheme.primaryColor === value
                      ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: value }}
                  title={name}
                >
                  {localTheme.primaryColor === value && (
                    <CheckIcon className="w-5 h-5 text-white mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Palette */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">
              Chart Color Palette
            </label>
            <div className="space-y-2">
              {DEFAULT_PALETTES.map((palette) => (
                <button
                  key={palette.name}
                  onClick={() => handlePaletteChange(palette.colors)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    JSON.stringify(localTheme.chartPalette) === JSON.stringify(palette.colors)
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex gap-1">
                    {palette.colors.slice(0, 6).map((color, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-md"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-1 text-left">
                    {palette.name}
                  </span>
                  {JSON.stringify(localTheme.chartPalette) === JSON.stringify(palette.colors) && (
                    <CheckIcon className="w-4 h-4 text-violet-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Preview</p>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: localTheme.primaryColor }}
              >
                S
              </div>
              <div className="flex-1">
                <div className="flex gap-1 mb-2">
                  {localTheme.chartPalette.slice(0, 6).map((color, i) => (
                    <div
                      key={i}
                      className="flex-1 h-8 rounded"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  Mode: {localTheme.mode.charAt(0).toUpperCase() + localTheme.mode.slice(1)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-semibold hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors"
          >
            Apply Theme
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeCustomizer;
