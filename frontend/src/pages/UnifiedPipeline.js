import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  Mic, 
  Languages, 
  Users, 
  Scale, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Loader2,
  Plus,
  X,
  Phone,
  Car,
  Calendar,
  MapPin,
  User,
  FileStack,
  ArrowRight,
  Sparkles
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

const UnifiedPipeline = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [caseContext, setCaseContext] = useState(null);
  
  // Input state
  const [inputType, setInputType] = useState('text'); // text, file, voice
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  
  // Extracted data state
  const [extractedData, setExtractedData] = useState(null);
  const [suggestedSections, setSuggestedSections] = useState([]);
  
  // Case details
  const [policeStation, setPoliceStation] = useState('');
  const [district, setDistrict] = useState('');
  const [firNumber, setFirNumber] = useState('');

  const steps = [
    { number: 1, title: 'Input Petition', icon: FileText, color: '#00C2FF' },
    { number: 2, title: 'AI Processing', icon: Sparkles, color: '#4F7EFF' },
    { number: 3, title: 'Review & Edit', icon: Users, color: '#00FFB3' },
    { number: 4, title: 'Case Context', icon: Scale, color: '#FFB800' }
  ];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      toast.success(`File selected: ${file.name}`);
    }
  };

  const createCaseContext = async () => {
    try {
      const response = await api.post('/case-context/create', {
        fir_number: firNumber,
        police_station: policeStation,
        district: district,
        offense_type: extractedData?.entities?.offense_details?.type || ''
      });
      setCaseContext(response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating case context:', error);
      throw error;
    }
  };

  const processPetition = async () => {
    if (!inputText && !selectedFile) {
      toast.error('Please enter text or upload a file');
      return;
    }

    setIsProcessing(true);
    setActiveStep(2);

    try {
      // First create or get case context
      let context = caseContext;
      if (!context) {
        context = await createCaseContext();
      }

      // Process the petition
      const formData = new FormData();
      formData.append('text', inputText);
      formData.append('source_language', sourceLanguage);

      const response = await api.post(
        `/case-context/${context.id}/process-petition`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setExtractedData(response.data);
      setSuggestedSections(response.data.suggested_sections || []);
      
      // Update case context with new data
      setCaseContext(prev => ({
        ...prev,
        translated_facts: response.data.translation,
        legal_facts: response.data.legal_text
      }));

      setActiveStep(3);
      toast.success('Petition processed successfully!');
    } catch (error) {
      console.error('Error processing petition:', error);
      toast.error(getErrorMessage(error, 'Failed to process petition'));
      setActiveStep(1);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeCaseContext = () => {
    setActiveStep(4);
    toast.success('Case Context created! You can now generate documents.');
  };

  return (
    <Layout>
    <div className="min-h-screen bg-[#030614] p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#00FFB3]/20 to-[#00C2FF]/20 border border-[#00FFB3]/30">
            <Sparkles className="text-[#00FFB3]" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Unified Intelligence Pipeline</h1>
            <p className="text-white/60 text-sm">Single-source entry for automated investigation workflow</p>
          </div>
        </motion.div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = activeStep === step.number;
            const isCompleted = activeStep > step.number;
            
            return (
              <React.Fragment key={step.number}>
                <motion.div
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-all ${
                    isActive 
                      ? 'bg-gradient-to-r from-[#00C2FF]/20 to-[#4F7EFF]/20 border-[#00C2FF]' 
                      : isCompleted 
                        ? 'bg-[#00FFB3]/10 border-[#00FFB3]/50' 
                        : 'bg-[#0B0F1A] border-white/10'
                  }`}
                  animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                >
                  <div 
                    className={`p-2 rounded-lg ${
                      isCompleted ? 'bg-[#00FFB3]/20' : `bg-[${step.color}]/20`
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="text-[#00FFB3]" size={20} />
                    ) : (
                      <Icon style={{ color: step.color }} size={20} />
                    )}
                  </div>
                  <div>
                    <p className={`text-xs ${isActive || isCompleted ? 'text-white' : 'text-white/50'}`}>
                      Step {step.number}
                    </p>
                    <p className={`text-sm font-medium ${isActive ? 'text-[#00C2FF]' : isCompleted ? 'text-[#00FFB3]' : 'text-white/70'}`}>
                      {step.title}
                    </p>
                  </div>
                </motion.div>
                {index < steps.length - 1 && (
                  <ChevronRight className={`${activeStep > step.number ? 'text-[#00FFB3]' : 'text-white/20'}`} size={20} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          {/* Step 1: Input Petition */}
          {activeStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
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
                      <label className="text-white/60 text-xs mb-1 block">Police Station</label>
                      <Input
                        value={policeStation}
                        onChange={(e) => setPoliceStation(e.target.value)}
                        placeholder="e.g., Makthal PS"
                        className="bg-[#030614] border-white/20 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-white/60 text-xs mb-1 block">District</label>
                      <Input
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder="e.g., Narayanpet"
                        className="bg-[#030614] border-white/20 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-white/60 text-xs mb-1 block">FIR Number (Optional)</label>
                      <Input
                        value={firNumber}
                        onChange={(e) => setFirNumber(e.target.value)}
                        placeholder="e.g., 156/2025"
                        className="bg-[#030614] border-white/20 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Input Type Selection */}
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                  <h3 className="text-white font-semibold mb-4">Input Type</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'text', icon: FileText, label: 'Text' },
                      { type: 'file', icon: Upload, label: 'File' },
                      { type: 'voice', icon: Mic, label: 'Voice' }
                    ].map(({ type, icon: Icon, label }) => (
                      <button
                        key={type}
                        onClick={() => setInputType(type)}
                        className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                          inputType === type 
                            ? 'bg-[#00C2FF]/20 border-[#00C2FF] text-[#00C2FF]' 
                            : 'bg-[#030614] border-white/20 text-white/60 hover:border-white/40'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language Selection */}
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Languages className="text-[#4F7EFF]" size={18} />
                    Source Language
                  </h3>
                  <select
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    className="w-full p-2 rounded-lg bg-[#030614] border border-white/20 text-white text-sm"
                  >
                    <option value="auto">Auto-Detect</option>
                    <option value="te">Telugu</option>
                    <option value="hi">Hindi</option>
                    <option value="en">English</option>
                    <option value="ur">Urdu</option>
                    <option value="ta">Tamil</option>
                    <option value="kn">Kannada</option>
                  </select>
                </div>
              </div>

              {/* Input Area */}
              <div className="lg:col-span-2">
                <div className="p-6 rounded-xl bg-[#0B0F1A] border border-white/10 h-full">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <FileText className="text-[#00FFB3]" size={18} />
                    Enter Petition / Complaint
                  </h3>

                  {inputType === 'text' && (
                    <Textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Paste or type the petition/complaint text here...&#10;&#10;Example: నేను శ్రీనివాసరావు, వయసు 35 సంవత్సరాలు. నేను 2025 జనవరి 15న నా మొబైల్ ఫోన్ కోల్పోయాను..."
                      className="min-h-[300px] bg-[#030614] border-white/20 text-white placeholder:text-white/30"
                    />
                  )}

                  {inputType === 'file' && (
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                      {selectedFile ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl bg-[#00FFB3]/10 border border-[#00FFB3]/30">
                            <FileText className="text-[#00FFB3] mx-auto mb-2" size={32} />
                            <p className="text-white font-medium">{selectedFile.name}</p>
                            <p className="text-white/50 text-sm">
                              {(selectedFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedFile(null)}
                            className="border-white/20 text-white/60"
                          >
                            <X size={16} className="mr-2" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="text-white/30 mb-4" size={48} />
                          <p className="text-white/60 mb-2">
                            Drag & drop a petition file (PDF, JPG, PNG)
                          </p>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.docx"
                              onChange={handleFileUpload}
                            />
                            <span className="px-4 py-2 rounded-lg bg-[#00C2FF]/20 text-[#00C2FF] hover:bg-[#00C2FF]/30 transition-colors">
                              Browse Files
                            </span>
                          </label>
                        </>
                      )}
                    </div>
                  )}

                  {inputType === 'voice' && (
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="p-6 rounded-full bg-[#FF3B3B]/20 border border-[#FF3B3B]/30 mb-4"
                      >
                        <Mic className="text-[#FF3B3B]" size={48} />
                      </motion.div>
                      <p className="text-white/60 mb-4">
                        Click to start recording voice statement
                      </p>
                      <Button className="bg-[#FF3B3B] hover:bg-[#FF3B3B]/80">
                        <Mic size={16} className="mr-2" />
                        Start Recording
                      </Button>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={processPetition}
                      disabled={(!inputText && !selectedFile) || !policeStation || !district}
                      className="bg-gradient-to-r from-[#00C2FF] to-[#4F7EFF] hover:opacity-90 px-6"
                    >
                      Process with Legal AI
                      <ArrowRight size={16} className="ml-2" />
                    </Button>
                  </div>
                </div>
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
                className="p-6 rounded-full bg-gradient-to-br from-[#00C2FF]/20 to-[#4F7EFF]/20 border border-[#00C2FF]/30 mb-6"
              >
                <Sparkles className="text-[#00C2FF]" size={48} />
              </motion.div>
              <h2 className="text-xl font-bold text-white mb-2">Processing with GPT-5.2 Legal AI</h2>
              <p className="text-white/60 text-center max-w-md">
                Translating, extracting entities, and analyzing applicable BNS sections...
              </p>
              <div className="mt-8 flex items-center gap-3">
                <Loader2 className="animate-spin text-[#00C2FF]" size={20} />
                <span className="text-white/60 text-sm">This may take a few seconds...</span>
              </div>
            </motion.div>
          )}

          {/* Step 3: Review & Edit */}
          {activeStep === 3 && extractedData && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Translation Results */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Languages className="text-[#00C2FF]" size={18} />
                    Translated Legal Text
                  </h3>
                  <div className="p-4 rounded-lg bg-[#030614] border border-[#00C2FF]/20 max-h-[300px] overflow-y-auto">
                    <p className="text-white/80 text-sm whitespace-pre-wrap">
                      {extractedData.legal_text || extractedData.translation || 'No translation available'}
                    </p>
                  </div>
                </div>

                {/* Suggested Sections */}
                {suggestedSections.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Scale className="text-[#00FFB3]" size={18} />
                      Suggested BNS Sections
                    </h3>
                    <div className="space-y-2">
                      {suggestedSections.map((section, idx) => (
                        <div 
                          key={idx}
                          className="p-3 rounded-lg bg-[#030614] border border-[#00FFB3]/20"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-[#00FFB3]">{section.section}</span>
                            <span className="text-xs text-white/40">{section.equivalent}</span>
                          </div>
                          <p className="text-white font-medium text-sm">{section.title}</p>
                          <p className="text-white/60 text-xs mt-1">{section.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Extracted Entities */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Users className="text-[#4F7EFF]" size={18} />
                    Extracted Entities
                  </h3>
                  
                  {extractedData.entities && (
                    <div className="space-y-4">
                      {/* Complainant */}
                      {extractedData.entities.complainant && (
                        <div className="p-3 rounded-lg bg-[#030614] border border-white/10">
                          <p className="text-xs text-[#00C2FF] font-semibold mb-2">COMPLAINANT</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-white/50">Name:</span>
                              <span className="text-white ml-2">{extractedData.entities.complainant.name || '-'}</span>
                            </div>
                            <div>
                              <span className="text-white/50">Phone:</span>
                              <span className="text-white ml-2">{extractedData.entities.complainant.phone || '-'}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-white/50">Address:</span>
                              <span className="text-white ml-2">{extractedData.entities.complainant.address || '-'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Accused */}
                      {extractedData.entities.accused_persons?.length > 0 && (
                        <div className="p-3 rounded-lg bg-[#030614] border border-[#FF3B3B]/20">
                          <p className="text-xs text-[#FF3B3B] font-semibold mb-2">ACCUSED PERSONS</p>
                          {extractedData.entities.accused_persons.map((acc, idx) => (
                            <div key={idx} className="text-sm mb-2">
                              <span className="text-white font-medium">{acc.serial || `A${idx+1}`}.</span>
                              <span className="text-white/80 ml-2">{acc.name || 'Unknown'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Phone Numbers */}
                      {extractedData.entities.phone_numbers?.length > 0 && (
                        <div className="p-3 rounded-lg bg-[#030614] border border-white/10">
                          <p className="text-xs text-[#FFB800] font-semibold mb-2 flex items-center gap-1">
                            <Phone size={12} /> PHONE NUMBERS
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {extractedData.entities.phone_numbers.map((phone, idx) => (
                              <span key={idx} className="px-2 py-1 rounded bg-[#FFB800]/20 text-[#FFB800] text-xs">
                                {phone}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vehicle Details */}
                      {extractedData.entities.vehicle_details?.length > 0 && (
                        <div className="p-3 rounded-lg bg-[#030614] border border-white/10">
                          <p className="text-xs text-[#4F7EFF] font-semibold mb-2 flex items-center gap-1">
                            <Car size={12} /> VEHICLE DETAILS
                          </p>
                          {extractedData.entities.vehicle_details.map((vehicle, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="text-white">{vehicle.number || vehicle.type || 'Unknown'}</span>
                              {vehicle.color && <span className="text-white/50 ml-2">({vehicle.color})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setActiveStep(1)}
                    className="border-white/20 text-white/60"
                  >
                    Back to Edit
                  </Button>
                  <Button
                    onClick={finalizeCaseContext}
                    className="bg-gradient-to-r from-[#00FFB3] to-[#00C2FF] text-black font-semibold"
                  >
                    Create Case Context
                    <CheckCircle2 size={16} className="ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Case Context Created */}
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
              
              <h2 className="text-2xl font-bold text-white mb-2">Global Case Context Created!</h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto">
                Your case data is now shared across all tools. Generate documents, manage evidence, and export to CCTNS.
              </p>

              <div className="flex justify-center gap-4 flex-wrap">
                <Button
                  onClick={() => navigate('/document-generator')}
                  className="bg-[#4F7EFF] hover:bg-[#4F7EFF]/80"
                >
                  <FileText size={16} className="mr-2" />
                  Generate Charge Sheet
                </Button>
                <Button
                  onClick={() => navigate('/evidence-hash')}
                  className="bg-[#FFB800] hover:bg-[#FFB800]/80 text-black"
                >
                  <Upload size={16} className="mr-2" />
                  Upload Evidence
                </Button>
                <Button
                  onClick={() => navigate('/cctns-bridge')}
                  className="bg-[#00C2FF] hover:bg-[#00C2FF]/80 text-black"
                >
                  <ArrowRight size={16} className="mr-2" />
                  Export to CCTNS
                </Button>
              </div>

              {caseContext && (
                <div className="mt-8 p-4 rounded-xl bg-[#0B0F1A] border border-white/10 max-w-md mx-auto">
                  <p className="text-white/50 text-xs mb-2">CASE CONTEXT ID</p>
                  <p className="text-[#00C2FF] font-mono text-sm">{caseContext.id}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </Layout>
  );
};

export default UnifiedPipeline;
