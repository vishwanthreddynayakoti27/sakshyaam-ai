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
  Lock,
  RefreshCw,
  Edit3,
  X,
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import api from '../utils/api';

const ChargeSheetFusion = () => {
  // === STAGING STATE ===
  const [caseId, setCaseId] = useState(null);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // === CASE INFO (15-field manual input form — V3.0) ===
  // All 15 fields are filled by the police writer manually. They are NEVER
  // extracted from documents — the LLM is instructed to use them verbatim
  // as "CONFIRMED MANUAL INPUT" with zero alteration.
  const [district, setDistrict] = useState('Narayanpet');                 // Field 01
  const [policeStation, setPoliceStation] = useState('Makthal');          // Field 02
  const [firNumber, setFirNumber] = useState('');                          // Field 03
  const [firDate, setFirDate] = useState('');                              // Field 04 (DD/MM/YYYY)
  const [chargeSheetNo, setChargeSheetNo] = useState('');                  // Field 05
  const [chargesheetDate, setChargesheetDate] = useState('');              // Field 06 (DD/MM/YYYY)
  const [sections, setSections] = useState('');                            // Field 07
  const [reportType, setReportType] = useState('Charge Sheet');            // Field 08
  const [unOccurredReason, setUnOccurredReason] = useState('');            // Field 09 (cond.)
  const [chargesheetType, setChargesheetType] = useState('Original');      // Field 10
  const [ioName, setIoName] = useState('');                                 // Field 11
  const [ioRank, setIoRank] = useState('');                                 // Field 12
  const [courtName, setCourtName] = useState(
    'JUDICIAL FIRST CLASS MAGISTRATE AT MAKTHAL'
  );                                                                        // Field 13
  const [dispatchDate, setDispatchDate] = useState('');                    // Field 14
  const [ackEnclosed, setAckEnclosed] = useState('No');                    // Field 15 (Yes/No)
  const [manualFormSubmitted, setManualFormSubmitted] = useState(false);

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
    // Required-field check (per the 15-field manual input contract)
    const missing = [];
    if (!firNumber.trim())        missing.push('FIR Number');
    if (!firDate.trim())          missing.push('FIR Date');
    if (!chargesheetDate.trim())  missing.push('Date of Chargesheet');
    if (!sections.trim())         missing.push('Act & Sections');
    if (!ioName.trim())           missing.push('IO Name');
    if (missing.length) {
      toast.error(`Please fill: ${missing.join(', ')}`);
      return null;
    }

    try {
      const formData = new FormData();
      // 4 legacy fields (kept for backwards compat)
      formData.append('police_station', policeStation);
      formData.append('district', district);
      formData.append('fir_number', firNumber);
      formData.append('sections', sections);
      // 11 new manual-input fields
      formData.append('fir_date', firDate);
      formData.append('chargesheet_no', chargeSheetNo);
      formData.append('chargesheet_date', chargesheetDate);
      formData.append('report_type', reportType);
      formData.append('un_occurred_reason', unOccurredReason);
      formData.append('chargesheet_type', chargesheetType);
      formData.append('io_name', ioName);
      formData.append('io_rank', ioRank);
      formData.append('court_name', courtName);
      formData.append('dispatch_date', dispatchDate);
      formData.append('ack_enclosed', ackEnclosed);

      const response = await api.post('/staging/create-case', formData);

      if (response.data.success) {
        setCaseId(response.data.case_id);
        setManualFormSubmitted(true);
        toast.success(`Case folder created: ${response.data.case_id}`);
        toast.info('All 15 manual fields locked — now upload documents.');
        return response.data.case_id;
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create case folder');
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
    // Atomic state transition: clear loading + dismiss stale toasts in one frame
    toast.dismiss();                            // wipe stale "Processing X files…" toast
    setIsGenerating(false);
    setJobProgress(100);
    setJobStage('done');
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

  const generateTripleFusion = async (force = false) => {
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
    setJobStage(force ? 'force-purging cache' : 'queued');

    try {
      toast.info(force ? 'Force-regenerating (cache cleared, live OpenAI run)...' : 'Queuing Triple Fusion job...');

      const url = force
        ? `/staging/generate-triple-fusion/${caseId}?force=true`
        : `/staging/generate-triple-fusion/${caseId}`;
      const response = await api.post(url);
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
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00FFB3] animate-pulse" />
                <span className="text-[#00FFB3] text-[10px] font-mono uppercase tracking-wider">
                  OpenAI Direct · gpt-4o · your API key active
                </span>
              </div>
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
            {/* ─── STEP 1: 15-FIELD MANUAL INPUT FORM ─── */}
            <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10" data-testid="manual-input-form">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Scale size={18} className="text-[#FFB800]" />
                  Step 1 — Manual Input (15 fields)
                </h3>
                {manualFormSubmitted && (
                  <span className="text-[#00FFB3] text-[10px] font-mono uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 size={12} /> Locked
                  </span>
                )}
              </div>
              <p className="text-white/40 text-[11px] mb-3 leading-relaxed">
                Fill all 15 fields manually. The AI will copy them verbatim and
                never alter or re-extract them from your documents.
              </p>
              <div className="space-y-2.5">
                {/* 01 District + 02 Police Station */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">01 District *</label>
                    <Input value={district} onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Narayanpet"
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-district" />
                  </div>
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">02 Police Station *</label>
                    <Input value={policeStation} onChange={(e) => setPoliceStation(e.target.value)}
                      placeholder="Makthal"
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-police-station" />
                  </div>
                </div>

                {/* 03 FIR Number + 04 FIR Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">03 FIR No. *</label>
                    <Input value={firNumber} onChange={(e) => setFirNumber(e.target.value)}
                      placeholder="100/2025"
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-fir-number" />
                  </div>
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">04 FIR Date *</label>
                    <Input type="date" value={firDate} onChange={(e) => setFirDate(e.target.value)}
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-fir-date" />
                  </div>
                </div>

                {/* 05 Charge Sheet No + 06 Charge Sheet Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">05 CS No.</label>
                    <Input value={chargeSheetNo} onChange={(e) => setChargeSheetNo(e.target.value)}
                      placeholder="45"
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-cs-number" />
                  </div>
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">06 CS Date *</label>
                    <Input type="date" value={chargesheetDate} onChange={(e) => setChargesheetDate(e.target.value)}
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-cs-date" />
                  </div>
                </div>

                {/* 07 Act & Sections (wide) */}
                <div>
                  <label className="text-white/50 text-[10px] uppercase tracking-wide">07 Act &amp; Sections *</label>
                  <Input value={sections} onChange={(e) => setSections(e.target.value)}
                    placeholder="126(2), 118(1), 352, 351(2) R/w 3(5) BNS"
                    className="bg-[#030614] border-white/20 text-white text-sm h-9"
                    data-testid="manual-sections" />
                </div>

                {/* 08 Report Type dropdown + 10 Original/Supp dropdown */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">08 Report Type</label>
                    <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                      className="w-full bg-[#030614] border border-white/20 text-white text-sm h-9 rounded-md px-2"
                      data-testid="manual-report-type">
                      <option value="Charge Sheet">Charge Sheet</option>
                      <option value="Untraced">Untraced</option>
                      <option value="Un-occurred / False">Un-occurred / False</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">10 Original / Supp.</label>
                    <select value={chargesheetType} onChange={(e) => setChargesheetType(e.target.value)}
                      className="w-full bg-[#030614] border border-white/20 text-white text-sm h-9 rounded-md px-2"
                      data-testid="manual-cs-type">
                      <option value="Original">Original</option>
                      <option value="Supplementary">Supplementary</option>
                    </select>
                  </div>
                </div>

                {/* 09 Un-occurred reason — conditional */}
                {reportType === 'Un-occurred / False' && (
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">09 Un-occurred reason *</label>
                    <Input value={unOccurredReason} onChange={(e) => setUnOccurredReason(e.target.value)}
                      placeholder="False / Mistake of fact / Mistake of law / Non-cognizable / Civil nature"
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-un-occurred-reason" />
                  </div>
                )}

                {/* 11 IO Name + 12 IO Rank/Belt */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">11 IO Name *</label>
                    <Input value={ioName} onChange={(e) => setIoName(e.target.value)}
                      placeholder="K. Lal Singh"
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-io-name" />
                  </div>
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">12 IO Rank / Belt</label>
                    <Input value={ioRank} onChange={(e) => setIoRank(e.target.value)}
                      placeholder="HC 248"
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-io-rank" />
                  </div>
                </div>

                {/* 13 Court Name */}
                <div>
                  <label className="text-white/50 text-[10px] uppercase tracking-wide">13 Court Name</label>
                  <Input value={courtName} onChange={(e) => setCourtName(e.target.value)}
                    placeholder="JUDICIAL FIRST CLASS MAGISTRATE AT MAKTHAL"
                    className="bg-[#030614] border-white/20 text-white text-sm h-9"
                    data-testid="manual-court-name" />
                </div>

                {/* 14 Dispatched On + 15 Ack toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">14 Dispatched on</label>
                    <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)}
                      className="bg-[#030614] border-white/20 text-white text-sm h-9"
                      data-testid="manual-dispatch-date" />
                  </div>
                  <div>
                    <label className="text-white/50 text-[10px] uppercase tracking-wide">15 Ack enclosed?</label>
                    <div className="flex gap-1 mt-0.5">
                      {['Yes', 'No'].map((v) => (
                        <button key={v} type="button" onClick={() => setAckEnclosed(v)}
                          className={`flex-1 h-9 rounded-md border text-sm font-medium transition ${
                            ackEnclosed === v
                              ? 'bg-[#FFB800]/20 border-[#FFB800] text-[#FFB800]'
                              : 'bg-[#030614] border-white/20 text-white/60 hover:border-white/40'
                          }`}
                          data-testid={`manual-ack-${v.toLowerCase()}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Next → submit form */}
                <Button
                  onClick={createStagingCase}
                  disabled={manualFormSubmitted && !!caseId}
                  className={`w-full h-10 font-bold text-sm mt-2 ${
                    manualFormSubmitted
                      ? 'bg-[#00FFB3]/15 text-[#00FFB3] border border-[#00FFB3]/40 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#FFB800] to-[#FF8800] text-black hover:opacity-90'
                  }`}
                  data-testid="manual-form-submit-btn">
                  {manualFormSubmitted
                    ? <><CheckCircle2 size={14} className="mr-1.5" /> Manual fields locked — upload below</>
                    : <>Next → Lock manual fields & open upload</>}
                </Button>
              </div>
            </div>

            {/* ─── STEP 2: FILE UPLOAD (only after manual form submitted) ─── */}
            <div
              className={`p-4 rounded-xl bg-[#0B0F1A] border-2 border-dashed transition-colors ${
                manualFormSubmitted
                  ? 'border-[#00C2FF]/30 hover:border-[#00C2FF]/50 cursor-pointer'
                  : 'border-white/10 opacity-50 cursor-not-allowed'
              }`}
              onDrop={manualFormSubmitted ? handleDrop : undefined}
              onDragOver={manualFormSubmitted ? handleDragOver : undefined}
              onClick={() => {
                if (!manualFormSubmitted) {
                  toast.error('Please fill and lock the 15 manual fields above first');
                  return;
                }
                fileInputRef.current?.click();
              }}
              data-testid="file-drop-zone"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.txt,.xlsx,.mp3,.wav,.m4a"
                className="hidden"
                onChange={(e) => handleBatchUpload(e.target.files)}
                disabled={!manualFormSubmitted}
              />
              <div className="text-center py-6">
                {isUploading ? (
                  <Loader2 className="animate-spin text-[#00C2FF] mx-auto mb-2" size={32} />
                ) : (
                  <Upload className={manualFormSubmitted ? 'text-[#00C2FF] mx-auto mb-2' : 'text-white/30 mx-auto mb-2'} size={32} />
                )}
                <p className="text-white font-semibold">Step 2 — Drop Files or Click to Upload</p>
                <p className="text-white/40 text-xs mt-1">PDF, DOCX, DOC, JPG, PNG, TXT, XLSX, MP3, WAV</p>
                <p className="text-[#00FFB3] text-xs mt-2 font-semibold">NO LIMIT — Upload 1 to 30+ files</p>
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
              onClick={() => generateTripleFusion(false)}
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

            {/* Force-Regenerate (cache bypass) — only enabled when files are staged */}
            <Button
              onClick={() => generateTripleFusion(true)}
              disabled={isGenerating || stagedFiles.length === 0}
              data-testid="force-regenerate-fusion-btn"
              variant="outline"
              className="w-full h-10 border-[#FF6B3D]/50 bg-[#FF6B3D]/10 text-[#FF6B3D] hover:bg-[#FF6B3D]/20 text-sm font-medium"
              title="Bypass cache & rerun live OpenAI pipeline (5 credits)"
            >
              <RefreshCw size={14} className="mr-2" />
              Force Regenerate (clear cache, live OpenAI)
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
                <FusionIdleView
                  filesReady={stagedFiles.length > 0}
                  firReady={!!firNumber.trim()}
                  caseId={caseId}
                  firNumber={firNumber}
                />
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

const FusionIdleView = ({ filesReady, firReady, caseId, firNumber }) => {
  const [fxLoading, setFxLoading] = React.useState(null);

  const downloadFixed = async (docType) => {
    if (!caseId) {
      toast.error('Upload at least one file first');
      return;
    }
    setFxLoading(docType);
    try {
      const resp = await api.get(`/staging/render-fixed/${docType}/${caseId}`, { responseType: 'blob' });
      const blob = new Blob([resp.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const labelMap = { charge_sheet: 'ChargeSheet', case_diary_part1: 'CaseDiary', remand_report: 'Remand' };
      a.download = `${(firNumber || 'case').replaceAll('/', '-')}_Fixed${labelMap[docType] || docType}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Fixed-layout document downloaded (0 credits)');
    } catch (error) {
      let msg = error.response?.data?.detail || 'Fixed-layout render failed';
      if (error.response?.data instanceof Blob) {
        try { msg = JSON.parse(await error.response.data.text()).detail || msg; } catch (e) { /* ignore */ }
      }
      toast.error(msg);
    } finally {
      setFxLoading(null);
    }
  };

  return (
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

    {filesReady && caseId && (
      <div className="mt-8 p-4 rounded-lg bg-[#030614] border border-[#00FFB3]/30 text-left" data-testid="fixed-layout-idle-section">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={14} className="text-[#00FFB3]" />
          <p className="text-[#00FFB3] text-xs font-semibold uppercase tracking-wider">Skip AI — Download Fixed Templates (0 credits)</p>
        </div>
        <p className="text-white/50 text-xs mb-3 leading-relaxed">
          Hard-coded layouts. Aadhaar auto-extracted from your uploads. Missing fields print as <span className="font-mono text-[#00FFB3]">_____</span>.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => downloadFixed('charge_sheet')} disabled={fxLoading !== null}
            className="h-9 bg-[#00FFB3]/15 border border-[#00FFB3]/40 text-[#00FFB3] hover:bg-[#00FFB3]/25 text-xs font-medium"
            data-testid="idle-download-fixed-chargesheet">
            {fxLoading === 'charge_sheet' ? <Loader2 className="animate-spin" size={12} /> : 'Charge Sheet'}
          </Button>
          <Button onClick={() => downloadFixed('case_diary_part1')} disabled={fxLoading !== null}
            className="h-9 bg-[#4F7EFF]/15 border border-[#4F7EFF]/40 text-[#4F7EFF] hover:bg-[#4F7EFF]/25 text-xs font-medium"
            data-testid="idle-download-fixed-casediary">
            {fxLoading === 'case_diary_part1' ? <Loader2 className="animate-spin" size={12} /> : 'Case Diary'}
          </Button>
          <Button onClick={() => downloadFixed('remand_report')} disabled={fxLoading !== null}
            className="h-9 bg-[#FFB800]/15 border border-[#FFB800]/40 text-[#FFB800] hover:bg-[#FFB800]/25 text-xs font-medium"
            data-testid="idle-download-fixed-remand">
            {fxLoading === 'remand_report' ? <Loader2 className="animate-spin" size={12} /> : 'Remand'}
          </Button>
        </div>
      </div>
    )}
  </div>
  );
};

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
  const [remandLoading, setRemandLoading] = React.useState(false);
  const [corrections, setCorrections] = React.useState(null);
  const [hasChargeSheet, setHasChargeSheet] = React.useState(false);
  const [hasCaseDiary, setHasCaseDiary] = React.useState(false);
  const [hasRemandReport, setHasRemandReport] = React.useState(false);
  const [fixedLoading, setFixedLoading] = React.useState(null); // 'charge_sheet' | 'case_diary_part1' | 'remand_report' | null
  const [smartElapsed, setSmartElapsed] = React.useState(0);
  const [diaryElapsed, setDiaryElapsed] = React.useState(0);
  const [remandElapsed, setRemandElapsed] = React.useState(0);

  // Live elapsed-time counters so the user sees real progress, not a stuck "~20s" hint
  React.useEffect(() => {
    if (!smartLoading) return undefined;
    const t = setInterval(() => setSmartElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [smartLoading]);
  React.useEffect(() => {
    if (!diaryLoading) return undefined;
    const t = setInterval(() => setDiaryElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [diaryLoading]);
  React.useEffect(() => {
    if (!remandLoading) return undefined;
    const t = setInterval(() => setRemandElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [remandLoading]);

  const downloadFixedLayout = async (docType) => {
    if (!caseId) {
      toast.error('No case selected');
      return;
    }
    setFixedLoading(docType);
    try {
      const resp = await api.get(`/staging/render-fixed/${docType}/${caseId}`, { responseType: 'blob' });
      const blob = new Blob([resp.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const labelMap = { charge_sheet: 'ChargeSheet', case_diary_part1: 'CaseDiary', remand_report: 'Remand' };
      a.download = `${(firNumber || 'case').replaceAll('/', '-')}_Fixed${labelMap[docType] || docType}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Fixed-layout document downloaded (0 credits — deterministic template)');
    } catch (error) {
      let msg = error.response?.data?.detail || 'Fixed-layout render failed';
      if (error.response?.data instanceof Blob) {
        try { msg = JSON.parse(await error.response.data.text()).detail || msg; } catch (e) { /* ignore */ }
      }
      toast.error(msg);
    } finally {
      setFixedLoading(null);
    }
  };

  const downloadSmartChargeSheet = async () => {
    if (!caseId) {
      toast.error('No case selected');
      return;
    }
    setSmartElapsed(0);
    setSmartLoading(true);
    setCorrections(null);
    try {
      toast.info('Running station-writer AI (Claude 4.5)... ~20 seconds');
      const resp = await api.post(
        `/staging/generate-intelligent-charge-sheet/${caseId}`,
        null,
        { responseType: 'blob', timeout: 180000 }
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
    setDiaryElapsed(0);
    setDiaryLoading(true);
    try {
      toast.info('Generating Case Diary Part-I with Claude 4.5...');
      const resp = await api.post(
        `/staging/generate-intelligent-case-diary/${caseId}`,
        null,
        { responseType: 'blob', timeout: 180000 }
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
      setHasCaseDiary(true);
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

  const downloadSmartRemand = async () => {
    if (!caseId) {
      toast.error('No case selected');
      return;
    }
    if (!hasChargeSheet) {
      toast.error('Generate the Station-Format Charge Sheet first (it provides the structured data)');
      return;
    }
    setRemandElapsed(0);
    setRemandLoading(true);
    try {
      toast.info('Composing Remand Report letter with AI...');
      const resp = await api.post(
        `/staging/generate-intelligent-remand-report/${caseId}`,
        null,
        { responseType: 'blob', timeout: 180000 }
      );
      const blob = new Blob([resp.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(firNumber || 'case').replaceAll('/', '-')}_IntelligentRemandReport.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setHasRemandReport(true);
      toast.success('Intelligent Remand Report downloaded (2 credits)');
    } catch (error) {
      let msg = error.response?.data?.detail || 'Remand Report generation failed';
      if (error.response?.data instanceof Blob) {
        try { msg = JSON.parse(await error.response.data.text()).detail || msg; } catch (e) { /* ignore */ }
      }
      toast.error(msg);
    } finally {
      setRemandLoading(false);
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
            <><Loader2 className="animate-spin mr-2" size={16} /> Running AI · {smartElapsed}s elapsed...</>
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
            <><Loader2 className="animate-spin mr-2" size={16} /> Composing entries · {diaryElapsed}s elapsed...</>
          ) : (
            <><BookOpen size={16} className="mr-2" /> Generate Case Diary Part-I</>
          )}
        </Button>
        {!hasChargeSheet && (
          <p className="mt-2 text-xs text-white/40 italic">Generate the charge sheet above first.</p>
        )}
      </div>

      {/* STATION-FORMAT REMAND CASE DIARY */}
      <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-[#FF6B3D]/10 to-[#FF8800]/5 border border-[#FF6B3D]/30">
        <div className="flex items-start gap-3 mb-3">
          <FileText className="text-[#FF6B3D] shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="text-[#FF6B3D] font-bold text-base">Station-Format Remand Report (Part-I)</h4>
            <p className="text-white/60 text-xs mt-1 leading-relaxed">
              Formal letter to the Hon&apos;ble Magistrate requesting remand custody. Composed in V3.0 Master IO style — 10 numbered fields, brief facts, investigation done so far, grounds of arrest, standard prayer clause + enclosures + escort. 2 credits.
            </p>
          </div>
        </div>
        <Button
          onClick={downloadSmartRemand}
          disabled={remandLoading || !hasChargeSheet}
          className="w-full h-11 bg-gradient-to-r from-[#FF6B3D] to-[#FF8800] text-white font-bold hover:opacity-90 disabled:opacity-40"
          data-testid="download-intelligent-remand-report"
          title={!hasChargeSheet ? 'Generate Station-Format Charge Sheet first' : 'Generate & download Remand Report'}
        >
          {remandLoading ? (
            <><Loader2 className="animate-spin mr-2" size={16} /> Composing remand letter · {remandElapsed}s elapsed...</>
          ) : (
            <><FileText size={16} className="mr-2" /> Generate Remand Report</>
          )}
        </Button>
        {!hasChargeSheet && (
          <p className="mt-2 text-xs text-white/40 italic">Generate the charge sheet above first.</p>
        )}
      </div>

      {/* CCTNS Autofill JSON */}
      <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-[#00C2FF]/10 to-[#00FFB3]/5 border border-[#00C2FF]/30">
        <div className="flex items-start gap-3 mb-3">
          <FileStack className="text-[#00C2FF] shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="text-[#00C2FF] font-bold text-base">CCTNS Autofill JSON (0 credits)</h4>
            <p className="text-white/60 text-xs mt-1 leading-relaxed">
              Flat JSON mapping the chargesheet onto CCTNS portal fields (fir_number, sections_list, all a1..an + lw1..lwN blocks). Copy/paste into the CCTNS form without re-deriving anything.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            onClick={async () => {
              if (!caseId) { toast.error('No case selected'); return; }
              if (!hasChargeSheet) { toast.error('Generate the Station-Format Charge Sheet first'); return; }
              try {
                const resp = await api.get(`/staging/cctns-autofill/${caseId}`);
                if (resp.data?.success === false) {
                  toast.error(resp.data.message || 'CCTNS autofill unavailable');
                  return;
                }
                const txt = JSON.stringify(resp.data.cctns_autofill || {}, null, 2);
                await navigator.clipboard.writeText(txt);
                const a1 = resp.data?.cctns_autofill?.total_accused ?? 0;
                const lwN = resp.data?.cctns_autofill?.total_witnesses ?? 0;
                toast.success(`CCTNS JSON copied · ${a1} accused · ${lwN} witnesses`);
              } catch (e) {
                toast.error(e.response?.data?.detail || 'Failed to fetch CCTNS JSON');
              }
            }}
            disabled={!hasChargeSheet}
            className="h-10 bg-[#00C2FF]/20 border border-[#00C2FF]/40 text-[#00C2FF] hover:bg-[#00C2FF]/30 font-medium text-xs disabled:opacity-40"
            data-testid="copy-cctns-autofill"
            title={!hasChargeSheet ? 'Generate the Station-Format Charge Sheet first' : 'Copy CCTNS autofill JSON to clipboard'}
          >
            <Download size={14} className="mr-1.5" />Copy JSON to Clipboard
          </Button>
          <Button
            onClick={async () => {
              if (!caseId) { toast.error('No case selected'); return; }
              if (!hasChargeSheet) { toast.error('Generate the Station-Format Charge Sheet first'); return; }
              try {
                const resp = await api.get(`/staging/cctns-autofill/${caseId}`);
                if (resp.data?.success === false) {
                  toast.error(resp.data.message || 'CCTNS autofill unavailable');
                  return;
                }
                const blob = new Blob([JSON.stringify(resp.data.cctns_autofill || {}, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(firNumber || 'case').replaceAll('/', '-')}_CCTNS_autofill.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                toast.success('CCTNS autofill JSON downloaded');
              } catch (e) {
                toast.error(e.response?.data?.detail || 'Failed to download CCTNS JSON');
              }
            }}
            disabled={!hasChargeSheet}
            className="h-10 bg-[#00FFB3]/20 border border-[#00FFB3]/40 text-[#00FFB3] hover:bg-[#00FFB3]/30 font-medium text-xs disabled:opacity-40"
            data-testid="download-cctns-autofill"
            title={!hasChargeSheet ? 'Generate the Station-Format Charge Sheet first' : 'Download CCTNS autofill JSON file'}
          >
            <Download size={14} className="mr-1.5" />Download .json
          </Button>
        </div>
      </div>
      {hasChargeSheet && (
        <EditAndRegeneratePanel
          firNumber={firNumber}
          caseId={caseId}
          hasCaseDiary={hasCaseDiary}
          hasRemandReport={hasRemandReport}
        />
      )}

      {/* FIXED-LAYOUT (NO AI) DETERMINISTIC TEMPLATES */}
      <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-[#00FFB3]/10 to-[#00C2FF]/5 border border-[#00FFB3]/30" data-testid="fixed-layout-section">
        <div className="flex items-start gap-3 mb-3">
          <Lock className="text-[#00FFB3] shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <h4 className="text-[#00FFB3] font-bold text-base">Fixed-Layout Documents (0 credits)</h4>
            <p className="text-white/60 text-xs mt-1 leading-relaxed">
              Strict station-format templates. Layout never changes. Aadhaar fields auto-extracted from your uploaded files. Missing fields render as <span className="font-mono text-[#00FFB3]">_____</span> for manual editing in Word. No AI · no hallucination · always identical structure.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button
            onClick={() => downloadFixedLayout('charge_sheet')}
            disabled={fixedLoading !== null}
            className="h-10 bg-[#00FFB3]/20 border border-[#00FFB3]/40 text-[#00FFB3] hover:bg-[#00FFB3]/30 font-medium text-xs"
            data-testid="download-fixed-chargesheet"
          >
            {fixedLoading === 'charge_sheet' ? <Loader2 className="animate-spin" size={14} /> : <><Download size={14} className="mr-1.5" />Charge Sheet</>}
          </Button>
          <Button
            onClick={() => downloadFixedLayout('case_diary_part1')}
            disabled={fixedLoading !== null}
            className="h-10 bg-[#4F7EFF]/20 border border-[#4F7EFF]/40 text-[#4F7EFF] hover:bg-[#4F7EFF]/30 font-medium text-xs"
            data-testid="download-fixed-casediary"
          >
            {fixedLoading === 'case_diary_part1' ? <Loader2 className="animate-spin" size={14} /> : <><Download size={14} className="mr-1.5" />Case Diary</>}
          </Button>
          <Button
            onClick={() => downloadFixedLayout('remand_report')}
            disabled={fixedLoading !== null}
            className="h-10 bg-[#FFB800]/20 border border-[#FFB800]/40 text-[#FFB800] hover:bg-[#FFB800]/30 font-medium text-xs"
            data-testid="download-fixed-remand"
          >
            {fixedLoading === 'remand_report' ? <Loader2 className="animate-spin" size={14} /> : <><Download size={14} className="mr-1.5" />Remand</>}
          </Button>
        </div>
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

// =====================================================================
// EDIT & REGENERATE PANEL — Section G of V3.0 spec
// Supports all 3 V3.0 documents: Charge Sheet, Case Diary Part-I, Remand Report.
// Pick the doc to fix, list corrections, click Apply → backend re-runs the
// LLM with cascade rules and emits a fresh DOCX.
// =====================================================================
const DOC_TYPE_OPTIONS = [
  { value: 'charge_sheet', label: 'Charge Sheet', endpoint: 'regenerate-charge-sheet', filename: 'ChargeSheet' },
  { value: 'case_diary',   label: 'Case Diary Part-I', endpoint: 'regenerate-case-diary', filename: 'CaseDiary' },
  { value: 'remand_report',label: 'Remand Report', endpoint: 'regenerate-remand-report', filename: 'RemandReport' },
];

const FIELD_OPTIONS_BY_DOC = {
  charge_sheet: [
    { value: 'Field 01 District / Police Station',     label: 'Field 01 — District / PS' },
    { value: 'Field 02 Charge Sheet Number',           label: 'Field 02 — CS Number' },
    { value: 'Field 03 Date of Charge',                label: 'Field 03 — Date of Charge' },
    { value: 'Field 04 Act & Sections',                label: 'Field 04 — Act & Sections' },
    { value: 'Field 05 Type of Final Report',          label: 'Field 05 — Report Type' },
    { value: 'Field 07 Original or Supplementary',     label: 'Field 07 — Original/Supp.' },
    { value: 'Field 08 IO Name',                       label: 'Field 08 — IO Name' },
    { value: 'Field 09 Complainant',                   label: 'Field 09 — Complainant' },
    { value: 'Field 10 Property Seized',               label: 'Field 10 — Property Seized' },
    { value: 'Field 11 Accused',                       label: 'Field 11 — Accused (A1–AN)' },
    { value: 'Field 11(a) Date of Arrest / Release',   label: 'Field 11(a) — Arrest / Release' },
    { value: 'Field 13 Witnesses',                     label: 'Field 13 — Witnesses (LW-1…LW-N)' },
    { value: 'Field 14 If FR is false',                label: 'Field 14 — FR-false action' },
    { value: 'Field 15 Lab Result',                    label: 'Field 15 — Lab result' },
    { value: 'Field 16 Brief Facts (narrative)',       label: 'Field 16 — Brief Facts narrative' },
    { value: 'Field 17 Ack Copy Enclosed',             label: 'Field 17 — Ack copy enclosed' },
    { value: 'Field 18 Dispatched On',                 label: 'Field 18 — Dispatched on' },
    { value: 'Signing Block',                          label: 'Signing block (IO sign-off)' },
    { value: 'Court Name (top heading)',               label: 'Court Name (top heading)' },
  ],
  case_diary: [
    { value: 'Header — District / PS / FIR',           label: 'Header — Dist / PS / FIR' },
    { value: 'Date, Time & Place of occurrence',       label: 'Occurrence date / time / place' },
    { value: 'CD Date',                                label: 'CD Date (Field cd_date)' },
    { value: 'Field 1 Date and time of report',        label: 'Field 1 — Date / time of report' },
    { value: 'Field 2 Complainant / Informant',        label: 'Field 2 — Complainant' },
    { value: 'Field 3 Accused (A1–AN)',                label: 'Field 3 — Accused list' },
    { value: 'Field 4 Property Lost',                  label: 'Field 4 — Property Lost' },
    { value: 'Field 5 Property Recovered',             label: 'Field 5 — Property Recovered' },
    { value: 'Field 6 Date of Last Case Diary',        label: 'Field 6 — Last CD date' },
    { value: 'Field 7 Deceased',                       label: 'Field 7 — Deceased' },
    { value: 'Field 8 Witnesses examined (LW-1…LW-N)', label: 'Field 8 — Witnesses examined' },
    { value: 'Brief Facts paragraph',                  label: 'Brief Facts paragraph' },
    { value: 'Investigation Steps (chronological)',    label: 'Investigation Steps' },
    { value: 'IO Name (Signing Block)',                label: 'IO Signing Block' },
  ],
  remand_report: [
    { value: 'Court Heading (AT <place>)',             label: 'Court heading (AT <place>)' },
    { value: 'Header — PS / Dist / FIR / Date',        label: 'Header — PS / Dist / FIR / Date' },
    { value: 'Field 1 Investigating Officer',          label: 'Field 1 — IO block' },
    { value: 'Field 2 Date and place of occurrence',   label: 'Field 2 — Occurrence' },
    { value: 'Field 3 Offence U/s (Sections)',         label: 'Field 3 — Sections' },
    { value: 'Field 4 Date of action taken',           label: 'Field 4 — Action date' },
    { value: 'Field 5 Complainant',                    label: 'Field 5 — Complainant' },
    { value: 'Field 6 Accused (A1–AN)',                label: 'Field 6 — Accused' },
    { value: 'Field 7 Property lost',                  label: 'Field 7 — Property lost' },
    { value: 'Field 8 Property recovered',             label: 'Field 8 — Property recovered' },
    { value: 'Field 9 Deceased',                       label: 'Field 9 — Deceased' },
    { value: 'Field 10 Witnesses',                     label: 'Field 10 — Witnesses' },
    { value: 'Brief Facts paragraph',                  label: 'Brief Facts paragraph' },
    { value: 'Investigation Done So Far',              label: 'Investigation Done So Far' },
    { value: 'Reasons / Grounds for arrest',           label: 'Reasons / Grounds for arrest' },
    { value: 'Remand Type (judicial / police)',        label: 'Remand Type' },
    { value: 'Enclosures list',                        label: 'Enclosures list' },
    { value: 'Escort line',                            label: 'Escort line' },
    { value: 'Signing Block',                          label: 'Signing Block' },
  ],
};

const EditAndRegeneratePanel = ({ firNumber, caseId, hasCaseDiary, hasRemandReport }) => {
  const [docType, setDocType] = React.useState('charge_sheet');
  const [items, setItems] = React.useState([
    { field: FIELD_OPTIONS_BY_DOC.charge_sheet[6].value, instruction: '' },
  ]);
  const [loading, setLoading] = React.useState(false);
  const [cascade, setCascade] = React.useState(null);
  const [lastBlobUrl, setLastBlobUrl] = React.useState(null);
  const [lastFilename, setLastFilename] = React.useState('');

  // When user switches doc type, reset the field selector to the first option
  const handleDocTypeChange = (newType) => {
    const opts = FIELD_OPTIONS_BY_DOC[newType] || [];
    setDocType(newType);
    setItems((prev) => prev.map((it) => ({
      ...it,
      field: opts.some((o) => o.value === it.field) ? it.field : (opts[0]?.value || it.field),
    })));
  };

  const FIELD_OPTIONS = FIELD_OPTIONS_BY_DOC[docType] || [];
  const docCfg = DOC_TYPE_OPTIONS.find((d) => d.value === docType) || DOC_TYPE_OPTIONS[0];

  const updateItem = (idx, key, val) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  const addItem = () =>
    setItems((prev) => [...prev, { field: FIELD_OPTIONS[0].value, instruction: '' }]);
  const removeItem = (idx) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const applyAndRegenerate = async () => {
    const ready = items.filter((i) => i.instruction.trim());
    if (ready.length === 0) {
      toast.error('Type at least one correction before regenerating');
      return;
    }
    setLoading(true);
    setCascade(null);
    try {
      const resp = await api.post(
        `/staging/${docCfg.endpoint}/${caseId}`,
        { corrections: ready },
        { responseType: 'blob', timeout: 180000 }
      );
      const blob = new Blob([resp.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      if (lastBlobUrl) window.URL.revokeObjectURL(lastBlobUrl);
      const url = window.URL.createObjectURL(blob);
      setLastBlobUrl(url);

      const cd = resp.headers['content-disposition'] || '';
      const m = cd.match(/filename="([^"]+)"/);
      const fname = m ? m[1] : `${(firNumber || 'case').replaceAll('/', '-')}_${docCfg.filename}_updated.docx`;
      setLastFilename(fname);

      try {
        const report = JSON.parse(resp.headers['x-cascade-report'] || '{}');
        setCascade(report);
      } catch (e) {
        setCascade({ corrections_applied: [], regeneration_count: 1 });
      }
      toast.success(`${docCfg.label} updated · ${ready.length} correction(s) applied, cascading fields refreshed.`);
    } catch (err) {
      let msg = err.response?.data?.detail || 'Regenerate failed';
      if (err.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text()).detail || msg; } catch (e) { /* ignore */ }
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadUpdated = () => {
    if (!lastBlobUrl) return;
    const a = document.createElement('a');
    a.href = lastBlobUrl;
    a.download = lastFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="mb-4 p-4 rounded-lg bg-gradient-to-br from-[#FF6B3D]/8 to-[#FFB800]/5 border border-[#FF6B3D]/30"
      data-testid="edit-regenerate-panel"
    >
      <div className="flex items-start gap-3 mb-3">
        <Edit3 className="text-[#FF6B3D] shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h4 className="text-[#FF6B3D] font-bold text-base">Edit &amp; Regenerate (0 credits)</h4>
          <p className="text-white/60 text-xs mt-1 leading-relaxed">
            Pick a document and field, describe what is wrong, and click <strong>Apply Correction and Regenerate</strong>.
            The AI will fix the field + cascade the change through every dependent paragraph
            (IO references, A-numbers, LW numbers, dates, sections, signing block) and emit an updated DOCX.
          </p>
        </div>
      </div>

      {/* Document-type selector */}
      <div className="mb-3 flex gap-1.5 flex-wrap" data-testid="edit-regenerate-doctype">
        {DOC_TYPE_OPTIONS.map((opt) => {
          const disabled =
            (opt.value === 'case_diary' && !hasCaseDiary) ||
            (opt.value === 'remand_report' && !hasRemandReport);
          const active = docType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => !disabled && handleDocTypeChange(opt.value)}
              disabled={disabled}
              data-testid={`edit-regenerate-doctype-${opt.value}`}
              className={`text-xs px-3 py-1.5 rounded font-medium border transition-colors ${
                active
                  ? 'bg-[#FF6B3D] text-white border-[#FF6B3D]'
                  : disabled
                  ? 'bg-[#030614] text-white/25 border-white/10 cursor-not-allowed'
                  : 'bg-[#030614] text-white/70 border-white/20 hover:border-[#FF6B3D]/60 hover:text-white'
              }`}
              title={disabled ? `Generate the ${opt.label} first to enable corrections.` : `Edit & regenerate ${opt.label}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5">
        {items.map((it, idx) => (
          <div key={idx} className="p-2.5 rounded bg-[#030614] border border-white/10" data-testid={`correction-row-${idx}`}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/50 text-[10px] uppercase tracking-wide">Correction #{idx + 1}</label>
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(idx)}
                  className="text-white/40 hover:text-red-400 text-xs"
                  data-testid={`remove-correction-${idx}`}
                >
                  <X size={12} className="inline" /> remove
                </button>
              )}
            </div>
            <select
              value={it.field}
              onChange={(e) => updateItem(idx, 'field', e.target.value)}
              className="w-full bg-[#0B0F1A] border border-white/15 text-white text-xs h-8 rounded px-2 mb-1.5"
              data-testid={`correction-field-${idx}`}
            >
              {FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Textarea
              value={it.instruction}
              onChange={(e) => updateItem(idx, 'instruction', e.target.value)}
              placeholder={"What is wrong → what is correct?\ne.g., 'IO name shows K Lal — should be K. Lal Singh'"}
              className="bg-[#0B0F1A] border-white/15 text-white text-xs min-h-[60px] leading-relaxed"
              data-testid={`correction-instruction-${idx}`}
            />
          </div>
        ))}

        <button
          onClick={addItem}
          className="text-[#FF6B3D] hover:text-[#FF8855] text-xs font-medium underline"
          data-testid="add-correction-btn"
        >
          + Add another correction
        </button>

        <Button
          onClick={applyAndRegenerate}
          disabled={loading || !caseId}
          className="w-full h-10 bg-gradient-to-r from-[#FF6B3D] to-[#FFB800] text-black font-bold hover:opacity-90 mt-2"
          data-testid="apply-corrections-btn"
        >
          {loading ? (
            <><Loader2 className="animate-spin mr-2" size={14} /> Regenerating with corrections…</>
          ) : (
            <><RefreshCw size={14} className="mr-2" /> Apply Correction and Regenerate</>
          )}
        </Button>

        {cascade && (
          <div
            className="mt-3 p-3 rounded bg-[#0B0F1A] border border-[#00FFB3]/30"
            data-testid="cascade-summary"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 size={14} className="text-[#00FFB3]" />
              <p className="text-[#00FFB3] text-xs font-bold uppercase tracking-wider">
                Update applied · revision {cascade.regeneration_count || 1}
              </p>
            </div>
            {Array.isArray(cascade.corrections_applied) && cascade.corrections_applied.length > 0 ? (
              <ul className="text-white/70 text-[11px] leading-relaxed space-y-0.5 ml-1">
                {cascade.corrections_applied.slice(0, 12).map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
                {cascade.corrections_applied.length > 12 && (
                  <li className="text-white/40 italic">… +{cascade.corrections_applied.length - 12} more</li>
                )}
              </ul>
            ) : (
              <p className="text-white/50 text-[11px] italic">
                Corrections applied. Download the updated DOCX below to see the changes.
              </p>
            )}
            <Button
              onClick={downloadUpdated}
              className="w-full h-9 mt-3 bg-[#00FFB3]/15 border border-[#00FFB3]/40 text-[#00FFB3] hover:bg-[#00FFB3]/25 text-xs font-bold"
              data-testid="download-updated-docx-btn"
            >
              <Download size={14} className="mr-2" /> Download Updated DOCX (rev {cascade.regeneration_count || 1})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};


export default ChargeSheetFusion;
