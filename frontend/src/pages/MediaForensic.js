import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Upload, Video, Music, AlertTriangle, CheckCircle, XCircle, HelpCircle, TrendingUp, Info } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { api } from '../utils/api';

const MediaForensic = () => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const response = await api.get('/forensic/reports');
      setReports(response.data);
    } catch (err) {
      console.error('Failed to load reports');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.mov', '.avi'],
      'audio/*': ['.wav', '.mp3', '.m4a']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setResult(null);
      }
    },
    onDropRejected: (rejectedFiles) => {
      if (rejectedFiles[0]?.errors[0]?.code === 'file-too-large') {
        toast.error('File too large. Maximum size is 50MB');
      } else {
        toast.error('Invalid file type');
      }
    }
  });

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('Please upload a file first');
      return;
    }

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/forensic/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
      
      const riskLevel = response.data.risk_level;
      if (riskLevel === 'Low') {
        toast.success('Analysis Complete: Media appears AUTHENTIC');
      } else if (riskLevel === 'Medium') {
        toast.warning('Analysis Complete: Results INCONCLUSIVE');
      } else {
        toast.error('Analysis Complete: Media may be AI-GENERATED');
      }
      
      loadReports();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed');
    } finally {
      setProcessing(false);
    }
  };

  const getVerdictDisplay = () => {
    if (!result) return null;
    
    const score = result.probability_score;
    
    if (score >= 75) {
      return {
        verdict: 'LIKELY AUTHENTIC',
        subtitle: 'This media appears to be REAL and unmanipulated',
        icon: CheckCircle,
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500',
        textColor: 'text-green-400',
        iconColor: 'text-green-400',
        scoreLabel: 'Authenticity Score'
      };
    } else if (score >= 50) {
      return {
        verdict: 'INCONCLUSIVE',
        subtitle: 'Results are unclear - professional verification recommended',
        icon: HelpCircle,
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500',
        textColor: 'text-yellow-400',
        iconColor: 'text-yellow-400',
        scoreLabel: 'Confidence Score'
      };
    } else {
      return {
        verdict: 'LIKELY AI-GENERATED',
        subtitle: 'This media may be FAKE or digitally manipulated',
        icon: XCircle,
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500',
        textColor: 'text-red-400',
        iconColor: 'text-red-400',
        scoreLabel: 'Authenticity Score'
      };
    }
  };

  const verdictDisplay = getVerdictDisplay();

  const chartData = result?.spectral_data?.map((value, index) => ({
    index,
    value
  })) || [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="media-forensic-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <Shield className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Media Forensic Validator
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            AI Detection System - Identify if media is REAL or AI-GENERATED
          </p>
          
          <div className="mt-4 p-4 bg-alert/10 border border-alert/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-alert mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="text-alert font-semibold mb-1">Important Disclaimer</p>
              <p className="text-alert/80 text-sm">
                This tool provides preliminary AI-based indicators and does not replace certified forensic examination. 
                Results must be verified by authorized forensic labs for legal proceedings.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4" data-testid="upload-section-title">
              Upload Media File
            </h2>

            <div
              {...getRootProps()}
              data-testid="media-dropzone"
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
                    file.type.startsWith('video/') ? (
                      <Video className="text-accent" size={32} />
                    ) : (
                      <Music className="text-accent" size={32} />
                    )
                  ) : (
                    <Upload className="text-accent" size={32} />
                  )}
                </div>
                {file ? (
                  <div>
                    <p className="text-white font-semibold mb-1" data-testid="uploaded-media-filename">
                      {file.name}
                    </p>
                    <p className="text-white/60 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-white font-semibold mb-1">
                      {isDragActive ? 'Drop media file here' : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-white/60 text-sm">
                      Video: MP4, MOV, AVI | Audio: WAV, MP3, M4A
                    </p>
                    <p className="text-white/40 text-xs mt-1">Maximum file size: 50MB</p>
                  </div>
                )}
              </div>
            </div>

            <Button
              data-testid="analyze-media-button"
              onClick={handleAnalyze}
              disabled={!file || processing}
              className="w-full mt-6 bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider py-6"
            >
              {processing ? 'Analyzing...' : 'Analyze Media'}
            </Button>

            <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg">
              <p className="text-white/60 text-xs flex items-start gap-2">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  <strong>How it works:</strong> The system analyzes metadata, file structure, compression patterns, 
                  and spectral characteristics to determine if media is authentic or potentially AI-generated.
                </span>
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4" data-testid="results-section-title">
              Analysis Results
            </h2>

            {!result ? (
              <div className="flex items-center justify-center h-96 text-white/40">
                <div className="text-center">
                  <Shield size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Upload and analyze media to see results</p>
                  <p className="text-sm mt-2">We'll tell you if it's REAL or AI-GENERATED</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6" data-testid="forensic-results">
                {/* Main Verdict Box */}
                <div className={`p-6 rounded-xl border-2 ${verdictDisplay.bgColor} ${verdictDisplay.borderColor}`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-16 h-16 rounded-full ${verdictDisplay.bgColor} border-2 ${verdictDisplay.borderColor} flex items-center justify-center`}>
                      <verdictDisplay.icon size={32} className={verdictDisplay.iconColor} />
                    </div>
                    <div>
                      <h3 className={`text-2xl font-bold ${verdictDisplay.textColor}`} data-testid="verdict-text">
                        {verdictDisplay.verdict}
                      </h3>
                      <p className="text-white/70 text-sm">{verdictDisplay.subtitle}</p>
                    </div>
                  </div>
                  
                  {/* Score Display */}
                  <div className="flex items-center justify-between bg-black/30 rounded-lg p-4">
                    <span className="text-white/80">{verdictDisplay.scoreLabel}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-3 bg-black/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${result.probability_score >= 75 ? 'bg-green-500' : result.probability_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${result.probability_score}%` }}
                        />
                      </div>
                      <span className={`text-2xl font-bold ${verdictDisplay.textColor}`}>
                        {result.probability_score}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Interpretation Guide */}
                <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Info size={16} className="text-accent" />
                    Understanding Your Result
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-2 bg-green-500/10 border border-green-500/30 rounded">
                      <div className="flex items-center gap-1 mb-1">
                        <CheckCircle size={12} className="text-green-400" />
                        <span className="text-green-400 font-semibold">75-100%</span>
                      </div>
                      <p className="text-white/60">REAL - Likely authentic media</p>
                    </div>
                    <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                      <div className="flex items-center gap-1 mb-1">
                        <HelpCircle size={12} className="text-yellow-400" />
                        <span className="text-yellow-400 font-semibold">50-74%</span>
                      </div>
                      <p className="text-white/60">UNCLEAR - Needs verification</p>
                    </div>
                    <div className="p-2 bg-red-500/10 border border-red-500/30 rounded">
                      <div className="flex items-center gap-1 mb-1">
                        <XCircle size={12} className="text-red-400" />
                        <span className="text-red-400 font-semibold">0-49%</span>
                      </div>
                      <p className="text-white/60">FAKE - Likely AI-generated</p>
                    </div>
                  </div>
                </div>

                {/* Spectral Analysis Chart */}
                <div>
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp size={18} className="text-accent" />
                    Spectral Analysis
                  </h3>
                  <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="index" stroke="rgba(255,255,255,0.5)" />
                        <YAxis stroke="rgba(255,255,255,0.5)" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0A0A1B',
                            border: '1px solid rgba(0,242,255,0.3)',
                            borderRadius: '8px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={result.probability_score >= 75 ? '#22c55e' : result.probability_score >= 50 ? '#eab308' : '#ef4444'}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Analysis Summary */}
                <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-2">Analysis Summary</h3>
                  <p className="text-white/80 text-sm" data-testid="analysis-summary">
                    {result.analysis_summary}
                  </p>
                  {result.message && (
                    <p className={`text-sm mt-3 font-semibold ${verdictDisplay.textColor}`}>
                      {result.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {reports.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h3 className="text-xl font-heading font-bold text-white mb-4">Recent Analyses</h3>
            <div className="space-y-3">
              {reports.slice(0, 5).map((report) => {
                const isAuthentic = report.probability_score >= 75;
                const isInconclusive = report.probability_score >= 50 && report.probability_score < 75;
                
                return (
                  <div
                    key={report.id}
                    className="bg-black/20 border border-white/10 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded border flex items-center justify-center ${
                        isAuthentic ? 'bg-green-500/20 border-green-500' :
                        isInconclusive ? 'bg-yellow-500/20 border-yellow-500' :
                        'bg-red-500/20 border-red-500'
                      }`}>
                        {report.media_type === 'video' ? (
                          <Video className={isAuthentic ? 'text-green-400' : isInconclusive ? 'text-yellow-400' : 'text-red-400'} size={20} />
                        ) : (
                          <Music className={isAuthentic ? 'text-green-400' : isInconclusive ? 'text-yellow-400' : 'text-red-400'} size={20} />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-semibold truncate max-w-xs">{report.file_name}</p>
                        <p className="text-white/40 text-xs">
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isAuthentic ? 'text-green-400' : isInconclusive ? 'text-yellow-400' : 'text-red-400'}`}>
                        {isAuthentic ? 'REAL' : isInconclusive ? 'UNCLEAR' : 'FAKE'}
                      </p>
                      <p className="text-white/60 text-xs">{report.probability_score}% confidence</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default MediaForensic;
