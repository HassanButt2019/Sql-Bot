import React, { useState } from 'react';
import { DashboardItem, DashboardReport } from '../types';
import { TemplateSelector, TemplatePreview, ReportTemplate, reportTemplates } from './ReportTemplates';
import { exportToPDF, exportToImage } from '../services/pdfExportService';
import {
  FileTextIcon,
  DownloadIcon,
  CalendarIcon,
  MailIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  FileSpreadsheetIcon,
  ImageIcon,
  Loader2Icon,
  SendIcon,
  BellIcon,
  RepeatIcon,
  PlusIcon,
  Trash2Icon,
  LayoutTemplateIcon,
  EyeIcon,
  BuildingIcon,
  UserIcon
} from 'lucide-react';

interface ReportGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: DashboardReport | null;
  items: DashboardItem[];
}

interface ScheduledReport {
  id: string;
  dashboardId: string;
  dashboardTitle: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  email: string;
  format: 'pdf' | 'csv' | 'both';
  templateId?: string;
  enabled: boolean;
  createdAt: number;
  lastSent?: number;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ isOpen, onClose, dashboard, items }) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'export' | 'schedule' | 'history'>('templates');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'png'>('pdf');
  const [showSuccess, setShowSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(reportTemplates[0]);
  
  // PDF export options
  const [pdfOptions, setPdfOptions] = useState({
    includeCoverPage: true,
    companyName: '',
    generatedBy: ''
  });
  
  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    time: '09:00',
    email: '',
    format: 'pdf' as 'pdf' | 'csv' | 'both'
  });
  
  // Load scheduled reports from localStorage
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>(() => {
    const saved = localStorage.getItem('sqlmind_scheduled_reports');
    return saved ? JSON.parse(saved) : [];
  });

  const saveScheduledReports = (reports: ScheduledReport[]) => {
    localStorage.setItem('sqlmind_scheduled_reports', JSON.stringify(reports));
    setScheduledReports(reports);
  };

  // Generate styled report based on template
  const generateStyledReport = (template: ReportTemplate) => {
    const style = document.createElement('style');
    style.id = 'report-template-style';
    
    // Remove existing style if present
    const existingStyle = document.getElementById('report-template-style');
    if (existingStyle) existingStyle.remove();
    
    let css = `
      @media print {
        @page {
          size: ${template.pageOrientation === 'landscape' ? 'landscape' : 'portrait'};
          margin: 1cm;
        }
        
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .dashboard-container {
          columns: ${template.columns} !important;
          column-gap: 1rem;
        }
        
        .no-print {
          display: none !important;
        }
    `;
    
    // Add theme-specific styles
    switch (template.colorTheme) {
      case 'professional':
        css += `
          .dashboard-container { background: white; }
          .chart-container { border: 1px solid #e2e8f0; }
        `;
        break;
      case 'modern':
        css += `
          .dashboard-container { background: #f8fafc; }
          .chart-container { border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        `;
        break;
      case 'corporate':
        css += `
          .dashboard-container { background: white; }
          .chart-container { border: 2px solid #1e293b; }
        `;
        break;
      case 'vibrant':
        css += `
          .dashboard-container { background: linear-gradient(135deg, #f0f9ff 0%, #fef3c7 100%); }
        `;
        break;
    }
    
    css += '}';
    
    style.textContent = css;
    document.head.appendChild(style);
  };

  const handleExportPDF = async () => {
    if (!selectedTemplate || items.length === 0) return;
    
    setIsExporting(true);
    setExportError(null);
    
    try {
      await exportToPDF({
        title: dashboard?.title || 'Analytics Report',
        items,
        template: selectedTemplate,
        includeCoverPage: pdfOptions.includeCoverPage,
        companyName: pdfOptions.companyName || undefined,
        generatedBy: pdfOptions.generatedBy || undefined
      });
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('PDF export failed:', error);
      setExportError('Failed to generate PDF. Please try again.');
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (items.length === 0) return;
    setIsExporting(true);

    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += `# Report: ${dashboard?.title || 'Dashboard'}\n`;
      csvContent += `# Generated: ${new Date().toLocaleString()}\n`;
      csvContent += `# Total Widgets: ${items.length}\n\n`;
      
      items.forEach((item, index) => {
        csvContent += `\n# --- Widget ${index + 1}: ${item.title} ---\n`;
        csvContent += `# Chart Type: ${item.chartConfig.type}\n`;
        csvContent += `# X-Axis: ${item.chartConfig.xAxis}, Y-Axis: ${item.chartConfig.yAxis}\n\n`;
        
        if (item.chartData.length > 0) {
          const headers = Object.keys(item.chartData[0]);
          csvContent += headers.join(",") + "\n";
          item.chartData.forEach(row => {
            csvContent += headers.map(h => {
              const val = row[h];
              // Escape commas and quotes in values
              if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                return `"${val.replace(/"/g, '""')}"`;
              }
              return val;
            }).join(",") + "\n";
          });
        }
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${(dashboard?.title || 'Report').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('CSV export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPNG = async () => {
    setIsExporting(true);
    setExportError(null);
    
    try {
      // Export the dashboard container as PNG
      await exportToImage('dashboard-export-container', dashboard?.title || 'Dashboard');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('PNG export failed:', error);
      setExportError('Failed to capture dashboard. Make sure the dashboard is visible.');
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    switch (exportFormat) {
      case 'pdf':
        handleExportPDF();
        break;
      case 'csv':
        handleExportCSV();
        break;
      case 'png':
        handleExportPNG();
        break;
    }
  };

  const handleScheduleReport = () => {
    if (!scheduleForm.email || !dashboard) return;

    const newSchedule: ScheduledReport = {
      id: Date.now().toString(),
      dashboardId: dashboard.id,
      dashboardTitle: dashboard.title,
      frequency: scheduleForm.frequency,
      time: scheduleForm.time,
      email: scheduleForm.email,
      format: scheduleForm.format,
      enabled: true,
      createdAt: Date.now()
    };

    saveScheduledReports([...scheduledReports, newSchedule]);
    setScheduleForm({ frequency: 'weekly', time: '09:00', email: '', format: 'pdf' });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const toggleSchedule = (id: string) => {
    const updated = scheduledReports.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    saveScheduledReports(updated);
  };

  const deleteSchedule = (id: string) => {
    const updated = scheduledReports.filter(r => r.id !== id);
    saveScheduledReports(updated);
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Every day';
      case 'weekly': return 'Every week';
      case 'monthly': return 'Every month';
      default: return freq;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 no-print">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-8 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-2xl font-black tracking-tight">Report Generator</h3>
            <p className="text-sm text-slate-500">{dashboard?.title || 'Dashboard'} • {items.length} widgets</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <XIcon className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-2 mx-8 mt-4 bg-slate-100 rounded-2xl">
          {[
            { id: 'templates', label: 'Templates', icon: LayoutTemplateIcon },
            { id: 'export', label: 'Export Now', icon: DownloadIcon },
            { id: 'schedule', label: 'Schedule', icon: CalendarIcon },
            { id: 'history', label: 'Scheduled', icon: ClockIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-8 max-h-[60vh] overflow-y-auto">
          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <TemplateSelector
                selectedTemplate={selectedTemplate}
                onSelectTemplate={setSelectedTemplate}
              />
              
              {selectedTemplate && (
                <div className="mt-6 p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <EyeIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Preview
                      </span>
                    </div>
                    <span className="text-xs font-bold text-blue-600">
                      {selectedTemplate.name}
                    </span>
                  </div>
                  <TemplatePreview template={selectedTemplate} itemCount={items.length} />
                  
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400">Orientation</span>
                      <p className="font-bold text-slate-700 capitalize">{selectedTemplate.pageOrientation}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400">Columns</span>
                      <p className="font-bold text-slate-700">{selectedTemplate.columns} Column Layout</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400">Data Tables</span>
                      <p className="font-bold text-slate-700">{selectedTemplate.includeDataTables ? 'Included' : 'Charts Only'}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400">Theme</span>
                      <p className="font-bold text-slate-700 capitalize">{selectedTemplate.colorTheme}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <button
                onClick={() => setActiveTab('export')}
                disabled={!selectedTemplate}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Continue to Export
              </button>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Selected Template Badge */}
              {selectedTemplate && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl mb-4">
                  <div className="flex items-center gap-2">
                    <selectedTemplate.icon className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-blue-800">
                      Using: {selectedTemplate.name}
                    </span>
                  </div>
                  <button 
                    onClick={() => setActiveTab('templates')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    Change
                  </button>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'pdf', label: 'PDF Report', icon: FileTextIcon, desc: 'Print-ready document' },
                    { id: 'csv', label: 'CSV Data', icon: FileSpreadsheetIcon, desc: 'Raw data export' },
                    { id: 'png', label: 'Image', icon: ImageIcon, desc: 'Dashboard snapshot' }
                  ].map(format => (
                    <button
                      key={format.id}
                      onClick={() => setExportFormat(format.id as any)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        exportFormat === format.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <format.icon className={`w-6 h-6 mb-2 ${exportFormat === format.id ? 'text-blue-600' : 'text-slate-400'}`} />
                      <p className={`font-bold text-sm ${exportFormat === format.id ? 'text-blue-900' : 'text-slate-700'}`}>
                        {format.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{format.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* PDF Export Options */}
              {exportFormat === 'pdf' && (
                <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <FileTextIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                      PDF Options
                    </span>
                  </div>
                  
                  {/* Cover Page Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-bold text-slate-700">Include Cover Page</p>
                      <p className="text-xs text-slate-400">Professional title page with report details</p>
                    </div>
                    <button
                      onClick={() => setPdfOptions(prev => ({ ...prev, includeCoverPage: !prev.includeCoverPage }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        pdfOptions.includeCoverPage ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        pdfOptions.includeCoverPage ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Company Name */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-2">
                      <BuildingIcon className="w-3 h-3" />
                      Company Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={pdfOptions.companyName}
                      onChange={e => setPdfOptions(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="Your Company, Inc."
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>

                  {/* Generated By */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-2">
                      <UserIcon className="w-3 h-3" />
                      Generated By (Optional)
                    </label>
                    <input
                      type="text"
                      value={pdfOptions.generatedBy}
                      onChange={e => setPdfOptions(prev => ({ ...prev, generatedBy: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-2xl">
                <h4 className="font-bold text-sm mb-2">Report Contents</h4>
                <div className="grid grid-cols-3 gap-2">
                  {items.slice(0, 3).map((item, i) => (
                    <div key={i} className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded mb-1"></div>
                      <p className="text-[10px] font-bold text-slate-600 truncate">{item.title}</p>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="bg-slate-100 p-2 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-400">+{items.length - 3} more</span>
                    </div>
                  )}
                </div>
                {items.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-4">No widgets to export. Add charts to your dashboard first.</p>
                )}
              </div>

              <button
                onClick={handleExport}
                disabled={isExporting || items.length === 0}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-900/10 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2Icon className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="w-4 h-4" />
                    Export {exportFormat.toUpperCase()}
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    Frequency
                  </label>
                  <select
                    value={scheduleForm.frequency}
                    onChange={e => setScheduleForm({ ...scheduleForm, frequency: e.target.value as any })}
                    className="w-full p-3 rounded-xl border text-sm font-semibold bg-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                    className="w-full p-3 rounded-xl border text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                  Email Recipients
                </label>
                <input
                  type="email"
                  value={scheduleForm.email}
                  onChange={e => setScheduleForm({ ...scheduleForm, email: e.target.value })}
                  placeholder="email@company.com"
                  className="w-full p-3 rounded-xl border text-sm font-semibold"
                />
                <p className="text-xs text-slate-400 mt-2">Separate multiple emails with commas</p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                  Report Format
                </label>
                <div className="flex gap-3">
                  {['pdf', 'csv', 'both'].map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setScheduleForm({ ...scheduleForm, format: fmt as any })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
                        scheduleForm.format === fmt
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {fmt === 'both' ? 'PDF + CSV' : fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <div className="flex items-start gap-3">
                  <BellIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">Note: Email Delivery</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Email delivery requires backend integration. Schedules are saved locally for now. 
                      Connect to your email service (SendGrid, AWS SES, etc.) to enable automatic delivery.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleScheduleReport}
                disabled={!scheduleForm.email || !dashboard}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Create Schedule
              </button>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {scheduledReports.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No scheduled reports yet</p>
                  <p className="text-sm text-slate-400 mt-1">Create a schedule to automate your reporting</p>
                </div>
              ) : (
                scheduledReports.map(report => (
                  <div
                    key={report.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      report.enabled 
                        ? 'bg-white border-slate-200' 
                        : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${report.enabled ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                          <h4 className="font-bold text-sm">{report.dashboardTitle}</h4>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <RepeatIcon className="w-3 h-3" />
                            {getFrequencyLabel(report.frequency)} at {report.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MailIcon className="w-3 h-3" />
                            {report.email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                            {report.format === 'both' ? 'PDF + CSV' : report.format}
                          </span>
                          {report.lastSent && (
                            <span className="text-[10px] text-slate-400">
                              Last sent: {new Date(report.lastSent).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSchedule(report.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            report.enabled
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {report.enabled ? 'Active' : 'Paused'}
                        </button>
                        <button
                          onClick={() => deleteSchedule(report.id)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Success Toast */}
        {showSuccess && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in">
            <div className="bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
              <CheckIcon className="w-4 h-4" />
              <span className="font-bold text-sm">Export completed successfully!</span>
            </div>
          </div>
        )}

        {/* Error Toast */}
        {exportError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in">
            <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
              <XIcon className="w-4 h-4" />
              <span className="font-bold text-sm">{exportError}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportGenerator;
