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
    
    try {
      toast.info('Starting Triple Fusion... (Credits deducted only on SUCCESS)');
      
      const response = await api.post(`/staging/generate-triple-fusion/${caseId}`);
      
      // Handle "processing" status for large batches
      if (response.data.status === 'processing') {
        toast.info(response.data.message || 'Processing large batch in background...');
        
        // Start polling for results
        pollForResults(caseId);
        return;
      }
      
      if (response.data.success) {
        handleFusionSuccess(response.data);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Fusion failed';
      toast.error(errorMsg);
      // Use success toast for reassurance (green color)
      toast.success('✓ No credits deducted - Automatic rollback on failure', {
        duration: 5000,
        description: 'You can safely try again'
      });
      console.error(error);
      setIsGenerating(false);
    }
  };
  
  // Handle successful fusion response
  const handleFusionSuccess = (data) => {
    // Set HTML content for tabs
    setChargeSheetHtml(data.documents?.charge_sheet || '');
    setCaseDiaryHtml(data.documents?.case_diary || '');
    setRemandHtml(data.documents?.remand_cd || '');
    
    // Set download links
    setDownloadLinks({
      chargesheet: `/api/download/docx/${firNumber.replace('/', '-')}_ChargeSheet.docx`,
      casediary: `/api/download/docx/${firNumber.replace('/', '-')}_CaseDiary.docx`,
      remand: `/api/download/docx/${firNumber.replace('/', '-')}_RemandCD.docx`
    });
    
    // Set extracted data summary
    setExtractedData(data.extracted_data);
    setCreditsUsed(data.credits_used);
    
    toast.success('Triple Fusion COMPLETE!');
    toast.success(`Credits used: ${data.credits_used}`);
    toast.info(`Documents processed: ${data.documents_processed}`);
    setIsGenerating(false);
  };
  
  // Poll for background processing results
  const pollForResults = async (currentCaseId) => {
    let attempts = 0;
    const maxAttempts = 30; // Poll for up to 3 minutes (30 * 6 seconds)
    
    const checkStatus = async () => {
      try {
        const response = await api.get(`/staging/job-status/${currentCaseId}`);
        
        if (response.data.success || response.data.status === 'completed') {
          if (response.data.cached) {
            // Already completed - fetch full results
            const fullResponse = await api.post(`/staging/generate-triple-fusion/${currentCaseId}`);
            if (fullResponse.data.success) {
              handleFusionSuccess(fullResponse.data);
            }
          } else {
            handleFusionSuccess(response.data);
          }
          return; // Stop polling
        }
        
        if (response.data.status === 'processing') {
          attempts++;
          if (attempts < maxAttempts) {
            toast.info(`Processing... ${response.data.progress || 0}%`, { id: 'processing-status' });
            setTimeout(checkStatus, 6000); // Poll every 6 seconds
          } else {
            toast.error('Processing is taking too long. Please try again.');
            setIsGenerating(false);
          }
          return;
        }
        
        // Not found or other status
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 6000);
        } else {
          setIsGenerating(false);
        }
      } catch (error) {
        console.error('Polling error:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 6000);
        } else {
          toast.error('Failed to get processing status');
          setIsGenerating(false);
        }
      }
    };
    
    // Start polling
    setTimeout(checkStatus, 5000); // First check after 5 seconds
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
                {activeTab === 'chargesheet' && (
                  chargeSheetHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: chargeSheetHtml }} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                      <FileSpreadsheet size={64} className="mb-4 opacity-30" />
                      <p className="text-lg font-semibold">Charge Sheet</p>
                      <p className="text-sm">Upload files and click "Generate Triple Fusion"</p>
                    </div>
                  )
                )}
                
                {activeTab === 'casediary' && (
                  caseDiaryHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: caseDiaryHtml }} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                      <BookOpen size={64} className="mb-4 opacity-30" />
                      <p className="text-lg font-semibold">Case Diary Part-I</p>
                      <p className="text-sm">Generated from FIR and Case Diary files</p>
                    </div>
                  )
                )}
                
                {activeTab === 'remand' && (
                  remandHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: remandHtml }} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                      <Gavel size={64} className="mb-4 opacity-30" />
                      <p className="text-lg font-semibold">Remand Case Diary</p>
                      <p className="text-sm">Grounds for Arrest & Section 35(3) Notice</p>
                    </div>
                  )
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
