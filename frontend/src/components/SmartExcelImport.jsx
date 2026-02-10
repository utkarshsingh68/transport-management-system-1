import { useState, useCallback } from 'react';
import { 
  Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, 
  Sparkles, Eye, Download, RefreshCw, ChevronDown, ChevronUp,
  Users, Calendar, IndianRupee, FileText, Hash, X, Loader2
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function SmartExcelImport({ onImportComplete, onClose }) {
  const [step, setStep] = useState('upload'); // upload, preview, importing, complete
  const [file, setFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [createNewParties, setCreateNewParties] = useState(true);
  const [showAllRows, setShowAllRows] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [importResult, setImportResult] = useState(null);

  // Handle file drop/select
  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
        toast.error('Please upload an Excel (.xlsx, .xls) or CSV file');
        return;
      }
      setFile(droppedFile);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  // Analyze uploaded file
  const analyzeFile = async () => {
    if (!file) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/ledger-import/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setAnalysisResult(response.data);
      setStep('preview');
      toast.success(response.data.aiPowered 
        ? '🤖 File analyzed with Groq AI!' 
        : 'File analyzed with smart pattern detection!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error.response?.data?.error || 'Failed to analyze file');
    } finally {
      setLoading(false);
    }
  };

  // Execute import
  const executeImport = async () => {
    if (!analysisResult) return;
    
    setImporting(true);
    setStep('importing');
    
    try {
      // Filter only valid rows
      const validRows = analysisResult.allRows.filter(r => r.status !== 'error');
      
      const response = await api.post('/ledger-import/smart-import', {
        analyzedRows: validRows,
        createNewParties,
        partyMatches: analysisResult.partyMatches
      });
      
      setImportResult(response.data.results);
      setStep('complete');
      toast.success(`Import completed: ${response.data.results.success} entries created`);
      
      if (onImportComplete) {
        onImportComplete(response.data.results);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.response?.data?.error || 'Import failed');
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  // Download template
  const downloadTemplate = async () => {
    try {
      const response = await api.get('/ledger-import/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'party_ledger_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  // Reset and start over
  const resetImport = () => {
    setFile(null);
    setAnalysisResult(null);
    setStep('upload');
    setImportResult(null);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': case 'exact': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-orange-600 bg-orange-50';
      case 'new': return 'text-blue-600 bg-blue-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  const toggleRowExpand = (rowNum) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowNum)) {
      newExpanded.delete(rowNum);
    } else {
      newExpanded.add(rowNum);
    }
    setExpandedRows(newExpanded);
  };

  // Upload Step
  if (step === 'upload') {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Smart Excel Import</h2>
                <p className="text-sm text-slate-500">AI-powered ledger import</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <div 
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                file ? 'border-green-300 bg-green-50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50'
              }`}
              onDrop={handleFileDrop}
              onDragOver={handleDragOver}
            >
              {file ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto">
                    <FileSpreadsheet size={32} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button 
                    onClick={() => setFile(null)}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Remove and choose another
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto">
                    <Upload size={32} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Drop your Excel file here</p>
                    <p className="text-sm text-slate-500">or click to browse</p>
                  </div>
                  <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileDrop}
                  />
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4">
              <h4 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
                <Sparkles size={16} />
                AI Auto-Detection (Powered by Groq LLM)
              </h4>
              <ul className="text-sm text-violet-700 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-violet-500" />
                  🤖 Uses Llama 3.3 70B for intelligent column detection
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-violet-500" />
                  Matches existing parties or creates new ones
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-violet-500" />
                  Classifies transactions as debit/credit intelligently
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-violet-500" />
                  Supports Hindi, English, and mixed language headers
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 text-violet-600 hover:bg-violet-50 rounded-xl transition-colors"
              >
                <Download size={18} />
                Download Template
              </button>
              
              <button
                onClick={analyzeFile}
                disabled={!file || loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Analyze with AI
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preview Step
  if (step === 'preview' && analysisResult) {
    const { validRows, errorRows, partyStats, detectionSummary, previewRows } = analysisResult;
    const displayRows = showAllRows ? (analysisResult.allRows || previewRows) : previewRows.slice(0, 20);
    
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Eye className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Preview Import Data</h2>
                <p className="text-sm text-slate-500">{analysisResult.fileName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          {/* Stats Cards */}
          <div className="p-6 border-b border-slate-200 flex-shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-slate-900">{analysisResult.totalRows}</div>
                <div className="text-sm text-slate-500">Total Rows</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-600">{validRows}</div>
                <div className="text-sm text-green-700">Valid Rows</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-red-600">{errorRows}</div>
                <div className="text-sm text-red-700">Error Rows</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-blue-600">{partyStats?.matched || 0}</div>
                <div className="text-sm text-blue-700">Matched Parties</div>
              </div>
              <div className="bg-violet-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-violet-600">{partyStats?.new || 0}</div>
                <div className="text-sm text-violet-700">New Parties</div>
              </div>
            </div>

            {/* AI Detection Summary */}
            <div className={`mt-4 rounded-xl p-4 ${analysisResult.aiPowered ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gradient-to-r from-violet-50 to-purple-50'}`}>
              <h4 className={`font-semibold mb-2 flex items-center gap-2 ${analysisResult.aiPowered ? 'text-emerald-900' : 'text-violet-900'}`}>
                <Sparkles size={16} />
                {analysisResult.aiPowered ? '🤖 AI-Powered (Groq LLM) Column Detection' : 'Smart Pattern-Based Column Detection'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {detectionSummary.partyName && (
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-white border ${analysisResult.aiPowered ? 'text-emerald-700 border-emerald-200' : 'text-violet-700 border-violet-200'}`}>
                    <Users size={14} /> Party: {detectionSummary.partyName}
                  </span>
                )}
                {detectionSummary.date && (
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-white border ${analysisResult.aiPowered ? 'text-emerald-700 border-emerald-200' : 'text-violet-700 border-violet-200'}`}>
                    <Calendar size={14} /> Date: {detectionSummary.date}
                  </span>
                )}
                {detectionSummary.debit && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-white text-green-700 border border-green-200">
                    <IndianRupee size={14} /> Debit: {detectionSummary.debit}
                  </span>
                )}
                {detectionSummary.credit && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-white text-red-700 border border-red-200">
                    <IndianRupee size={14} /> Credit: {detectionSummary.credit}
                  </span>
                )}
                {detectionSummary.amount && !detectionSummary.debit && !detectionSummary.credit && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-white text-amber-700 border border-amber-200">
                    <IndianRupee size={14} /> Amount: {detectionSummary.amount}
                  </span>
                )}
                {detectionSummary.description && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-white text-slate-700 border border-slate-200">
                    <FileText size={14} /> Desc: {detectionSummary.description}
                  </span>
                )}
                {detectionSummary.tripId && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-white text-slate-700 border border-slate-200">
                    <Hash size={14} /> Trip: {detectionSummary.tripId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Data Preview Table */}
          <div className="flex-1 overflow-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-slate-900">Data Preview</h4>
              <button
                onClick={() => setShowAllRows(!showAllRows)}
                className="text-sm text-violet-600 hover:text-violet-700"
              >
                {showAllRows ? 'Show fewer rows' : `Show all ${analysisResult.totalRows} rows`}
              </button>
            </div>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Row</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Party Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Match</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Debit</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Credit</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayRows.map((row, idx) => (
                    <tr 
                      key={row.rowNumber} 
                      className={`${row.status === 'error' ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100/50`}
                    >
                      <td className="px-4 py-3 text-slate-500">{row.rowNumber}</td>
                      <td className="px-4 py-3">
                        {row.status === 'error' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                            <XCircle size={12} /> Error
                          </span>
                        ) : row.warnings?.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                            <AlertTriangle size={12} /> Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                            <CheckCircle size={12} /> Valid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.parsed.party_name || '-'}</td>
                      <td className="px-4 py-3">
                        {row.partyMatch && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getConfidenceColor(row.partyMatch.confidence)}`}>
                            {row.partyMatch.isNew ? 'New' : row.partyMatch.confidence}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.parsed.date || '-'}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {row.parsed.debit > 0 ? formatCurrency(row.parsed.debit) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {row.parsed.credit > 0 ? formatCurrency(row.parsed.credit) : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]" title={row.parsed.description}>
                        {row.parsed.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-slate-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={createNewParties}
                    onChange={(e) => setCreateNewParties(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-slate-700">Auto-create new parties ({partyStats?.new || 0})</span>
                </label>
                <button
                  onClick={resetImport}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <RefreshCw size={18} />
                  Start Over
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeImport}
                  disabled={validRows === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30 hover:shadow-green-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={18} />
                  Import {validRows} Entries
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Importing Step
  if (step === 'importing') {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-6">
            <Loader2 size={40} className="text-violet-600 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Importing Data...</h2>
          <p className="text-slate-500">Please wait while we process your entries</p>
          <div className="mt-6 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  // Complete Step
  if (step === 'complete' && importResult) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
          <div className="p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Import Complete!</h2>
            <p className="text-slate-500 mb-6">Your ledger entries have been created successfully</p>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                <div className="text-sm text-green-700">Imported</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-amber-600">{importResult.skipped}</div>
                <div className="text-sm text-amber-700">Skipped</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                <div className="text-sm text-red-700">Failed</div>
              </div>
            </div>

            {importResult.newParties > 0 && (
              <div className="bg-blue-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-blue-700">
                  <Users size={18} />
                  <span className="font-medium">{importResult.newParties} new parties created</span>
                </div>
              </div>
            )}

            {importResult.errors?.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4 mb-6 max-h-32 overflow-auto text-left">
                <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {importResult.errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>Row {err.row}: {err.reason}</li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li className="text-red-500">...and {importResult.errors.length - 5} more errors</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={resetImport}
                className="flex-1 px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                Import More
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30 hover:shadow-green-500/40 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
