import React from 'react';
import {
  LayoutGridIcon,
  FileTextIcon,
  BarChart3Icon,
  PieChartIcon,
  TrendingUpIcon,
  TableIcon,
  PresentationIcon,
  BookOpenIcon,
  CheckIcon
} from 'lucide-react';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  layout: 'grid' | 'single' | 'executive' | 'detailed' | 'presentation';
  colorTheme: 'professional' | 'modern' | 'minimal' | 'corporate' | 'vibrant';
  includeHeaders: boolean;
  includeSummary: boolean;
  includeDataTables: boolean;
  chartSize: 'small' | 'medium' | 'large';
  pageOrientation: 'portrait' | 'landscape';
  columns: 1 | 2 | 3;
}

export const reportTemplates: ReportTemplate[] = [
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview with key metrics and insights for leadership',
    icon: PresentationIcon,
    layout: 'executive',
    colorTheme: 'professional',
    includeHeaders: true,
    includeSummary: true,
    includeDataTables: false,
    chartSize: 'large',
    pageOrientation: 'landscape',
    columns: 2
  },
  {
    id: 'detailed-analysis',
    name: 'Detailed Analysis',
    description: 'Comprehensive report with all charts, data tables, and explanations',
    icon: BookOpenIcon,
    layout: 'detailed',
    colorTheme: 'minimal',
    includeHeaders: true,
    includeSummary: true,
    includeDataTables: true,
    chartSize: 'medium',
    pageOrientation: 'portrait',
    columns: 1
  },
  {
    id: 'dashboard-grid',
    name: 'Dashboard Grid',
    description: 'Visual dashboard layout with multiple charts in a grid format',
    icon: LayoutGridIcon,
    layout: 'grid',
    colorTheme: 'modern',
    includeHeaders: true,
    includeSummary: false,
    includeDataTables: false,
    chartSize: 'medium',
    pageOrientation: 'landscape',
    columns: 2
  },
  {
    id: 'data-report',
    name: 'Data Report',
    description: 'Focus on data tables with supporting visualizations',
    icon: TableIcon,
    layout: 'detailed',
    colorTheme: 'corporate',
    includeHeaders: true,
    includeSummary: true,
    includeDataTables: true,
    chartSize: 'small',
    pageOrientation: 'portrait',
    columns: 1
  },
  {
    id: 'presentation',
    name: 'Presentation Ready',
    description: 'Large visuals optimized for screen sharing and presentations',
    icon: PresentationIcon,
    layout: 'presentation',
    colorTheme: 'vibrant',
    includeHeaders: true,
    includeSummary: false,
    includeDataTables: false,
    chartSize: 'large',
    pageOrientation: 'landscape',
    columns: 1
  },
  {
    id: 'kpi-scorecard',
    name: 'KPI Scorecard',
    description: 'Metrics-focused report highlighting key performance indicators',
    icon: TrendingUpIcon,
    layout: 'executive',
    colorTheme: 'corporate',
    includeHeaders: true,
    includeSummary: true,
    includeDataTables: false,
    chartSize: 'medium',
    pageOrientation: 'portrait',
    columns: 3
  }
];

interface TemplateCardProps {
  template: ReportTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ template, isSelected, onSelect }) => {
  const Icon = template.icon;
  
  return (
    <button
      onClick={onSelect}
      className={`relative p-4 rounded-2xl border-2 text-left transition-all hover:shadow-lg ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
          <CheckIcon className="w-4 h-4 text-white" />
        </div>
      )}
      
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
      }`}>
        <Icon className="w-5 h-5" />
      </div>
      
      <h4 className={`font-bold text-sm mb-1 ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
        {template.name}
      </h4>
      <p className="text-xs text-slate-500 leading-relaxed">
        {template.description}
      </p>
      
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
          isSelected ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'
        }`}>
          {template.pageOrientation}
        </span>
        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
          isSelected ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'
        }`}>
          {template.columns} col
        </span>
        {template.includeDataTables && (
          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
            isSelected ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'
          }`}>
            + Data
          </span>
        )}
      </div>
    </button>
  );
};

interface TemplateSelectorProps {
  selectedTemplate: ReportTemplate | null;
  onSelectTemplate: (template: ReportTemplate) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ 
  selectedTemplate, 
  onSelectTemplate 
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Choose Template
        </label>
        {selectedTemplate && (
          <span className="text-xs font-bold text-blue-600">
            {selectedTemplate.name}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {reportTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplate?.id === template.id}
            onSelect={() => onSelectTemplate(template)}
          />
        ))}
      </div>
    </div>
  );
};

// Template Preview Component
interface TemplatePreviewProps {
  template: ReportTemplate;
  itemCount: number;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ template, itemCount }) => {
  const renderPreviewLayout = () => {
    switch (template.layout) {
      case 'executive':
        return (
          <div className="space-y-2">
            <div className="h-6 bg-slate-200 rounded w-1/2"></div>
            <div className="h-3 bg-slate-100 rounded w-3/4"></div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="h-16 bg-blue-100 rounded"></div>
              <div className="h-16 bg-green-100 rounded"></div>
              <div className="h-16 bg-blue-100 rounded"></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded"></div>
              <div className="h-20 bg-gradient-to-br from-green-100 to-green-50 rounded"></div>
            </div>
          </div>
        );
      case 'detailed':
        return (
          <div className="space-y-2">
            <div className="h-5 bg-slate-200 rounded w-2/3"></div>
            <div className="h-2 bg-slate-100 rounded w-full"></div>
            <div className="h-2 bg-slate-100 rounded w-4/5"></div>
            <div className="h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded mt-2"></div>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-3 bg-slate-100 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-2 bg-slate-50 rounded"></div>
              ))}
            </div>
          </div>
        );
      case 'grid':
        return (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(Math.min(itemCount, 4))].map((_, i) => (
              <div key={i} className="h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded"></div>
            ))}
          </div>
        );
      case 'presentation':
        return (
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
            <div className="h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded"></div>
          </div>
        );
      default:
        return (
          <div className="h-20 bg-gradient-to-br from-slate-100 to-slate-50 rounded"></div>
        );
    }
  };

  return (
    <div className={`p-4 rounded-xl border border-slate-200 bg-white ${
      template.pageOrientation === 'landscape' ? 'aspect-video' : 'aspect-[3/4]'
    }`}>
      <div className="h-full overflow-hidden">
        {renderPreviewLayout()}
      </div>
    </div>
  );
};

export default TemplateSelector;
