import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Mic, File, Image as ImageIcon, Download, Copy, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { ocr } from '../utils/api';

const LanguageIntelligence = () => {
  const [selectedTab, setSelectedTab] = useState('document');
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
      }
    }
  });

  const handleProcess = async () => {
    if (!file) {
      toast.error('Please upload a file first');
      return;
    }

    setProcessing(true);
    try {
      const response = await ocr.processImage(file);
      setResult(response);
      
      if (response.message && response.message.includes('not configured')) {
        toast.warning(response.message);
      } else {
        toast.success('Document processed successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleDownload = () => {
    if (!result) return;
    const content = `ORIGINAL TEXT:\n${result.original_text}\n\nTRANSLATED TEXT:\n${result.translated_text}\n\nLEGAL TEXT:\n${result.legal_text}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'processed-document.txt';
    a.click();
    toast.success('Downloaded!');
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="language-intelligence-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-heading font-bold text-white text-glow mb-3" data-testid="page-title">
            Language Intelligence Module
          </h1>
          <p className="text-white/60 text-lg">
            Multi-format OCR, Translation & Legal Text Conversion
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4" data-testid="input-section-title">Input Source</h2>

            <div className="flex gap-2 mb-6">
              <Button
                data-testid="tab-document-button"
                onClick={() => setSelectedTab('document')}
                className={`flex-1 ${
                  selectedTab === 'document'
                    ? 'bg-accent text-black'
                    : 'bg-transparent border border-accent/50 text-accent'
                } font-bold uppercase tracking-wider transition-all rounded-sm text-xs`}
              >
                <Upload size={14} className="mr-2" />
                Document
              </Button>
              <Button
                data-testid="tab-audio-button"
                onClick={() => setSelectedTab('audio')}
                className={`flex-1 ${
                  selectedTab === 'audio'
                    ? 'bg-accent text-black'
                    : 'bg-transparent border border-accent/50 text-accent'
                } font-bold uppercase tracking-wider transition-all rounded-sm text-xs`}
              >
                <Mic size={14} className="mr-2" />
                Audio
              </Button>
            </div>

            {selectedTab === 'document' && (
              <div>
                <div
                  {...getRootProps()}
                  data-testid="file-dropzone"
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-accent bg-accent/10'
                      : 'border-white/20 hover:border-accent/50 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
                      {file ? (
                        <File className="text-accent" size={32} />
                      ) : (
                        <ImageIcon className="text-accent" size={32} />
                      )}
                    </div>
                    {file ? (
                      <div>
                        <p className="text-white font-semibold mb-1" data-testid="uploaded-filename">{file.name}</p>
                        <p className="text-white/60 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-white font-semibold mb-1">
                          {isDragActive ? 'Drop file here' : 'Drag & drop or click to upload'}
                        </p>
                        <p className="text-white/60 text-sm">Supports: PDF, DOC, DOCX, JPG, PNG</p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  data-testid="process-button"
                  onClick={handleProcess}
                  disabled={!file || processing}
                  className="w-full mt-6 bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider py-6"
                >
                  {processing ? 'Processing...' : 'Process Document'}
                </Button>
              </div>
            )}

            {selectedTab === 'audio' && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mic className="text-white/40" size={32} />
                </div>
                <p className="text-white/60 mb-4">Audio processing ready</p>
                <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                  <p className="text-accent text-sm">
                    Speech-to-Text API ready to activate. Enable billing in Google Cloud Console to use this feature.
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-white" data-testid="output-section-title">Output Results</h2>
              {result && (
                <div className="flex gap-2">
                  <Button
                    data-testid="copy-button"
                    onClick={() => handleCopy(result.legal_text)}
                    className="bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm p-2"
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    data-testid="download-button"
                    onClick={handleDownload}
                    className="bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm p-2"
                  >
                    <Download size={16} />
                  </Button>
                </div>
              )}
            </div>

            {!result ? (
              <div className="flex items-center justify-center h-96 text-white/40">
                <div className="text-center">
                  <File size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Process a document to see results</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4" data-testid="result-output">
                {result.message && (
                  <div className={`flex items-start gap-2 p-4 rounded-lg border ${
                    result.message.includes('not configured')
                      ? 'bg-alert/10 border-alert/30 text-alert'
                      : 'bg-accent/10 border-accent/30 text-accent'
                  }`}>
                    {result.message.includes('not configured') ? (
                      <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle size={20} className="mt-0.5 flex-shrink-0" />
                    )}
                    <p className="text-sm">{result.message}</p>
                  </div>
                )}

                <div>
                  <label className="text-white/90 font-semibold mb-2 block">Original Text</label>
                  <div className="bg-black/30 border border-white/10 rounded-lg p-4 max-h-32 overflow-y-auto">
                    <p className="text-white/80 text-sm font-mono whitespace-pre-wrap" data-testid="original-text">
                      {result.original_text || 'No text detected'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-white/90 font-semibold mb-2 block">
                    Detected Language: <span className="text-accent">{result.detected_language}</span>
                  </label>
                </div>

                <div>
                  <label className="text-white/90 font-semibold mb-2 block">Translated Text (English)</label>
                  <div className="bg-black/30 border border-white/10 rounded-lg p-4 max-h-32 overflow-y-auto">
                    <p className="text-white/80 text-sm" data-testid="translated-text">
                      {result.translated_text}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-white/90 font-semibold mb-2 block">Strict Legal English (Court-Ready)</label>
                  <div className="bg-black/30 border border-accent/30 rounded-lg p-4 max-h-40 overflow-y-auto">
                    <p className="text-white text-sm" data-testid="legal-text">
                      {result.legal_text}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm">Confidence:</span>
                  <div className="flex-1 bg-black/30 rounded-full h-2">
                    <div
                      className="bg-success h-full rounded-full transition-all"
                      style={{ width: `${result.confidence_score * 100}%` }}
                    />
                  </div>
                  <span className="text-success font-bold text-sm">{(result.confidence_score * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default LanguageIntelligence;
