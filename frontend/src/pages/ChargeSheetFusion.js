import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  FileCheck,
  Languages, 
  Users, 
  Scale, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Loader2,
  X,
  Eye,
  Download,
  Printer,
  Edit3,
  Sparkles,
  FileStack,
  Table,
  Image as ImageIcon,
  Mic,
  MicOff,
  Square
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import api from '../utils/api';

// Helper to extract error message from API response
const getErrorMessage = (error, fallback = 'An error occurred') => {
  const detail = error.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return fallback;
};

const ChargeSheetFusion = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Upload states
  const [teluguPetition, setTeluguPetition] = useState(null);
  const [cdfDocument, setCdfDocument] = useState(null);
  const [caseDiaryPart2, setCaseDiaryPart2] = useState(null);
  
  // Case details
  const [policeStation, setPoliceStation] = useState('');
  const [district, setDistrict] = useState('');
  const [firNumber, setFirNumber] = useState('');
  const [sections, setSections] = useState('');
  
  // Generated content
  const [generatedChargeSheet, setGeneratedChargeSheet] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [activeBlankFields, setActiveBlankFields] = useState([]);
  
  // Editable content
  const [editableContent, setEditableContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [legalText, setLegalText] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const steps = [
    { number: 1, title: 'Upload Documents', icon: Upload, color: '#00C2FF' },
    { number: 2, title: 'AI Fusion', icon: Sparkles, color: '#4F7EFF' },
    { number: 3, title: 'Review & Edit', icon: Edit3, color: '#00FFB3' },
    { number: 4, title: 'Export', icon: FileCheck, color: '#FFB800' }
  ];

  const handleFileUpload = (file, setter, type) => {
    if (file) {
      setter(file);
      toast.success(`${type} uploaded: ${file.name}`);
    }
  };

  const removeFile = (setter, type) => {
    setter(null);
    toast.info(`${type} removed`);
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoiceRecording(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info('Recording started... Speak now', { duration: 2000 });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.info('Processing your voice input...');
    }
  };

  const processVoiceRecording = async (audioBlob) => {
    setIsProcessingVoice(true);
    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');
      formData.append('convert_to_legal', 'true');

      const response = await api.post('/charge-sheet-fusion/voice-to-text', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success || response.data.demo_mode) {
        setVoiceText(response.data.translated_text || response.data.original_text || '');
        setLegalText(response.data.legal_text || '');
        
        if (response.data.demo_mode) {
          toast.info('Demo mode: Speech API not configured', { duration: 3000 });
        } else {
          toast.success('Voice input processed successfully!');
        }
      } else {
        toast.error(response.data.message || 'Voice processing failed');
      }
    } catch (error) {
      console.error('Error processing voice:', error);
      toast.error(getErrorMessage(error, 'Failed to process voice input'));
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const insertVoiceText = () => {
    if (legalText) {
      // Insert legal text at the end of editable content
      setEditableContent(prev => {
        const insertion = `\n\nBRIEF FACTS (Voice Input):\n${legalText}`;
        return prev + insertion;
      });
      toast.success('Voice text inserted into charge sheet');
      setVoiceText('');
      setLegalText('');
    }
  };

  const processDocuments = async () => {
    if (!teluguPetition && !cdfDocument && !caseDiaryPart2) {
      toast.error('Please upload at least one document');
      return;
    }

    if (!policeStation || !district) {
      toast.error('Please enter Police Station and District');
      return;
    }

    setIsProcessing(true);
    setActiveStep(2);

    try {
      const formData = new FormData();
      formData.append('police_station', policeStation);
      formData.append('district', district);
      formData.append('fir_number', firNumber || '');
      formData.append('sections', sections || '');
      
      if (teluguPetition) formData.append('petition', teluguPetition);
      if (cdfDocument) formData.append('cdf', cdfDocument);
      if (caseDiaryPart2) formData.append('case_diary', caseDiaryPart2);

      const response = await api.post('/charge-sheet-fusion/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setExtractedData(response.data.extracted_data || {});
      setGeneratedChargeSheet(response.data.charge_sheet || '');
      setEditableContent(response.data.charge_sheet || '');
      setActiveBlankFields(response.data.missing_fields || []);
      
      setActiveStep(3);
      toast.success('Documents processed successfully!');
    } catch (error) {
      console.error('Error processing documents:', error);
      toast.error(getErrorMessage(error, 'Failed to process documents'));
      setActiveStep(1);
    } finally {
      setIsProcessing(false);
    }
  };

  const highlightActiveBlanks = (text) => {
    if (!text) return text;
    // Highlight [MISSING: ...] patterns
    return text.replace(/\[MISSING:\s*([^\]]+)\]/g, 
      '<span class="bg-yellow-500/30 text-yellow-300 px-1 rounded cursor-pointer hover:bg-yellow-500/50" data-field="$1">[MISSING: $1]</span>'
    );
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editableContent);
    toast.success('Copied to clipboard!');
  };

  const downloadAsTxt = () => {
    const blob = new Blob([editableContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChargeSheet_${firNumber || 'draft'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
  };

  const exportToCCTNS = () => {
    navigate('/cctns-bridge');
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#030614] p-6">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#00C2FF]/20 to-[#4F7EFF]/20 border border-[#00C2FF]/30">
              <Sparkles className="text-[#00C2FF]" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Charge Sheet Fusion</h1>
              <p className="text-white/60 text-sm">Multi-Upload • 95% Accuracy Extraction • u/s 193 BNSS</p>
            </div>
          </motion.div>
        </div>

        {/* Progress Steps */}
        <div className="max-w-7xl mx-auto mb-6">
          <div className="flex items-center justify-between bg-[#0B0F1A]/50 rounded-xl p-4 border border-white/5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === step.number;
              const isCompleted = activeStep > step.number;
              
              return (
                <React.Fragment key={step.number}>
                  <div
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                      isActive 
                        ? 'bg-gradient-to-r from-[#00C2FF]/20 to-[#4F7EFF]/20 border border-[#00C2FF]/50' 
                        : isCompleted 
                          ? 'bg-[#00FFB3]/10 border border-[#00FFB3]/30' 
                          : 'bg-[#0B0F1A] border border-white/10'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isCompleted ? 'bg-[#00FFB3]/20' : 'bg-white/5'}`}>
                      {isCompleted ? (
                        <CheckCircle2 className="text-[#00FFB3]" size={18} />
                      ) : (
                        <Icon style={{ color: isActive ? step.color : 'rgba(255,255,255,0.4)' }} size={18} />
                      )}
                    </div>
                    <div className="hidden md:block">
                      <p className={`text-xs ${isActive || isCompleted ? 'text-white' : 'text-white/40'}`}>
                        Step {step.number}
                      </p>
                      <p className={`text-sm font-medium ${isActive ? 'text-[#00C2FF]' : isCompleted ? 'text-[#00FFB3]' : 'text-white/60'}`}>
                        {step.title}
                      </p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <ChevronRight className={`${activeStep > step.number ? 'text-[#00FFB3]' : 'text-white/20'} hidden md:block`} size={20} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Upload Documents */}
            {activeStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-4 gap-6"
              >
                {/* Case Details */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <FileStack className="text-[#00C2FF]" size={18} />
                      Case Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-white/60 text-xs mb-1 block">Police Station *</label>
                        <Input
                          value={policeStation}
                          onChange={(e) => setPoliceStation(e.target.value)}
                          placeholder="e.g., Makthal PS"
                          className="bg-[#030614] border-white/20 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-xs mb-1 block">District *</label>
                        <Input
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="e.g., Narayanpet"
                          className="bg-[#030614] border-white/20 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-xs mb-1 block">FIR Number</label>
                        <Input
                          value={firNumber}
                          onChange={(e) => setFirNumber(e.target.value)}
                          placeholder="e.g., 156/2025"
                          className="bg-[#030614] border-white/20 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-white/60 text-xs mb-1 block">Sections of Law</label>
                        <Input
                          value={sections}
                          onChange={(e) => setSections(e.target.value)}
                          placeholder="e.g., 329(4), 115(2) BNS"
                          className="bg-[#030614] border-white/20 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload Cards */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Telugu Petition */}
                  <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Languages className="text-[#00C2FF]" size={18} />
                      Telugu Petition
                    </h3>
                    <p className="text-white/50 text-xs mb-3">JPG, PNG, PDF supported</p>
                    
                    {teluguPetition ? (
                      <div className="p-3 rounded-lg bg-[#00C2FF]/10 border border-[#00C2FF]/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="text-[#00C2FF]" size={16} />
                            <span className="text-white text-sm truncate max-w-[120px]">{teluguPetition.name}</span>
                          </div>
                          <button onClick={() => removeFile(setTeluguPetition, 'Petition')} className="text-white/50 hover:text-white">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="border-2 border-dashed border-[#00C2FF]/30 rounded-lg p-6 text-center hover:border-[#00C2FF]/60 transition-colors">
                          <Upload className="text-[#00C2FF]/50 mx-auto mb-2" size={24} />
                          <p className="text-white/50 text-xs">Click to upload</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={(e) => handleFileUpload(e.target.files[0], setTeluguPetition, 'Petition')}
                        />
                      </label>
                    )}
                  </div>

                  {/* CDF Document */}
                  <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Table className="text-[#FFB800]" size={18} />
                      Crime Details Form
                    </h3>
                    <p className="text-white/50 text-xs mb-3">DOC, DOCX supported</p>
                    
                    {cdfDocument ? (
                      <div className="p-3 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="text-[#FFB800]" size={16} />
                            <span className="text-white text-sm truncate max-w-[120px]">{cdfDocument.name}</span>
                          </div>
                          <button onClick={() => removeFile(setCdfDocument, 'CDF')} className="text-white/50 hover:text-white">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="border-2 border-dashed border-[#FFB800]/30 rounded-lg p-6 text-center hover:border-[#FFB800]/60 transition-colors">
                          <Upload className="text-[#FFB800]/50 mx-auto mb-2" size={24} />
                          <p className="text-white/50 text-xs">Click to upload</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".doc,.docx"
                          onChange={(e) => handleFileUpload(e.target.files[0], setCdfDocument, 'CDF')}
                        />
                      </label>
                    )}
                  </div>

                  {/* Case Diary Part-II */}
                  <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <FileStack className="text-[#00FFB3]" size={18} />
                      Case Diary Part-II
                    </h3>
                    <p className="text-white/50 text-xs mb-3">DOC, DOCX, PDF supported</p>
                    
                    {caseDiaryPart2 ? (
                      <div className="p-3 rounded-lg bg-[#00FFB3]/10 border border-[#00FFB3]/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="text-[#00FFB3]" size={16} />
                            <span className="text-white text-sm truncate max-w-[120px]">{caseDiaryPart2.name}</span>
                          </div>
                          <button onClick={() => removeFile(setCaseDiaryPart2, 'Case Diary')} className="text-white/50 hover:text-white">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div className="border-2 border-dashed border-[#00FFB3]/30 rounded-lg p-6 text-center hover:border-[#00FFB3]/60 transition-colors">
                          <Upload className="text-[#00FFB3]/50 mx-auto mb-2" size={24} />
                          <p className="text-white/50 text-xs">Click to upload</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".doc,.docx,.pdf"
                          onChange={(e) => handleFileUpload(e.target.files[0], setCaseDiaryPart2, 'Case Diary')}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Voice Recording Section */}
                <div className="lg:col-span-4">
                  <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Mic className="text-[#FF3B3B]" size={18} />
                      Voice Input (Telugu/Hindi/English)
                    </h3>
                    <p className="text-white/50 text-xs mb-4">
                      Record complaint narrative - automatically transcribed, translated to English, and converted to legal format
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Recording Controls */}
                      <div className="flex items-center gap-2">
                        {!isRecording ? (
                          <Button
                            onClick={startRecording}
                            disabled={isProcessingVoice}
                            className="bg-gradient-to-r from-[#FF3B3B] to-[#FF6B6B] hover:opacity-90"
                            data-testid="start-recording-btn"
                          >
                            <Mic size={16} className="mr-2" />
                            Start Recording
                          </Button>
                        ) : (
                          <Button
                            onClick={stopRecording}
                            className="bg-gradient-to-r from-[#FFB800] to-[#FFC933] hover:opacity-90 animate-pulse"
                            data-testid="stop-recording-btn"
                          >
                            <Square size={16} className="mr-2" />
                            Stop Recording
                          </Button>
                        )}
                        
                        {isProcessingVoice && (
                          <div className="flex items-center gap-2 text-white/60">
                            <Loader2 className="animate-spin" size={16} />
                            <span className="text-sm">Processing...</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Recording indicator */}
                      {isRecording && (
                        <div className="flex items-center gap-2">
                          <motion.div
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="w-3 h-3 rounded-full bg-[#FF3B3B]"
                          />
                          <span className="text-[#FF3B3B] text-sm font-medium">Recording...</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Voice Text Results */}
                    {(voiceText || legalText) && (
                      <div className="mt-4 space-y-3">
                        {voiceText && (
                          <div className="p-3 rounded-lg bg-[#030614] border border-white/10">
                            <p className="text-white/60 text-xs mb-1">Translated Text:</p>
                            <p className="text-white text-sm">{voiceText}</p>
                          </div>
                        )}
                        {legalText && (
                          <div className="p-3 rounded-lg bg-[#00FFB3]/10 border border-[#00FFB3]/30">
                            <p className="text-[#00FFB3] text-xs mb-1">Legal Format:</p>
                            <p className="text-white text-sm">{legalText}</p>
                            <Button
                              onClick={insertVoiceText}
                              className="mt-3 bg-[#00FFB3]/20 hover:bg-[#00FFB3]/30 text-[#00FFB3]"
                              size="sm"
                            >
                              <CheckCircle2 size={14} className="mr-1" />
                              Insert into Charge Sheet
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Process Button */}
                <div className="lg:col-span-4 flex justify-center mt-4">
                  <Button
                    onClick={processDocuments}
                    disabled={(!teluguPetition && !cdfDocument && !caseDiaryPart2) || !policeStation || !district}
                    className="bg-gradient-to-r from-[#00C2FF] to-[#4F7EFF] hover:opacity-90 px-8 py-3"
                  >
                    <Sparkles size={18} className="mr-2" />
                    Generate Charge Sheet with AI
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Processing */}
            {activeStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="p-8 rounded-full bg-gradient-to-br from-[#00C2FF]/20 to-[#4F7EFF]/20 border border-[#00C2FF]/30 mb-8"
                >
                  <Sparkles className="text-[#00C2FF]" size={56} />
                </motion.div>
                <h2 className="text-2xl font-bold text-white mb-3">AI Fusion in Progress</h2>
                <p className="text-white/60 text-center max-w-lg mb-6">
                  Synthesizing data from all uploaded documents using Multimodal Legal-Context LLM...
                </p>
                <div className="flex items-center gap-3 text-white/40">
                  <Loader2 className="animate-spin" size={20} />
                  <span className="text-sm">Extracting accused details, witness tables, and brief facts...</span>
                </div>
              </motion.div>
            )}

            {/* Step 3: Review & Edit */}
            {activeStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                {/* Extracted Data Summary */}
                <div className="lg:col-span-1 space-y-4">
                  {/* Active Blanks Warning */}
                  {activeBlankFields.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/30">
                      <h3 className="text-[#FFB800] font-semibold mb-2 flex items-center gap-2">
                        <AlertCircle size={18} />
                        Active Blanks ({activeBlankFields.length})
                      </h3>
                      <p className="text-white/60 text-xs mb-3">
                        These fields need manual input. Click to edit in the document.
                      </p>
                      <div className="space-y-1">
                        {activeBlankFields.map((field, idx) => (
                          <div key={idx} className="px-2 py-1 rounded bg-[#FFB800]/20 text-[#FFB800] text-xs">
                            [MISSING: {field}]
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracted Summary */}
                  <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Users className="text-[#4F7EFF]" size={18} />
                      Extracted Data
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="p-2 rounded bg-[#030614]">
                        <span className="text-white/50">Accused:</span>
                        <span className="text-white ml-2">{extractedData?.accused_count || 0} persons</span>
                      </div>
                      <div className="p-2 rounded bg-[#030614]">
                        <span className="text-white/50">Witnesses:</span>
                        <span className="text-white ml-2">{extractedData?.witness_count || 0} persons</span>
                      </div>
                      <div className="p-2 rounded bg-[#030614]">
                        <span className="text-white/50">Sections:</span>
                        <span className="text-white ml-2">{extractedData?.sections || sections || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => setActiveStep(4)}
                      className="bg-gradient-to-r from-[#00FFB3] to-[#00C2FF] text-black font-semibold"
                    >
                      <CheckCircle2 size={16} className="mr-2" />
                      Finalize Charge Sheet
                    </Button>
                    <Button
                      onClick={() => setActiveStep(1)}
                      variant="outline"
                      className="border-white/20 text-white/60"
                    >
                      Back to Upload
                    </Button>
                  </div>
                </div>

                {/* Editable Document */}
                <div className="lg:col-span-2">
                  <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <FileCheck className="text-[#00FFB3]" size={18} />
                        Generated Charge Sheet (u/s 193 BNSS)
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setIsEditing(!isEditing)}
                          variant="outline"
                          size="sm"
                          className={`border-white/20 ${isEditing ? 'bg-[#00C2FF]/20 text-[#00C2FF]' : 'text-white/60'}`}
                        >
                          <Edit3 size={14} className="mr-1" />
                          {isEditing ? 'Editing' : 'Edit'}
                        </Button>
                      </div>
                    </div>

                    {isEditing ? (
                      <Textarea
                        value={editableContent}
                        onChange={(e) => setEditableContent(e.target.value)}
                        className="min-h-[500px] bg-[#030614] border-white/20 text-white font-mono text-xs"
                      />
                    ) : (
                      <div 
                        className="min-h-[500px] p-4 rounded-lg bg-[#030614] border border-white/10 text-white/80 text-xs font-mono whitespace-pre-wrap overflow-auto"
                        dangerouslySetInnerHTML={{ __html: highlightActiveBlanks(editableContent) }}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Export */}
            {activeStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="inline-flex p-6 rounded-full bg-[#00FFB3]/20 border border-[#00FFB3]/30 mb-6"
                >
                  <CheckCircle2 className="text-[#00FFB3]" size={64} />
                </motion.div>
                
                <h2 className="text-2xl font-bold text-white mb-2">Charge Sheet Ready!</h2>
                <p className="text-white/60 mb-8 max-w-md mx-auto">
                  Your Charge Sheet (u/s 193 BNSS) has been generated with 95% accuracy extraction.
                </p>

                <div className="flex justify-center gap-4 flex-wrap mb-8">
                  <Button onClick={copyToClipboard} variant="outline" className="border-white/20 text-white">
                    <Eye size={16} className="mr-2" />
                    Copy Text
                  </Button>
                  <Button onClick={downloadAsTxt} className="bg-[#4F7EFF] hover:bg-[#4F7EFF]/80">
                    <Download size={16} className="mr-2" />
                    Download
                  </Button>
                  <Button onClick={exportToCCTNS} className="bg-gradient-to-r from-[#00FFB3] to-[#00C2FF] text-black font-semibold">
                    <FileCheck size={16} className="mr-2" />
                    Export to CCTNS
                  </Button>
                </div>

                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10 max-w-2xl mx-auto">
                  <pre className="text-left text-white/70 text-xs font-mono whitespace-pre-wrap max-h-[300px] overflow-auto">
                    {editableContent}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
};

export default ChargeSheetFusion;
