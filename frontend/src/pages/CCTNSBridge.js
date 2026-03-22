import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  Download, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ExternalLink,
  FileJson,
  RefreshCw,
  Globe
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import api from '../utils/api';

const CCTNSBridge = () => {
  const [caseContexts, setCaseContexts] = useState([]);
  const [selectedContext, setSelectedContext] = useState(null);
  const [cctnsData, setCctnsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadCaseContexts();
  }, []);

  const loadCaseContexts = async () => {
    try {
      const response = await api.get('/api/case-context/list');
      setCaseContexts(response.data);
      if (response.data.length > 0) {
        setSelectedContext(response.data[0]);
      }
    } catch (error) {
      console.error('Error loading case contexts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCCTNS = async () => {
    if (!selectedContext) {
      toast.error('Please select a case context');
      return;
    }

    setIsExporting(true);
    try {
      const response = await api.get(`/api/case-context/${selectedContext.id}/export-cctns`);
      setCctnsData(response.data);
      toast.success('CCTNS data exported successfully!');
    } catch (error) {
      console.error('Error exporting CCTNS data:', error);
      toast.error(error.response?.data?.detail || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const copyJson = () => {
    if (cctnsData) {
      navigator.clipboard.writeText(JSON.stringify(cctnsData, null, 2));
      toast.success('JSON copied to clipboard!');
    }
  };

  const downloadJson = () => {
    if (cctnsData) {
      const blob = new Blob([JSON.stringify(cctnsData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cctns_${cctnsData.fir_number || 'export'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('JSON downloaded!');
    }
  };

  const fieldGroups = [
    {
      title: 'Case Identification',
      color: '#00C2FF',
      fields: ['fir_number', 'police_station', 'district', 'date_of_fir']
    },
    {
      title: 'Offense Details',
      color: '#FF3B3B',
      fields: ['sections', 'date_of_offense', 'time_of_offense', 'place_of_offense']
    },
    {
      title: 'Complainant',
      color: '#00FFB3',
      fields: ['complainant']
    },
    {
      title: 'Accused Persons',
      color: '#FFB800',
      fields: ['accused']
    },
    {
      title: 'Witnesses',
      color: '#4F7EFF',
      fields: ['witnesses']
    }
  ];

  return (
    <div className="min-h-screen bg-[#030614] p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#00C2FF]/20 to-[#4F7EFF]/20 border border-[#00C2FF]/30">
            <Database className="text-[#00C2FF]" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">CCTNS Extension Bridge</h1>
            <p className="text-white/60 text-sm">Export case data as JSON for browser extension auto-fill</p>
          </div>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="space-y-4">
          {/* Case Selection */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Database className="text-[#00C2FF]" size={18} />
              Select Case
            </h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-[#00C2FF]" size={24} />
              </div>
            ) : caseContexts.length === 0 ? (
              <div className="text-center py-4">
                <AlertCircle className="text-[#FFB800] mx-auto mb-2" size={24} />
                <p className="text-white/60 text-sm">No case contexts found</p>
                <Button
                  onClick={() => window.location.href = '/unified-pipeline'}
                  className="mt-3 bg-[#00C2FF]/20 text-[#00C2FF] hover:bg-[#00C2FF]/30"
                  size="sm"
                >
                  Create New Case
                </Button>
              </div>
            ) : (
              <select
                value={selectedContext?.id || ''}
                onChange={(e) => {
                  const ctx = caseContexts.find(c => c.id === e.target.value);
                  setSelectedContext(ctx);
                  setCctnsData(null);
                }}
                className="w-full p-3 rounded-lg bg-[#030614] border border-white/20 text-white text-sm"
              >
                {caseContexts.map(ctx => (
                  <option key={ctx.id} value={ctx.id}>
                    {ctx.fir_number || 'No FIR'} - {ctx.police_station}
                  </option>
                ))}
              </select>
            )}

            {selectedContext && (
              <div className="mt-3 p-3 rounded-lg bg-[#030614] border border-white/10">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-white/50">FIR Number</div>
                  <div className="text-white">{selectedContext.fir_number || '-'}</div>
                  <div className="text-white/50">Police Station</div>
                  <div className="text-white">{selectedContext.police_station}</div>
                  <div className="text-white/50">District</div>
                  <div className="text-white">{selectedContext.district}</div>
                  <div className="text-white/50">Status</div>
                  <div className="text-[#00FFB3]">{selectedContext.status}</div>
                  <div className="text-white/50">Accused</div>
                  <div className="text-white">{selectedContext.accused_persons?.length || 0}</div>
                  <div className="text-white/50">Witnesses</div>
                  <div className="text-white">{selectedContext.witnesses?.length || 0}</div>
                  <div className="text-white/50">Evidence</div>
                  <div className="text-white">{selectedContext.evidence_items?.length || 0}</div>
                </div>
              </div>
            )}
          </div>

          {/* Export Button */}
          <Button
            onClick={exportToCCTNS}
            disabled={!selectedContext || isExporting}
            className="w-full bg-gradient-to-r from-[#00C2FF] to-[#4F7EFF] hover:opacity-90"
          >
            {isExporting ? (
              <><Loader2 className="animate-spin mr-2" size={18} /> Exporting...</>
            ) : (
              <><RefreshCw size={18} className="mr-2" /> Export CCTNS Data</>
            )}
          </Button>

          {/* Actions */}
          {cctnsData && (
            <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
              <h3 className="text-white font-semibold mb-3">Actions</h3>
              <div className="space-y-2">
                <Button
                  onClick={copyJson}
                  variant="outline"
                  className="w-full border-white/20 text-white/80 hover:text-white"
                >
                  <Copy size={16} className="mr-2" />
                  Copy JSON
                </Button>
                <Button
                  onClick={downloadJson}
                  variant="outline"
                  className="w-full border-white/20 text-white/80 hover:text-white"
                >
                  <Download size={16} className="mr-2" />
                  Download JSON
                </Button>
              </div>
            </div>
          )}

          {/* Extension Info */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#4F7EFF]/10 to-[#00C2FF]/10 border border-[#4F7EFF]/30">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="text-[#4F7EFF]" size={18} />
              <h3 className="text-white font-semibold">Browser Extension</h3>
            </div>
            <p className="text-white/60 text-xs mb-3">
              The CCTNS browser extension can query this endpoint to auto-fill forms on the official CCTNS portal.
            </p>
            <div className="p-2 rounded bg-[#030614] border border-white/10">
              <p className="text-[8px] text-white/40 mb-1">API Endpoint</p>
              <code className="text-[#00C2FF] text-xs break-all">
                /api/case-context/{'{id}'}/export-cctns
              </code>
            </div>
          </div>
        </div>

        {/* Right Panel - JSON Preview */}
        <div className="lg:col-span-2">
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FileJson className="text-[#00FFB3]" size={18} />
                CCTNS Export Data
              </h3>
              {cctnsData && (
                <span className="px-2 py-1 rounded bg-[#00FFB3]/20 text-[#00FFB3] text-xs">
                  Ready for Extension
                </span>
              )}
            </div>

            {cctnsData ? (
              <div className="space-y-4">
                {/* Field Groups */}
                {fieldGroups.map((group, idx) => (
                  <motion.div
                    key={group.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 rounded-lg bg-[#030614] border border-white/10"
                  >
                    <h4 
                      className="text-sm font-semibold mb-3"
                      style={{ color: group.color }}
                    >
                      {group.title}
                    </h4>
                    <div className="space-y-2 text-sm">
                      {group.fields.map(field => {
                        const value = cctnsData[field];
                        if (Array.isArray(value)) {
                          return (
                            <div key={field}>
                              <span className="text-white/50">{field}:</span>
                              <div className="mt-1 ml-4 space-y-1">
                                {value.map((item, i) => (
                                  <div key={i} className="p-2 rounded bg-[#0B0F1A] text-xs">
                                    {typeof item === 'object' ? (
                                      Object.entries(item).map(([k, v]) => (
                                        <div key={k}>
                                          <span className="text-white/40">{k}:</span>
                                          <span className="text-white ml-2">{v || '-'}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <span className="text-white">{item}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        } else if (typeof value === 'object' && value) {
                          return (
                            <div key={field}>
                              <span className="text-white/50">{field}:</span>
                              <div className="mt-1 ml-4 p-2 rounded bg-[#0B0F1A] text-xs">
                                {Object.entries(value).map(([k, v]) => (
                                  <div key={k}>
                                    <span className="text-white/40">{k}:</span>
                                    <span className="text-white ml-2">{v || '-'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div key={field} className="flex items-start gap-2">
                              <span className="text-white/50">{field}:</span>
                              <span className="text-white">{value || '-'}</span>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </motion.div>
                ))}

                {/* Brief Facts */}
                <div className="p-4 rounded-lg bg-[#030614] border border-white/10">
                  <h4 className="text-[#00FFB3] text-sm font-semibold mb-2">Brief Facts</h4>
                  <p className="text-white/70 text-sm whitespace-pre-wrap">
                    {cctnsData.brief_facts || 'No facts available'}
                  </p>
                </div>

                {/* Raw JSON Toggle */}
                <details className="p-4 rounded-lg bg-[#030614] border border-white/10">
                  <summary className="text-white/60 text-sm cursor-pointer hover:text-white">
                    View Raw JSON
                  </summary>
                  <pre className="mt-3 p-4 rounded bg-[#0B0F1A] text-xs text-white/80 overflow-auto max-h-[400px]">
                    {JSON.stringify(cctnsData, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <Database className="text-white/20 mb-4" size={64} />
                <p className="text-white/40 mb-2">No data exported yet</p>
                <p className="text-white/30 text-sm text-center">
                  Select a case context and click "Export CCTNS Data" to generate JSON
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CCTNSBridge;
