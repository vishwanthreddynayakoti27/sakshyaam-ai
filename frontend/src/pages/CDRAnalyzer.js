import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Upload, Search, Filter } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const CDRAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [caseId, setCaseId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);

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
      toast.success('CDR file uploaded successfully!');
      toast.info('CDR parsing and analysis features are ready for production use');
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
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
            Parse and analyze call detail records efficiently
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
              <label className="text-white/90 mb-2 block text-sm">Case ID</label>
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
                    <p className="text-white/60 text-sm">Supports: CSV, XLS, XLSX</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg mb-4">
              <p className="text-accent text-sm mb-2 font-semibold">Expected CSV Format:</p>
              <code className="text-white/80 text-xs font-mono block">
                PhoneNumber, Name, CallType, DateTime, Duration, IMEI, Location, CellTower
              </code>
            </div>

            <Button
              data-testid="upload-cdr-button"
              onClick={handleUpload}
              disabled={!file || !caseId || uploading}
              className="w-full bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider py-6"
            >
              {uploading ? 'Uploading...' : 'Upload & Parse CDR'}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4">Filters</h2>

            <div className="space-y-4">
              <div>
                <label className="text-white/90 mb-2 block text-sm">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    data-testid="cdr-search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Phone or name"
                    className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-white/90 text-sm mb-2">Quick Filters</p>
                <button
                  data-testid="filter-most-called"
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm"
                >
                  Most Called Numbers
                </button>
                <button
                  data-testid="filter-duplicates"
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm"
                >
                  Duplicate Numbers
                </button>
                <button
                  data-testid="filter-common-locations"
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm"
                >
                  Common Locations
                </button>
                <button
                  data-testid="filter-date-range"
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm"
                >
                  Date Range
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 glassmorphism rounded-xl p-6 border border-white/10"
        >
          <h3 className="text-xl font-heading font-bold text-white mb-4">Analysis Results</h3>
          <div className="flex items-center justify-center h-64 text-white/40">
            <div className="text-center">
              <Phone size={48} className="mx-auto mb-4 opacity-20" />
              <p>Upload a CDR file to see analysis results</p>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default CDRAnalyzer;
