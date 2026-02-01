import React from 'react';
import { ExcelColumn, ExcelSheet, ExcelWorkbook, TableInfo } from '../types';
import { FileSpreadsheetIcon, FileTextIcon, Link2Icon, TableIcon, UploadCloudIcon } from 'lucide-react';

interface IntegrationsPanelProps {
  integrationCategory: 'all' | 'databases' | 'nosql' | 'files';
  setIntegrationCategory: (value: 'all' | 'databases' | 'nosql' | 'files') => void;
  integrationSearch: string;
  setIntegrationSearch: (value: string) => void;
  integrationHistory: { id: string; name: string; connectedAt: number }[];
  analyticsIntegrationIds: string[];
  setAnalyticsIntegrationIds: React.Dispatch<React.SetStateAction<string[]>>;
  integrations: { id: string; name: string; category: string; status: string; description: string }[];
  integrationStatuses: Record<string, 'available' | 'connected'>;
  selectedIntegrationId: string | null;
  setSelectedIntegrationId: (value: string) => void;
  integrationUseUrl: boolean;
  setIntegrationUseUrl: React.Dispatch<React.SetStateAction<boolean>>;
  integrationUrlForm: { connectionString: string; username: string; password: string };
  setIntegrationUrlForm: React.Dispatch<React.SetStateAction<{ connectionString: string; username: string; password: string }>>;
  integrationFields: Record<string, { id: string; label: string; type?: string; placeholder?: string }[]>;
  integrationRelationalForm: { [key: string]: string };
  setIntegrationRelationalForm: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  integrationIsConnecting: boolean;
  integrationError: string | null;
  integrationTables: TableInfo[];
  integrationSelectedTableName: string | null;
  setIntegrationSelectedTableName: (value: string | null) => void;
  toggleIntegrationTable: (tableName: string) => void;
  toggleAllIntegrationTables: (selectAll: boolean) => void;
  parseSchemaColumns: (schema: string) => { name: string; details: string }[];
  handleIntegrationTest: () => void;
  handleIntegrationSave: () => void;
  excelWorkbook: ExcelWorkbook | null;
  excelIsLoading: boolean;
  excelError: string | null;
  activeExcelSheet: ExcelSheet | null;
  setExcelActiveSheetId: React.Dispatch<React.SetStateAction<string | null>>;
  handleExcelUpload: (file: File) => Promise<void>;
  toggleExcelSheet: (sheetId: string, included: boolean) => Promise<void>;
  renameExcelColumn: (sheetId: string, columnId: string, nextName: string) => Promise<void>;
  toggleExcelColumn: (sheetId: string, columnId: string, included: boolean) => Promise<void>;
}

export const IntegrationsPanel: React.FC<IntegrationsPanelProps> = ({
  integrationCategory,
  setIntegrationCategory,
  integrationSearch,
  setIntegrationSearch,
  integrationHistory,
  analyticsIntegrationIds,
  setAnalyticsIntegrationIds,
  integrations,
  integrationStatuses,
  selectedIntegrationId,
  setSelectedIntegrationId,
  integrationUseUrl,
  setIntegrationUseUrl,
  integrationUrlForm,
  setIntegrationUrlForm,
  integrationFields,
  integrationRelationalForm,
  setIntegrationRelationalForm,
  integrationIsConnecting,
  integrationError,
  integrationTables,
  integrationSelectedTableName,
  setIntegrationSelectedTableName,
  toggleIntegrationTable,
  toggleAllIntegrationTables,
  parseSchemaColumns,
  handleIntegrationTest,
  handleIntegrationSave,
  excelWorkbook,
  excelIsLoading,
  excelError,
  activeExcelSheet,
  setExcelActiveSheetId,
  handleExcelUpload,
  toggleExcelSheet,
  renameExcelColumn,
  toggleExcelColumn
}) => {
  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="bg-white w-full rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[80vh]">
        <div className="flex items-center justify-between px-10 pt-8 pb-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Data Integrations</h3>
            <p className="text-xs text-slate-500 font-medium">Connect external sources and sync data</p>
          </div>
        </div>

        <div className="px-10 pb-10 grid grid-cols-12 gap-8">
          <div className="col-span-4 bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Sources</label>
              <input
                value={integrationSearch}
                onChange={(e) => setIntegrationSearch(e.target.value)}
                placeholder="Search SQL, NoSQL, Excel..."
                className="mt-2 w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categories</p>
              {[
                { id: 'all', label: 'All Sources' },
                { id: 'databases', label: 'Relational (SQL)' },
                { id: 'nosql', label: 'NoSQL' },
                { id: 'files', label: 'Files' }
              ].map(category => (
                <button
                  key={category.id}
                  onClick={() => setIntegrationCategory(category.id as any)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                    integrationCategory === category.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connected</p>
              {integrationHistory.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No connected integrations yet.</div>
              ) : (
                integrationHistory.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-xl px-3 py-2">
                    <button
                      onClick={() => setSelectedIntegrationId(item.id)}
                      className="text-left text-xs font-semibold text-slate-700 truncate"
                    >
                      {item.name}
                    </button>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <input
                        type="checkbox"
                        checked={analyticsIntegrationIds.includes(item.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAnalyticsIntegrationIds(prev => checked ? [...prev, item.id] : prev.filter(id => id !== item.id));
                        }}
                        className="w-3.5 h-3.5 text-blue-600 rounded"
                      />
                      Analytics
                    </label>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
              {integrations
                .filter(item => integrationCategory === 'all' || item.category === integrationCategory)
                .filter(item => item.name.toLowerCase().includes(integrationSearch.toLowerCase()))
                .map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedIntegrationId(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                      selectedIntegrationId === item.id ? 'bg-white border border-blue-500 text-slate-900 shadow-sm' : 'bg-white border border-slate-100 text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      integrationStatuses[item.id] === 'connected' ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                      {integrationStatuses[item.id] === 'connected' ? 'Connected' : 'Available'}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <div className="col-span-8">
            {selectedIntegrationId === 'excel' ? (
              <div className="p-6 bg-white border border-slate-100 rounded-3xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excel Upload</p>
                    <h4 className="text-xl font-black text-slate-900">Upload Spreadsheet</h4>
                    <p className="text-xs text-slate-500 mt-1">All sheets are loaded for analysis. Columns can be renamed or removed.</p>
                  </div>
                </div>

                <div className="border border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50">
                  <input
                    id="excel-upload-input"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleExcelUpload(file);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <label
                    htmlFor="excel-upload-input"
                    className="flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold cursor-pointer hover:border-blue-300 hover:text-blue-600 transition-all"
                  >
                    <UploadCloudIcon className="w-5 h-5" />
                    Upload Excel File
                  </label>
                  {excelWorkbook && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <FileSpreadsheetIcon className="w-4 h-4" />
                      <span>{excelWorkbook.fileName}</span>
                    </div>
                  )}
                  {excelIsLoading && (
                    <div className="mt-3 text-xs font-semibold text-blue-600">Preparing Excel data...</div>
                  )}
                  {excelError && (
                    <div className="mt-3 text-xs font-semibold text-red-600">{excelError}</div>
                  )}
                </div>

                {excelWorkbook && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheetIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-bold text-slate-700">Sheets</span>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                        {excelWorkbook.sheets.map(sheet => (
                          <div
                            key={sheet.id}
                            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border transition-all ${
                              activeExcelSheet?.id === sheet.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'
                            }`}
                          >
                            <button
                              onClick={() => setExcelActiveSheetId(sheet.id)}
                              className="text-left flex-1"
                            >
                              <p className="text-sm font-bold text-slate-800">{sheet.name}</p>
                              <p className="text-[10px] text-slate-500">{sheet.rowCount} rows</p>
                            </button>
                            <input
                              type="checkbox"
                              checked={sheet.included}
                              onChange={(e) => toggleExcelSheet(sheet.id, e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileTextIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-bold text-slate-700">Columns</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {activeExcelSheet ? activeExcelSheet.name : 'No sheet selected'}
                        </span>
                      </div>
                      {activeExcelSheet ? (
                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                          {activeExcelSheet.columns.map((column: ExcelColumn) => (
                            <div key={column.id} className="flex items-center gap-2">
                              <input
                                value={column.name}
                                onChange={(e) => renameExcelColumn(activeExcelSheet.id, column.id, e.target.value)}
                                disabled={!column.included}
                                className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold ${
                                  column.included ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-100 text-slate-400 line-through'
                                }`}
                              />
                              <button
                                onClick={() => toggleExcelColumn(activeExcelSheet.id, column.id, !column.included)}
                                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                                  column.included
                                    ? 'bg-red-50 text-red-600 border border-red-200'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                }`}
                              >
                                {column.included ? 'Remove' : 'Restore'}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Select a sheet to edit columns.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-white border border-slate-100 rounded-3xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connection</p>
                    <h4 className="text-xl font-black text-slate-900">
                      {integrations.find(i => i.id === selectedIntegrationId)?.name || 'Select a source'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">Enter credentials for the selected source.</p>
                  </div>
                  {selectedIntegrationId === 'relational' && (
                    <button
                      onClick={() => setIntegrationUseUrl(!integrationUseUrl)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        integrationUseUrl ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-300'
                      }`}
                    >
                      <Link2Icon className="w-3 h-3" />
                      {integrationUseUrl ? 'Using URL' : 'Use URL'}
                    </button>
                  )}
                </div>

                {selectedIntegrationId === 'relational' && integrationUseUrl ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Connection URL</label>
                      <input
                        value={integrationUrlForm.connectionString}
                        onChange={(e) => setIntegrationUrlForm(prev => ({ ...prev, connectionString: e.target.value }))}
                        placeholder="postgresql://user:pass@host:5432/db"
                        className="w-full p-3 rounded-xl border text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-2">Supports JDBC/URL format for SQL databases.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Username</label>
                        <input
                          value={integrationUrlForm.username}
                          onChange={(e) => setIntegrationUrlForm(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Password</label>
                        <input
                          type="password"
                          value={integrationUrlForm.password}
                          onChange={(e) => setIntegrationUrlForm(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {(integrationFields[selectedIntegrationId || 'relational'] || []).map(field => (
                      <div key={field.id} className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">{field.label}</label>
                        <input
                          type={field.type || 'text'}
                          placeholder={field.placeholder}
                          value={
                            selectedIntegrationId === 'relational' && field.id in integrationRelationalForm
                              ? (integrationRelationalForm as any)[field.id]
                              : undefined
                          }
                          onChange={(e) => {
                            if (selectedIntegrationId === 'relational') {
                              setIntegrationRelationalForm(prev => ({ ...prev, [field.id]: e.target.value }));
                            }
                          }}
                          className="w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {selectedIntegrationId === 'nosql' && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-4 py-3 text-xs font-semibold">
                    NoSQL connectors are not wired yet. Connection testing is disabled for now.
                  </div>
                )}

                {selectedIntegrationId === 'relational' && (
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Sync Frequency</label>
                      <select className="w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option>Hourly</option>
                        <option>Daily</option>
                        <option>Weekly</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-3">
                      <button
                        onClick={handleIntegrationTest}
                        disabled={integrationIsConnecting || selectedIntegrationId !== 'relational'}
                        className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {integrationIsConnecting ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        onClick={handleIntegrationSave}
                        disabled={integrationIsConnecting || selectedIntegrationId !== 'relational'}
                        className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50"
                      >
                        {integrationIsConnecting ? 'Saving...' : 'Save Integration'}
                      </button>
                    </div>
                  </div>
                )}

                {integrationError && (
                  <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-xs font-semibold">
                    {integrationError}
                  </div>
                )}

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <TableIcon className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-slate-700">Tables</span>
                      </div>
                      {integrationTables.length > 0 && (
                        <button
                          onClick={() => {
                            const allSelected = integrationTables.every(t => t.selected);
                            toggleAllIntegrationTables(!allSelected);
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700"
                        >
                          {integrationTables.every(t => t.selected) ? 'Clear All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                      {integrationTables.map(table => (
                        <div
                          key={table.name}
                          onClick={() => setIntegrationSelectedTableName(table.name)}
                          className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border transition-all cursor-pointer ${
                            integrationSelectedTableName === table.name ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-800">{table.name}</p>
                          </div>
                          <input type="checkbox" checked={table.selected} onChange={() => toggleIntegrationTable(table.name)} className="w-4 h-4 text-blue-600 rounded" />
                        </div>
                      ))}
                      {integrationTables.length === 0 && (
                        <div className="h-full flex items-center justify-center text-slate-400 italic text-sm text-center">
                          Tables will appear here after connection.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileTextIcon className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-slate-700">Schema</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {integrationSelectedTableName || 'No table selected'}
                      </span>
                    </div>
                    {integrationSelectedTableName ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 max-h-[280px] overflow-y-auto custom-scrollbar">
                        {parseSchemaColumns(
                          integrationTables.find(t => t.name === integrationSelectedTableName)?.schema || ''
                        ).map((column, idx) => (
                          <div key={`${integrationSelectedTableName}-${idx}`} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                            <span className="text-xs font-semibold text-slate-700 truncate">{column.name}</span>
                            <span className="text-[10px] font-mono text-slate-500 text-right">{column.details}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">Select a table to view its schema details.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
