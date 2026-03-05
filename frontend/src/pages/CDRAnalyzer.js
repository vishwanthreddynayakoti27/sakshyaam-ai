import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Upload, Search, Filter, BarChart3, MapPin, Clock, Users, Hash } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { api } from '../utils/api';

const CDRAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [caseId, setCaseId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [columnsDetected, setColumnsDetected] = useState([]);
  const [recordsCount, setRecordsCount] = useState(0);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setAnalysis(null);
      }
    }
  });

  const handleUpload = async () => {
    if (!file || !caseId) {
      toast.error('Please provide both file and case ID');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('case_id', caseId);
      
      const response = await api.post('/cdr/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const data = response.data || response;
      
      if (data.analysis) {
        setAnalysis(data.analysis);
        setColumnsDetected(data.columns_detected || []);
        setRecordsCount(data.records_processed || 0);
        toast.success(`CDR parsed! ${data.records_processed} records analyzed`);
      } else {
        toast.info(data.message || 'CDR uploaded');
      }
    } catch (err) {
      console.error('CDR upload error:', err);
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const filterByMostCalled = () => {
    if (analysis?.most_called_numbers) {
      toast.info(`Top callers: ${analysis.most_called_numbers.slice(0, 3).map(([num, count]) => `${num} (${count} calls)`).join(', ')}`);
    }
  };

  const filterByDuplicates = () => {
    if (analysis?.duplicate_numbers) {
      toast.info(`Duplicates found: ${analysis.duplicate_numbers.length} numbers appear 3+ times`);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="cdr-analyzer-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-heading font-bold text-white text-glow mb-3" data-testid="page-title">
            CDR Analyzer
          </h1>
          <p className="text-white/60 text-lg">
            Parse and analyze call detail records with dynamic column detection
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4" data-testid="upload-section-title">Upload CDR File</h2>

            <div className="mb-4">
              <label className="text-white/90 mb-2 block text-sm">Case ID / FIR Number</label>
              <Input
                data-testid="case-id-input"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder="Enter case ID or FIR number"
                className="bg-black/20 border-white/10 focus:border-accent text-white"
              />
            </div>

            <div
              {...getRootProps()}
              data-testid="cdr-dropzone"
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all mb-4 ${
                isDragActive
                  ? 'border-accent bg-accent/10'
                  : 'border-white/20 hover:border-accent/50 bg-white/5 hover:bg-white/10'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
                  <Phone className="text-accent" size={32} />
                </div>
                {file ? (
                  <div>
                    <p className="text-white font-semibold mb-1" data-testid="uploaded-cdr-filename">{file.name}</p>
                    <p className="text-white/60 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-white font-semibold mb-1">
                      {isDragActive ? 'Drop CDR file here' : 'Drag & drop CDR file or click to upload'}
                    </p>
                    <p className="text-white/60 text-sm">Supports: CSV, XLS, XLSX (any telecom format)</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg mb-4">
              <p className="text-accent text-sm mb-2 font-semibold">Dynamic Column Detection:</p>
              <p className="text-white/70 text-xs">
                System auto-detects columns: Phone numbers (MSISDN, Caller, A_Number), DateTime, Duration, IMEI, Tower ID, Location
              </p>
            </div>

            <Button
              data-testid="upload-cdr-button"
              onClick={handleUpload}
              disabled={!file || !caseId || uploading}
              className="w-full bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider py-6"
            >
              {uploading ? 'Processing...' : 'Upload & Parse CDR'}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4">Quick Analysis</h2>

            <div className="space-y-4">
              <div>
                <label className="text-white/90 mb-2 block text-sm">Search Number</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    data-testid="cdr-search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Phone number"
                    className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-white/90 text-sm mb-2">Quick Filters</p>
                <button
                  data-testid="filter-most-called"
                  onClick={filterByMostCalled}
                  disabled={!analysis}
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm disabled:opacity-50"
                >
                  <Users size={14} className="inline mr-2" />
                  Most Called Numbers
                </button>
                <button
                  data-testid="filter-duplicates"
                  onClick={filterByDuplicates}
                  disabled={!analysis}
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm disabled:opacity-50"
                >
                  <Hash size={14} className="inline mr-2" />
                  Duplicate Numbers
                </button>
                <button
                  data-testid="filter-common-locations"
                  disabled={!analysis}
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm disabled:opacity-50"
                >
                  <MapPin size={14} className="inline mr-2" />
                  Common Locations
                </button>
                <button
                  data-testid="filter-date-range"
                  disabled={!analysis}
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm disabled:opacity-50"
                >
                  <Clock size={14} className="inline mr-2" />
                  Date Range
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="glassmorphism rounded-xl p-4 border border-accent/30">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 size={20} className="text-accent" />
                <span className="text-white/60 text-sm">Total Records</span>
              </div>
              <p className="text-2xl font-bold text-white">{analysis.total_records || recordsCount}</p>
            </div>

            <div className="glassmorphism rounded-xl p-4 border border-success/30">
              <div className="flex items-center gap-3 mb-2">
                <Hash size={20} className="text-success" />
                <span className="text-white/60 text-sm">Columns Detected</span>
              </div>
              <p className="text-2xl font-bold text-white">{columnsDetected.length}</p>
              <p className="text-xs text-white/50 mt-1">{columnsDetected.join(', ')}</p>
            </div>

            <div className="glassmorphism rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center gap-3 mb-2">
                <Clock size={20} className="text-purple-400" />
                <span className="text-white/60 text-sm">Date Range</span>
              </div>
              {analysis.date_range?.start ? (
                <div>
                  <p className="text-sm text-white">{analysis.date_range.start}</p>
                  <p className="text-xs text-white/50">to {analysis.date_range.end}</p>
                </div>
              ) : (
                <p className="text-white/50 text-sm">No dates found</p>
              )}
            </div>

            <div className="glassmorphism rounded-xl p-4 border border-warning/30">
              <div className="flex items-center gap-3 mb-2">
                <Users size={20} className="text-warning" />
                <span className="text-white/60 text-sm">Frequent Numbers</span>
              </div>
              <p className="text-2xl font-bold text-white">{analysis.duplicate_numbers?.length || 0}</p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 glassmorphism rounded-xl p-6 border border-white/10"
        >
          <h3 className="text-xl font-heading font-bold text-white mb-4">Analysis Results</h3>
          
          {analysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Users size={16} className="text-accent" />
                  Most Called Numbers
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {analysis.most_called_numbers?.slice(0, 10).map(([number, count], i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                      <span className="text-white font-mono text-sm">{number}</span>
                      <span className="text-accent font-bold">{count} calls</span>
                    </div>
                  ))}
                  {(!analysis.most_called_numbers || analysis.most_called_numbers.length === 0) && (
                    <p className="text-white/50 text-sm">No data available</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-success" />
                  Common Locations
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {analysis.common_locations?.slice(0, 10).map(([location, count], i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                      <span className="text-white text-sm">{location}</span>
                      <span className="text-success font-bold">{count} calls</span>
                    </div>
                  ))}
                  {(!analysis.common_locations || analysis.common_locations.length === 0) && (
                    <p className="text-white/50 text-sm">No location data</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-white/40">
              <div className="text-center">
                <Phone size={48} className="mx-auto mb-4 opacity-20" />
                <p>Upload a CDR file to see analysis results</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default CDRAnalyzer;
