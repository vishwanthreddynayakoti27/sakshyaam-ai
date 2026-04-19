import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  FileCheck,
  Users, 
  Scale, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  X,
  Download,
  Printer,
  Sparkles,
  FileStack,
  FolderOpen,
  Trash2,
  FileSpreadsheet,
  BookOpen,
  Gavel,
  RefreshCw
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import api from '../utils/api';

/**
 * Skeleton loader shown while the Triple Fusion job is running.
 * Combines a stage-aware progress bar with a document-shaped skeleton layout
 * so users get visual confidence that their document is being built.
 */
const FusionSkeleton = ({ activeTab = 'chargesheet', progress = 0, stage = '' }) => {
  const titleMap = {
    chargesheet: 'Charge Sheet',
    casediary: 'Case Diary Part-I',
    remand: 'Remand Case Diary'
  };
  const stageMap = {
    queued: 'Queued — waiting for worker',
    extracting_text: 'Extracting text from uploaded files',
    parsing_entities: 'Parsing accused, witnesses & complainant',
    generating_documents: 'Generating HTML document',
    persisting_result: 'Saving result to database',
    done: 'Done'
  };
  const baseStage = (stage || '').split(' ')[0];
  const humanStage = stageMap[baseStage] || stage || 'Starting...';

  return (
    <div className="text-gray-800 animate-in fade-in duration-300" data-testid="fusion-skeleton">
      {/* Progress banner */}
      <div className="mb-6 rounded-md bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin text-sky-600" size={18} />
            <span className="font-semibold text-sky-900">
              Generating {titleMap[activeTab] || 'Document'}
            </span>
          </div>
          <span className="text-sm font-mono text-sky-800" data-testid="skeleton-progress-percent">
            {progress}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-sky-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
            data-testid="skeleton-progress-bar"
          />
        </div>
        <p className="text-xs text-sky-700 mt-2" data-testid="skeleton-stage-text">
          {humanStage}
        </p>
      </div>

      {/* Document-shaped skeleton */}
      <div className="space-y-4">
        {/* Title */}
        <div className="h-8 bg-gray-200 rounded animate-pulse w-2/3 mx-auto" />
        <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3 mx-auto" />

        {/* Meta block */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          <div className="h-3 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 bg-gray-100 rounded animate-pulse" />
        </div>

        {/* Table skeleton */}
        <div className="pt-4 border-t border-gray-200">
          <div className="h-6 bg-gray-200 rounded animate-pulse w-40 mb-3" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="grid grid-cols-5 gap-2 py-2 border-b border-gray-100"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-3 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 bg-gray-100 rounded animate-pulse col-span-2" />
              <div className="h-3 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Paragraph skeleton */}
        <div className="pt-4 space-y-2">
          <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-11/12" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-10/12" />
        </div>
      </div>
    </div>
  );
};

const FusionEmptyState = ({ icon: Icon, title, subtitle }) => (
  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20" data-testid="fusion-empty-state">
    <Icon size={64} className="mb-4 opacity-30" />
    <p className="text-lg font-semibold">{title}</p>
    <p className="text-sm">{subtitle}</p>
  </div>
);

const ChargeSheetFusion = () => {
  // === TRIPLE TAB STATE ===
  const [activeTab, setActiveTab] = useState('chargesheet'); // 'chargesheet' | 'casediary' | 'remand'
  
  // === STAGING STATE ===
  const [caseId, setCaseId] = useState(null);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // === CASE INFO ===
  const [policeStation, setPoliceStation] = useState('Makthal');
  const [district, setDistrict] = useState('Narayanpet');
  const [firNumber, setFirNumber] = useState('');
  const [sections, setSections] = useState('');
  
  // === GENERATED DOCUMENTS ===
  const [chargeSheetHtml, setChargeSheetHtml] = useState('');
  const [caseDiaryHtml, setCaseDiaryHtml] = useState('');
  const [remandHtml, setRemandHtml] = useState('');
  const [downloadLinks, setDownloadLinks] = useState({});
  const [extractedData, setExtractedData] = useState(null);
  const [creditsUsed, setCreditsUsed] = useState(0);

  // === JOB POLLING STATE ===
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStage, setJobStage] = useState('');
  
  const fileInputRef = useRef(null);

  // === TABS CONFIGURATION ===
  const tabs = [
    { id: 'chargesheet', label: 'Charge Sheet', icon: FileSpreadsheet, color: '#00C2FF' },
    { id: 'casediary', label: 'Case Diary 1', icon: BookOpen, color: '#4F7EFF' },
    { id: 'remand', label: 'Remand Case Diary', icon: Gavel, color: '#FFB800' }
  ];

  // === CREATE STAGING CASE ===
  const createStagingCase = async () => {
    if (!firNumber.trim()) {
      toast.error('Please enter FIR number first');
      return null;
    }
    
    try {
      const formData = new FormData();
      formData.append('police_station', policeStation);
      formData.append('district', district);
      formData.append('fir_number', firNumber);
      formData.append('sections', sections);
      
      const response = await api.post('/staging/create-case', formData);
      
      if (response.data.success) {
        setCaseId(response.data.case_id);
        toast.success(`Case folder created: ${response.data.case_id}`);
        toast.info('Credits used: 0 (Staging is FREE)');
        return response.data.case_id;
      }
    } catch (error) {
      toast.error('Failed to create case folder');
      console.error(error);
    }
    return null;
  };

  // === BATCH FILE UPLOAD (NO LIMIT) ===
  const handleBatchUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    let currentCaseId = caseId;
    if (!currentCaseId) {
      currentCaseId = await createStagingCase();
      if (!currentCaseId) return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });
      
      const response = await api.post(`/staging/upload-files/${currentCaseId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        setStagedFiles(prev => [...prev, ...response.data.saved_files]);
        toast.success(`${response.data.files_saved} files staged successfully!`);
        toast.info(`Credits used: 0 (Upload is FREE)`);
        toast.info(`Total files in case: ${response.data.total_files_in_case}`);
      }
    } catch (error) {
      toast.error('Upload failed');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  // === REMOVE STAGED FILE ===
  const removeStagedFile = async (filename) => {
    if (!caseId) return;
    
    try {
      await api.delete(`/staging/case/${caseId}/file/${filename}`);
      setStagedFiles(prev => prev.filter(f => f.saved_name !== filename));
      toast.success('File removed');
    } catch (error) {
      toast.error('Failed to remove file');
    }
  };

  // === GENERATE TRIPLE FUSION ===
  const applyFusionResult = (data) => {
    setChargeSheetHtml(data.documents?.charge_sheet || '');
    setCaseDiaryHtml(data.documents?.case_diary || '');
    setRemandHtml(data.documents?.remand_cd || '');

    setDownloadLinks({
      chargesheet: `/api/download/docx/${firNumber.replace('/', '-')}_ChargeSheet.docx`,
      casediary: `/api/download/docx/${firNumber.replace('/', '-')}_CaseDiary.docx`,
      remand: `/api/download/docx/${firNumber.replace('/', '-')}_RemandCD.docx`
    });

    setExtractedData(data.extracted_data);
    setCreditsUsed(data.credits_used || 0);
  };

  const pollJobStatus = async () => {
    const MAX_POLLS = 120; // 120 * 2s = 4 minutes max
    let attempts = 0;

    while (attempts < MAX_POLLS) {
      attempts += 1;
      await new Promise((r) => setTimeout(r, 2000));

      let statusResp;
      try {
        statusResp = await api.get(`/staging/job-status/${caseId}`);
      } catch (err) {
        toast.error('Polling failed: ' + (err.response?.data?.detail || err.message));
        return false;
      }

      const d = statusResp.data || {};
      setJobProgress(d.progress || 0);
      setJobStage(d.stage || '');

      if (d.status === 'completed') {
        applyFusionResult(d);
        toast.success('Triple Fusion COMPLETE!');
        if (d.credits_used) toast.success(`Credits used: ${d.credits_used}`);
        return true;
      }
      if (d.status === 'failed') {
        toast.error(d.error || d.message || 'Fusion failed');
        toast.success('No credits deducted', { duration: 3000 });
        return false;
      }
    }

    toast.error('Fusion still running — please refresh the page in a minute.');
    return false;
  };

  const generateTripleFusion = async () => {
    if (!caseId) {
      toast.error('No case folder created');
      return;
    }

    if (stagedFiles.length === 0) {
      toast.error('No files staged for fusion');
      return;
    }

    setIsGenerating(true);
    setCreditsUsed(0);
    setJobProgress(0);
    setJobStage('queued');

    try {
      toast.info('Queuing Triple Fusion job...');

      const response = await api.post(`/staging/generate-triple-fusion/${caseId}`);
      const d = response.data || {};

      // Fast path: server returned cached completed result synchronously
      if (d.status === 'completed') {
        applyFusionResult(d);
        toast.success(d.message || 'Triple Fusion retrieved from cache');
        return;
      }

      // Async path: poll job status until done
      if (d.status === 'processing') {
        setJobProgress(d.progress || 0);
        setJobStage(d.stage || 'queued');
        toast.info(`Processing ${d.file_count || stagedFiles.length} files in background...`);
        await pollJobStatus();
        return;
      }

      toast.error('Unexpected response from server');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Fusion failed';
      toast.error(errorMsg);
      toast.success('No credits deducted', { duration: 3000 });
      console.error(error);
    } finally {
      setIsGenerating(false);
      setJobProgress(0);
      setJobStage('');
    }
  };

  // === DOWNLOAD WORD DOCUMENT ===
  const downloadDocument = async (docType) => {
    const filename = `${firNumber.replace('/', '-')}_${docType === 'chargesheet' ? 'ChargeSheet' : docType === 'casediary' ? 'CaseDiary' : 'RemandCD'}.docx`;
    
    try {
      const response = await api.get(`/download/docx/${filename}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Downloaded: ${filename}`);
    } catch (error) {
      toast.error('Download failed - Document not generated yet');
    }
  };

  // === FILE DROP HANDLER ===
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    handleBatchUpload(files);
  }, [caseId, firNumber]);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // === PRINT DOCUMENT ===
  const printDocument = (htmlContent, title) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: 'Times New Roman', serif; font-size: 12pt; }
            table { width: 100%; border-collapse: collapse; }
            td, th { border: 1px solid black; padding: 8px; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="chargesheet-fusion">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#00C2FF] to-[#4F7EFF]">
              <FileStack className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Triple Fusion Generator</h1>
              <p className="text-white/60 text-sm">Charge Sheet + Case Diary + Remand CD</p>
            </div>
          </div>
          
          {/* Credit Status */}
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 rounded-lg bg-[#0B0F1A] border border-white/10">
              <span className="text-white/50 text-sm">Credits Used: </span>
              <span className="text-[#00FFB3] font-bold">{creditsUsed}</span>
            </div>
            {stagedFiles.length > 0 && (
              <div className="px-4 py-2 rounded-lg bg-[#00FFB3]/10 border border-[#00FFB3]/30">
                <span className="text-[#00FFB3] font-bold">{stagedFiles.length} files staged</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* === TRIPLE TAB HEADER === */}
        <div className="flex gap-2 p-1 bg-[#0B0F1A] rounded-xl border border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#00C2FF]/20 to-[#4F7EFF]/20 border border-[#00C2FF]/30'
                  : 'hover:bg-white/5'
              }`}
              style={{ 
                borderColor: activeTab === tab.id ? tab.color : 'transparent',
                color: activeTab === tab.id ? tab.color : 'rgba(255,255,255,0.6)'
              }}
            >
              <tab.icon size={18} />
              <span className="font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* === LEFT: STAGING AREA === */}
          <div className="col-span-1 space-y-4">
            {/* Case Info */}
            <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Scale size={18} className="text-[#FFB800]" />
                Case Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-white/50 text-xs">FIR Number *</label>
                  <Input
                    value={firNumber}
                    onChange={(e) => setFirNumber(e.target.value)}
                    placeholder="e.g., 57/2026"
                    className="bg-[#030614] border-white/20 text-white"
                    data-testid="fir-number-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/50 text-xs">Police Station</label>
                    <Input
                      value={policeStation}
                      onChange={(e) => setPoliceStation(e.target.value)}
                      placeholder="Makthal"
                      className="bg-[#030614] border-white/20 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs">District</label>
                    <Input
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Narayanpet"
                      className="bg-[#030614] border-white/20 text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs">Sections</label>
                  <Input
                    value={sections}
                    onChange={(e) => setSections(e.target.value)}
                    placeholder="e.g., 118(2), 115(2), 352 BNS"
                    className="bg-[#030614] border-white/20 text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* File Upload Zone - UNLIMITED */}
            <div 
              className="p-4 rounded-xl bg-[#0B0F1A] border-2 border-dashed border-[#00C2FF]/30 hover:border-[#00C2FF]/50 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              data-testid="file-drop-zone"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => handleBatchUpload(e.target.files)}
              />
              <div className="text-center py-6">
                {isUploading ? (
                  <Loader2 className="animate-spin text-[#00C2FF] mx-auto mb-2" size={32} />
                ) : (
                  <Upload className="text-[#00C2FF] mx-auto mb-2" size={32} />
                )}
                <p className="text-white font-semibold">Drop Files or Click to Upload</p>
                <p className="text-white/40 text-xs mt-1">PDF, DOCX, DOC, JPG, PNG</p>
                <p className="text-[#00FFB3] text-xs mt-2 font-semibold">NO LIMIT - Upload 1-30+ files</p>
                <p className="text-[#FFB800] text-xs mt-1">0 Credits for uploading</p>
              </div>
            </div>

            {/* Staged Files List */}
            {stagedFiles.length > 0 && (
              <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10 max-h-60 overflow-y-auto">
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <FolderOpen size={16} className="text-[#00FFB3]" />
                  Staged Files ({stagedFiles.length})
                </h4>
                <div className="space-y-2">
                  {stagedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#030614]">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText size={14} className="text-[#00C2FF] flex-shrink-0" />
                        <span className="text-white/80 text-xs truncate">{file.original_name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeStagedFile(file.saved_name);
                        }}
                        className="text-[#FF3B3B]/60 hover:text-[#FF3B3B] ml-2"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={generateTripleFusion}
              disabled={isGenerating || stagedFiles.length === 0}
              data-testid="generate-fusion-btn"
              className="w-full h-14 bg-gradient-to-r from-[#00C2FF] to-[#4F7EFF] hover:opacity-90 text-white font-bold text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Generating Triple Fusion...
                </>
              ) : (
                <>
                  <Sparkles size={20} className="mr-2" />
                  Generate Triple Fusion
                </>
              )}
            </Button>

            {/* Async Progress Indicator */}
            {isGenerating && (
              <div className="space-y-2" data-testid="fusion-progress">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00C2FF] to-[#4F7EFF] transition-all duration-500"
                    style={{ width: `${jobProgress}%` }}
                    data-testid="fusion-progress-bar"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span data-testid="fusion-progress-stage">{jobStage || 'queued'}</span>
                  <span data-testid="fusion-progress-percent">{jobProgress}%</span>
                </div>
              </div>
            )}

            <p className="text-center text-white/40 text-xs">
              Credits deducted ONLY on successful generation
            </p>
          </div>

          {/* === RIGHT: DOCUMENT PREVIEW === */}
          <div className="col-span-2">
            <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10 min-h-[600px]">
              {/* Document Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  {activeTab === 'chargesheet' && <><FileSpreadsheet className="text-[#00C2FF]" size={18} /> Charge Sheet Preview</>}
                  {activeTab === 'casediary' && <><BookOpen className="text-[#4F7EFF]" size={18} /> Case Diary Part-I Preview</>}
                  {activeTab === 'remand' && <><Gavel className="text-[#FFB800]" size={18} /> Remand Case Diary Preview</>}
                </h3>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => downloadDocument(activeTab)}
                    disabled={!chargeSheetHtml && !caseDiaryHtml && !remandHtml}
                    size="sm"
                    className="bg-[#00FFB3]/20 text-[#00FFB3] hover:bg-[#00FFB3]/30"
                    data-testid={`download-${activeTab}`}
                  >
                    <Download size={14} className="mr-1" />
                    Download .DOCX
                  </Button>
                  <Button
                    onClick={() => printDocument(
                      activeTab === 'chargesheet' ? chargeSheetHtml : 
                      activeTab === 'casediary' ? caseDiaryHtml : remandHtml,
                      activeTab.toUpperCase()
                    )}
                    disabled={!chargeSheetHtml && !caseDiaryHtml && !remandHtml}
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    <Printer size={14} className="mr-1" />
                    Print
                  </Button>
                </div>
              </div>

              {/* Document Content */}
              <div className="bg-white rounded-lg p-4 min-h-[500px] overflow-auto">
                {isGenerating ? (
                  <FusionSkeleton
                    activeTab={activeTab}
                    progress={jobProgress}
                    stage={jobStage}
                  />
                ) : (
                  <>
                    {activeTab === 'chargesheet' && (
                      chargeSheetHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: chargeSheetHtml }} />
                      ) : (
                        <FusionEmptyState icon={FileSpreadsheet} title="Charge Sheet" subtitle='Upload files and click "Generate Triple Fusion"' />
                      )
                    )}

                    {activeTab === 'casediary' && (
                      caseDiaryHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: caseDiaryHtml }} />
                      ) : (
                        <FusionEmptyState icon={BookOpen} title="Case Diary Part-I" subtitle="Generated from FIR and Case Diary files" />
                      )
                    )}

                    {activeTab === 'remand' && (
                      remandHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: remandHtml }} />
                      ) : (
                        <FusionEmptyState icon={Gavel} title="Remand Case Diary" subtitle="Grounds for Arrest & Section 35(3) Notice" />
                      )
                    )}
                  </>
                )}
              </div>

              {/* Extracted Data Summary */}
              {extractedData && (
                <div className="mt-4 p-3 rounded-lg bg-[#030614] border border-[#00FFB3]/30">
                  <h4 className="text-[#00FFB3] font-semibold text-sm mb-2">Extraction Summary</h4>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-white/50">Accused:</span>
                      <span className="text-white ml-2">{extractedData.accused_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-white/50">Witnesses:</span>
                      <span className="text-white ml-2">{extractedData.witness_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-white/50">Complainant:</span>
                      <span className="text-white ml-2">{extractedData.complainant?.name || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Download All Documents */}
        {(chargeSheetHtml || caseDiaryHtml || remandHtml) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-gradient-to-r from-[#00C2FF]/10 to-[#4F7EFF]/10 border border-[#00C2FF]/30"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">Triple Fusion Complete!</h3>
                <p className="text-white/60 text-sm">Download all three documents as Word files</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => downloadDocument('chargesheet')}
                  className="bg-[#00C2FF] text-black hover:bg-[#00C2FF]/80"
                  data-testid="download-all-chargesheet"
                >
                  <Download size={16} className="mr-2" />
                  Charge Sheet.docx
                </Button>
                <Button
                  onClick={() => downloadDocument('casediary')}
                  className="bg-[#4F7EFF] text-white hover:bg-[#4F7EFF]/80"
                  data-testid="download-all-casediary"
                >
                  <Download size={16} className="mr-2" />
                  Case Diary.docx
                </Button>
                <Button
                  onClick={() => downloadDocument('remand')}
                  className="bg-[#FFB800] text-black hover:bg-[#FFB800]/80"
                  data-testid="download-all-remand"
                >
                  <Download size={16} className="mr-2" />
                  Remand CD.docx
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default ChargeSheetFusion;
