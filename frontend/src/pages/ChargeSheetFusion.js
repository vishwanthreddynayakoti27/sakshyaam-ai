import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  Scale,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Sparkles,
  FileStack,
  FolderOpen,
  Trash2,
  BookOpen,
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import api from '../utils/api';

const ChargeSheetFusion = () => {
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
  
  // === FUSION STATUS ===
  // We no longer render the giant HTML preview (caused mobile "Script error" via
  // dangerouslySetInnerHTML). Just keep completion flags + summary.
  const [fusionReady, setFusionReady] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [documentsCount, setDocumentsCount] = useState(0);

  // === JOB POLLING STATE ===
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStage, setJobStage] = useState('');
  
  const fileInputRef = useRef(null);

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
    setFusionReady(true);
    setExtractedData(data.extracted_data || null);
    setCreditsUsed(data.credits_used || 0);
    setDocumentsCount(data.documents_processed || 0);
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
    setFusionReady(false);
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
    const filename = `${firNumber.replaceAll('/', '-')}_${docType === 'chargesheet' ? 'ChargeSheet' : docType === 'casediary' ? 'CaseDiary' : 'RemandCD'}.docx`;
    
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

        {/* === TRIPLE FUSION BODY === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            {/* Async Progress Indicator (mirrored in status card) — hide on mobile to avoid stacking */}
            {isGenerating && (
              <div className="hidden lg:block space-y-2" data-testid="fusion-progress">
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

          {/* === RIGHT: FUSION STATUS CARD === */}
          <div className="col-span-1 lg:col-span-2">
            <div
              className="p-6 rounded-xl bg-[#0B0F1A] border border-white/10 min-h-[600px] flex flex-col items-center justify-center"
              data-testid="fusion-status-card"
            >
              {isGenerating ? (
                <FusionGeneratingView progress={jobProgress} stage={jobStage} fileCount={stagedFiles.length} />
              ) : fusionReady ? (
                <FusionCompletedView
                  firNumber={firNumber}
                  creditsUsed={creditsUsed}
                  documentsCount={documentsCount}
                  extractedData={extractedData}
                  onDownload={downloadDocument}
                  caseId={caseId}
                />
              ) : (
                <FusionIdleView filesReady={stagedFiles.length > 0} firReady={!!firNumber.trim()} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// ============================================================================
// Status-Card Subviews (no HTML preview — avoids dangerouslySetInnerHTML errors)
// ============================================================================

const FusionIdleView = ({ filesReady, firReady }) => (
  <div className="text-center max-w-md" data-testid="fusion-idle-view">
    <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-[#00C2FF]/20 to-[#4F7EFF]/20 border border-[#00C2FF]/30 flex items-center justify-center mb-5">
      <FileStack className="text-[#00C2FF]" size={36} />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">Ready to Generate</h3>
    <p className="text-white/60 text-sm leading-relaxed mb-6">
      Upload your case files, fill in the FIR details, and click <strong className="text-[#00C2FF]">Generate Triple Fusion</strong> to produce all three documents at once.
    </p>
    <div className="space-y-2 text-left inline-block">
      <div className={`flex items-center gap-2 text-sm ${firReady ? 'text-[#00FFB3]' : 'text-white/40'}`}>
        {firReady ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        FIR number entered
      </div>
      <div className={`flex items-center gap-2 text-sm ${filesReady ? 'text-[#00FFB3]' : 'text-white/40'}`}>
        {filesReady ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        At least one file uploaded
      </div>
    </div>
  </div>
);

const FusionGeneratingView = ({ progress = 0, stage = '', fileCount = 0 }) => {
  const stageMap = {
    queued: 'Queued — waiting for worker',
    extracting_text: 'Extracting text from uploaded files',
    parsing_entities: 'Parsing accused, witnesses & complainant',
    generating_documents: 'Generating documents',
    persisting_result: 'Saving result to database',
    done: 'Done',
  };
  const baseStage = (stage || '').split(' ')[0];
  const humanStage = stageMap[baseStage] || stage || 'Starting...';

  return (
    <div className="text-center w-full max-w-md" data-testid="fusion-generating-view">
      {/* Animated rings */}
      <div className="relative mx-auto w-32 h-32 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-[#00C2FF]/20 animate-pulse" />
        <div className="absolute inset-2 rounded-full border-4 border-[#00C2FF]/40 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin text-[#00C2FF]" size={44} />
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-2">Generating Triple Fusion</h3>
      <p className="text-white/60 text-sm mb-5" data-testid="generating-stage-text">
        {humanStage}
      </p>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-[#00C2FF] to-[#4F7EFF] transition-all duration-500"
          style={{ width: `${progress}%` }}
          data-testid="generating-progress-bar"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>{fileCount} file{fileCount === 1 ? '' : 's'} in batch</span>
        <span className="font-mono" data-testid="generating-progress-percent">{progress}%</span>
      </div>

      <p className="mt-6 text-white/40 text-xs">
        Please stay on this page. Credits will be deducted only after successful generation.
      </p>
    </div>
  );
};

const FusionCompletedView = ({ firNumber, creditsUsed, documentsCount, extractedData, onDownload, caseId }) => {
  const [smartLoading, setSmartLoading] = React.useState(false);
  const [diaryLoading, setDiaryLoading] = React.useState(false);
  const [corrections, setCorrections] = React.useState(null);
  const [hasChargeSheet, setHasChargeSheet] = React.useState(false);

  const downloadSmartChargeSheet = async () => {
    if (!caseId) {
      toast.error('No case selected');
      return;
    }
    setSmartLoading(true);
    setCorrections(null);
    try {
      toast.info('Running station-writer AI (Claude 4.5)... ~20 seconds');
      const resp = await api.post(
        `/staging/generate-intelligent-charge-sheet/${caseId}`,
        null,
        { responseType: 'blob' }
      );
      // Pull corrections count from response headers
      const correctionsCount = resp.headers['x-corrections-count'] || resp.headers['X-Corrections-Count'];
      // Trigger DOCX download
      const blob = new Blob([resp.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(firNumber || 'case').replaceAll('/', '-')}_IntelligentChargeSheet.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      // Fetch the corrections list separately
      try {
        const meta = await api.get(`/staging/intelligent-chargesheet/${caseId}`);
        if (meta.data?.corrections_applied?.length) {
          setCorrections(meta.data.corrections_applied);
        }
      } catch (e) { /* non-critical */ }

      setHasChargeSheet(true);
      toast.success(`Station-format charge sheet downloaded (${correctionsCount || 0} corrections applied)`);
    } catch (error) {
      let msg = error.response?.data?.detail || 'Intelligent generation failed';
      if (error.response?.data instanceof Blob) {
        try {
          msg = JSON.parse(await error.response.data.text()).detail || msg;
        } catch (e) { /* ignore */ }
      }
      toast.error(msg);
    } finally {
      setSmartLoading(false);
    }
  };

  const downloadSmartCaseDiary = async () => {
    if (!caseId) {
      toast.error('No case selected');
      return;
    }
    if (!hasChargeSheet) {
      toast.error('Generate the Station-Format Charge Sheet first (it provides the structured data)');
      return;
    }
    setDiaryLoading(true);
    try {
      toast.info('Generating Case Diary Part-I with Claude 4.5...');
      const resp = await api.post(
        `/staging/generate-intelligent-case-diary/${caseId}`,
        null,
        { responseType: 'blob' }
      );
      const entries = resp.headers['x-entries-count'] || resp.headers['X-Entries-Count'];
      const blob = new Blob([resp.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(firNumber || 'case').replaceAll('/', '-')}_IntelligentCaseDiary.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Case Diary Part-I downloaded (${entries || 0} chronological entries)`);
    } catch (error) {
      let msg = error.response?.data?.detail || 'Case diary generation failed';
      if (error.response?.data instanceof Blob) {
        try { msg = JSON.parse(await error.response.data.text()).detail || msg; } catch (e) { /* ignore */ }
      }
      toast.error(msg);
    } finally {
      setDiaryLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg" data-testid="fusion-completed-view">
      <div className="text-center mb-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-[#00FFB3]/20 border-2 border-[#00FFB3]/40 flex items-center justify-center mb-4">
          <CheckCircle2 className="text-[#00FFB3]" size={44} />
        </div>
        <h3 className="text-2xl font-bold text-white mb-1">Triple Fusion Complete</h3>
        <p className="text-white/60 text-sm">
          FIR {firNumber} · {documentsCount} file{documentsCount === 1 ? '' : 's'} processed · {creditsUsed} credits used
        </p>
      </div>

      {/* Extraction summary */}
      {extractedData && (
        <div className="mb-6 p-4 rounded-lg bg-[#030614] border border-[#00FFB3]/20">
          <h4 className="text-[#00FFB3] font-semibold text-sm mb-3">Extraction Summary</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-white/50 text-xs">Accused</p>
              <p className="text-white font-bold text-lg">
                {(extractedData.accused_persons?.length) ?? (extractedData.accused_count ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-xs">Witnesses</p>
              <p className="text-white font-bold text-lg">
                {(extractedData.witnesses?.length) ?? (extractedData.witness_count ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-xs">Complainant</p>
              <p className="text-white font-medium text-sm truncate">
                {extractedData.complainant?.name || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STATION-WRITER INTELLIGENT CHARGE SHEET */}
      <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-[#FFB800]/10 to-[#FF8800]/5 border border-[#FFB800]/30">
        <div className="flex items-start gap-3 mb-3">
          <Sparkles className="text-[#FFB800] shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="text-[#FFB800] font-bold text-base">Station-Writer Intelligent Charge Sheet</h4>
            <p className="text-white/60 text-xs mt-1 leading-relaxed">
              Auto-corrects misclassifications (complainant/accused), fixes typos in BNS sections, composes a proper flowing narrative, matches the real Makthal station format. Missing fields print as blanks for manual entry. Uses Claude Sonnet 4.5 · 3 credits.
            </p>
          </div>
        </div>
        <Button
          onClick={downloadSmartChargeSheet}
          disabled={smartLoading}
          className="w-full h-11 bg-gradient-to-r from-[#FFB800] to-[#FF8800] text-black font-bold hover:opacity-90"
          data-testid="download-intelligent-chargesheet"
        >
          {smartLoading ? (
            <><Loader2 className="animate-spin mr-2" size={16} /> Running AI (~20s)...</>
          ) : (
            <><Sparkles size={16} className="mr-2" /> Generate Station-Format Charge Sheet</>
          )}
        </Button>
        {corrections && corrections.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#FFB800]/20" data-testid="corrections-list">
            <p className="text-[#FFB800] text-xs font-semibold mb-2">
              {corrections.length} correction{corrections.length === 1 ? '' : 's'} applied:
            </p>
            <ul className="space-y-1">
              {corrections.map((c, i) => (
                <li key={i} className="text-white/70 text-xs pl-3 border-l-2 border-[#FFB800]/40">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* STATION-FORMAT CASE DIARY PART-I */}
      <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-[#4F7EFF]/10 to-[#00C2FF]/5 border border-[#4F7EFF]/30">
        <div className="flex items-start gap-3 mb-3">
          <BookOpen className="text-[#4F7EFF] shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="text-[#4F7EFF] font-bold text-base">Station-Format Case Diary (Part-I)</h4>
            <p className="text-white/60 text-xs mt-1 leading-relaxed">
              Chronological IO investigation log composed from the corrected charge-sheet data. Each entry includes date, time, and proper station-writer phrasing (scene visit, S.180 statements, medical, 35(3) notice, accused appearance). Uses Claude Sonnet 4.5 · 2 credits.
            </p>
          </div>
        </div>
        <Button
          onClick={downloadSmartCaseDiary}
          disabled={diaryLoading || !hasChargeSheet}
          className="w-full h-11 bg-gradient-to-r from-[#4F7EFF] to-[#00C2FF] text-white font-bold hover:opacity-90 disabled:opacity-40"
          data-testid="download-intelligent-case-diary"
          title={!hasChargeSheet ? 'Generate Station-Format Charge Sheet first' : 'Generate & download Case Diary Part-I'}
        >
          {diaryLoading ? (
            <><Loader2 className="animate-spin mr-2" size={16} /> Composing entries (~20s)...</>
          ) : (
            <><BookOpen size={16} className="mr-2" /> Generate Case Diary Part-I</>
          )}
        </Button>
        {!hasChargeSheet && (
          <p className="mt-2 text-xs text-white/40 italic">Generate the charge sheet above first.</p>
        )}
      </div>

      {/* Original (pipeline) download buttons */}
      <div className="space-y-3">
        <p className="text-white/40 text-xs uppercase tracking-wider">Or download pipeline-generated HTML versions:</p>
        <Button
          onClick={() => onDownload('chargesheet')}
          variant="outline"
          className="w-full h-11 border-[#00C2FF]/40 text-[#00C2FF] hover:bg-[#00C2FF]/10 font-medium"
          data-testid="download-chargesheet"
        >
          <Download size={16} className="mr-2" />
          Charge Sheet (pipeline)
        </Button>
        <Button
          onClick={() => onDownload('casediary')}
          variant="outline"
          className="w-full h-11 border-[#4F7EFF]/40 text-[#4F7EFF] hover:bg-[#4F7EFF]/10 font-medium"
          data-testid="download-casediary"
        >
          <Download size={16} className="mr-2" />
          Case Diary Part-I
        </Button>
        <Button
          onClick={() => onDownload('remand')}
          variant="outline"
          className="w-full h-11 border-white/20 text-white/70 hover:bg-white/5 font-medium"
          data-testid="download-remand"
        >
          <Download size={16} className="mr-2" />
          Remand Case Diary
        </Button>
      </div>
    </div>
  );
};

export default ChargeSheetFusion;
