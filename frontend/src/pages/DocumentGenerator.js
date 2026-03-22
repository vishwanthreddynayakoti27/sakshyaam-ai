import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  FileCheck, 
  Download, 
  Copy, 
  Printer,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  FileStack,
  Scale
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import api from '../utils/api';

const DocumentGenerator = () => {
  const [caseContexts, setCaseContexts] = useState([]);
  const [selectedContext, setSelectedContext] = useState(null);
  const [documentType, setDocumentType] = useState('charge_sheet');
  const [generatedDocument, setGeneratedDocument] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingContexts, setIsLoadingContexts] = useState(true);

  // Form fields for additional inputs
  const [entryNumber, setEntryNumber] = useState(1);
  const [investigationProgress, setInvestigationProgress] = useState('');
  const [accusedSerial, setAccusedSerial] = useState('A1');
  const [groundsForRemand, setGroundsForRemand] = useState('');
  const [evidenceId, setEvidenceId] = useState('');

  const documentTypes = [
    { id: 'charge_sheet', name: 'Charge Sheet (Sec 193 BNSS)', icon: FileCheck, color: '#00FFB3' },
    { id: 'case_diary', name: 'Case Diary (Sec 172 BNSS)', icon: BookOpen, color: '#00C2FF' },
    { id: 'remand_report', name: 'Remand Report', icon: Scale, color: '#FFB800' },
    { id: 'bsa_63', name: 'BSA Sec 63 Certificate', icon: FileStack, color: '#4F7EFF' }
  ];

  useEffect(() => {
    loadCaseContexts();
  }, []);

  const loadCaseContexts = async () => {
    try {
      const response = await api.get('/api/case-context/list');
      setCaseContexts(response.data);
      if (response.data.length > 0) {
        setSelectedContext(response.data[0]);
      }
    } catch (error) {
      console.error('Error loading case contexts:', error);
      toast.error('Failed to load case contexts');
    } finally {
      setIsLoadingContexts(false);
    }
  };

  const generateDocument = async () => {
    if (!selectedContext) {
      toast.error('Please select a case context');
      return;
    }

    setIsLoading(true);
    setGeneratedDocument(null);

    try {
      let response;
      const contextId = selectedContext.id;

      switch (documentType) {
        case 'charge_sheet':
          response = await api.post(`/api/documents/${contextId}/charge-sheet`);
          break;
        case 'case_diary':
          const cdFormData = new FormData();
          cdFormData.append('entry_number', entryNumber);
          cdFormData.append('investigation_progress', investigationProgress);
          response = await api.post(`/api/documents/${contextId}/case-diary`, cdFormData);
          break;
        case 'remand_report':
          const remandFormData = new FormData();
          remandFormData.append('accused_serial', accusedSerial);
          remandFormData.append('grounds_for_remand', groundsForRemand);
          response = await api.post(`/api/documents/${contextId}/remand-report`, remandFormData);
          break;
        case 'bsa_63':
          if (!evidenceId) {
            toast.error('Please enter an evidence ID');
            setIsLoading(false);
            return;
          }
          const bsaFormData = new FormData();
          bsaFormData.append('evidence_id', evidenceId);
          response = await api.post(`/api/documents/${contextId}/bsa-63-certificate`, bsaFormData);
          break;
        default:
          throw new Error('Unknown document type');
      }

      setGeneratedDocument(response.data);
      toast.success('Document generated successfully!');
    } catch (error) {
      console.error('Error generating document:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate document');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedDocument?.content) {
      navigator.clipboard.writeText(generatedDocument.content);
      toast.success('Copied to clipboard!');
    }
  };

  const downloadAsTxt = () => {
    if (generatedDocument?.content) {
      const blob = new Blob([generatedDocument.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentType}_${selectedContext?.fir_number || 'document'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Document downloaded!');
    }
  };

  const printDocument = () => {
    if (generatedDocument?.content) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>${generatedDocument.document_type}</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; white-space: pre-wrap; }
            </style>
          </head>
          <body>${generatedDocument.content}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="min-h-screen bg-[#030614] p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#4F7EFF]/20 to-[#00C2FF]/20 border border-[#4F7EFF]/30">
            <FileCheck className="text-[#4F7EFF]" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Document Generator</h1>
            <p className="text-white/60 text-sm">Auto-generate Charge Sheets, Case Diaries & Certificates</p>
          </div>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Settings */}
        <div className="space-y-4">
          {/* Case Context Selection */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <FileStack className="text-[#00C2FF]" size={18} />
              Select Case Context
            </h3>
            
            {isLoadingContexts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-[#00C2FF]" size={24} />
              </div>
            ) : caseContexts.length === 0 ? (
              <div className="text-center py-4">
                <AlertCircle className="text-[#FFB800] mx-auto mb-2" size={24} />
                <p className="text-white/60 text-sm">No case contexts found</p>
                <Button
                  onClick={() => window.location.href = '/unified-pipeline'}
                  className="mt-3 bg-[#00C2FF]/20 text-[#00C2FF] hover:bg-[#00C2FF]/30"
                  size="sm"
                >
                  Create New Case
                </Button>
              </div>
            ) : (
              <select
                value={selectedContext?.id || ''}
                onChange={(e) => {
                  const ctx = caseContexts.find(c => c.id === e.target.value);
                  setSelectedContext(ctx);
                }}
                className="w-full p-3 rounded-lg bg-[#030614] border border-white/20 text-white text-sm"
              >
                {caseContexts.map(ctx => (
                  <option key={ctx.id} value={ctx.id}>
                    {ctx.fir_number || 'No FIR'} - {ctx.police_station} ({ctx.status})
                  </option>
                ))}
              </select>
            )}

            {selectedContext && (
              <div className="mt-3 p-3 rounded-lg bg-[#030614] border border-white/10 text-xs">
                <div className="grid grid-cols-2 gap-2 text-white/60">
                  <div>FIR: <span className="text-white">{selectedContext.fir_number || '-'}</span></div>
                  <div>PS: <span className="text-white">{selectedContext.police_station}</span></div>
                  <div>District: <span className="text-white">{selectedContext.district}</span></div>
                  <div>Status: <span className="text-[#00FFB3]">{selectedContext.status}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Document Type Selection */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-3">Document Type</h3>
            <div className="space-y-2">
              {documentTypes.map(doc => {
                const Icon = doc.icon;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setDocumentType(doc.id)}
                    className={`w-full p-3 rounded-lg border transition-all flex items-center gap-3 ${
                      documentType === doc.id
                        ? 'border-[#00C2FF] bg-[#00C2FF]/10'
                        : 'border-white/10 bg-[#030614] hover:border-white/30'
                    }`}
                  >
                    <Icon style={{ color: doc.color }} size={20} />
                    <span className={`text-sm ${documentType === doc.id ? 'text-white' : 'text-white/70'}`}>
                      {doc.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional Fields based on document type */}
          {documentType === 'case_diary' && (
            <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
              <h3 className="text-white font-semibold mb-3">Case Diary Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Entry Number</label>
                  <Input
                    type="number"
                    value={entryNumber}
                    onChange={(e) => setEntryNumber(parseInt(e.target.value))}
                    className="bg-[#030614] border-white/20 text-white"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Investigation Progress</label>
                  <Textarea
                    value={investigationProgress}
                    onChange={(e) => setInvestigationProgress(e.target.value)}
                    placeholder="Describe today's investigation activities..."
                    className="bg-[#030614] border-white/20 text-white min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          )}

          {documentType === 'remand_report' && (
            <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
              <h3 className="text-white font-semibold mb-3">Remand Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Accused Serial (A1, A2, etc.)</label>
                  <Input
                    value={accusedSerial}
                    onChange={(e) => setAccusedSerial(e.target.value)}
                    placeholder="A1"
                    className="bg-[#030614] border-white/20 text-white"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Custom Grounds (Optional)</label>
                  <Textarea
                    value={groundsForRemand}
                    onChange={(e) => setGroundsForRemand(e.target.value)}
                    placeholder="Leave empty to use standard grounds..."
                    className="bg-[#030614] border-white/20 text-white min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          )}

          {documentType === 'bsa_63' && (
            <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
              <h3 className="text-white font-semibold mb-3">BSA Certificate Details</h3>
              <div>
                <label className="text-white/60 text-xs mb-1 block">Evidence ID</label>
                <Input
                  value={evidenceId}
                  onChange={(e) => setEvidenceId(e.target.value)}
                  placeholder="Enter evidence ID from Evidence Manager"
                  className="bg-[#030614] border-white/20 text-white"
                />
              </div>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={generateDocument}
            disabled={isLoading || !selectedContext}
            className="w-full bg-gradient-to-r from-[#00FFB3] to-[#00C2FF] text-black font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Generating...
              </>
            ) : (
              <>
                <FileCheck size={18} className="mr-2" />
                Generate Document
              </>
            )}
          </Button>
        </div>

        {/* Right Panel - Generated Document */}
        <div className="lg:col-span-2">
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FileText className="text-[#00FFB3]" size={18} />
                Generated Document
              </h3>
              
              {generatedDocument && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white/60 hover:text-white"
                  >
                    <Copy size={14} className="mr-1" />
                    Copy
                  </Button>
                  <Button
                    onClick={downloadAsTxt}
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white/60 hover:text-white"
                  >
                    <Download size={14} className="mr-1" />
                    Download
                  </Button>
                  <Button
                    onClick={printDocument}
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white/60 hover:text-white"
                  >
                    <Printer size={14} className="mr-1" />
                    Print
                  </Button>
                </div>
              )}
            </div>

            {generatedDocument ? (
              <div className="relative">
                {generatedDocument.editable_fields && (
                  <div className="mb-3 p-3 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30">
                    <p className="text-[#FFB800] text-xs font-semibold mb-1">
                      Editable Fields (Highlighted)
                    </p>
                    <p className="text-white/60 text-xs">
                      {generatedDocument.editable_fields.join(', ')}
                    </p>
                  </div>
                )}
                
                <pre className="p-4 rounded-lg bg-[#030614] border border-white/10 text-white/80 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[600px]">
                  {generatedDocument.content}
                </pre>
                
                <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
                  <CheckCircle2 className="text-[#00FFB3]" size={14} />
                  <span>Document Type: {generatedDocument.document_type}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="text-white/20 mb-4" size={64} />
                <p className="text-white/40 mb-2">No document generated yet</p>
                <p className="text-white/30 text-sm">
                  Select a case context and document type, then click Generate
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentGenerator;
