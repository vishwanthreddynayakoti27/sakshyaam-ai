import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Upload, 
  Hash, 
  FileCheck, 
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Copy,
  Download,
  Trash2,
  Eye
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import api from '../utils/api';

const EvidenceHash = () => {
  const [caseContexts, setCaseContexts] = useState([]);
  const [selectedContext, setSelectedContext] = useState(null);
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Upload form
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [seizedFrom, setSeizedFrom] = useState('');
  const [seizureDate, setSeizureDate] = useState('');

  // Hash verification
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyEvidenceId, setVerifyEvidenceId] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Quick hash
  const [quickHashFile, setQuickHashFile] = useState(null);
  const [quickHashResult, setQuickHashResult] = useState(null);
  const [isHashing, setIsHashing] = useState(false);

  useEffect(() => {
    loadCaseContexts();
  }, []);

  useEffect(() => {
    if (selectedContext) {
      loadEvidence();
    }
  }, [selectedContext]);

  const loadCaseContexts = async () => {
    try {
      const response = await api.get('/case-context/list');
      setCaseContexts(response.data);
      if (response.data.length > 0) {
        setSelectedContext(response.data[0]);
      }
    } catch (error) {
      console.error('Error loading case contexts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvidence = async () => {
    if (!selectedContext) return;
    
    try {
      const response = await api.get(`/evidence/${selectedContext.id}/list`);
      setEvidenceItems(response.data.evidence_items || []);
    } catch (error) {
      console.error('Error loading evidence:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadEvidence = async () => {
    if (!selectedFile || !selectedContext) {
      toast.error('Please select a file and case context');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('context_id', selectedContext.id);
      formData.append('description', description);
      formData.append('seized_from', seizedFrom || selectedContext.complainant_name || '');
      formData.append('seizure_date', seizureDate || new Date().toLocaleDateString());

      const response = await api.post('/evidence/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Evidence uploaded and hashed!');
      
      // Reset form
      setSelectedFile(null);
      setDescription('');
      setSeizedFrom('');
      setSeizureDate('');
      
      // Reload evidence
      loadEvidence();

      // Show hash
      toast.info(`SHA-256: ${response.data.sha256_hash.substring(0, 32)}...`);
    } catch (error) {
      console.error('Error uploading evidence:', error);
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const verifyHash = async () => {
    if (!verifyFile || !verifyEvidenceId) {
      toast.error('Please select a file and enter evidence ID');
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const formData = new FormData();
      formData.append('file', verifyFile);

      const response = await api.post(`/evidence/${verifyEvidenceId}/verify-hash`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setVerificationResult(response.data);
      
      if (response.data.is_valid) {
        toast.success('Integrity Verified!');
      } else {
        toast.error('Integrity Check Failed!');
      }
    } catch (error) {
      console.error('Error verifying hash:', error);
      toast.error(error.response?.data?.detail || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const computeQuickHash = async () => {
    if (!quickHashFile) {
      toast.error('Please select a file');
      return;
    }

    setIsHashing(true);
    setQuickHashResult(null);

    try {
      const formData = new FormData();
      formData.append('file', quickHashFile);

      const response = await api.post('/evidence/compute-hash', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setQuickHashResult(response.data);
      toast.success('Hash computed!');
    } catch (error) {
      console.error('Error computing hash:', error);
      toast.error('Hash computation failed');
    } finally {
      setIsHashing(false);
    }
  };

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    toast.success('Hash copied to clipboard!');
  };

  const generateBSACertificate = async (evidenceId) => {
    try {
      const formData = new FormData();
      formData.append('evidence_id', evidenceId);

      const response = await api.post(`/documents/${selectedContext.id}/bsa-63-certificate`, formData);
      
      // Open certificate in new window for printing
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>BSA Section 63 Certificate</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 12px; padding: 40px; white-space: pre-wrap; }
            </style>
          </head>
          <body>${response.data.content}</body>
        </html>
      `);
      printWindow.document.close();
      
      toast.success('BSA Sec 63 Certificate generated!');
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast.error('Failed to generate certificate');
    }
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
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#FFB800]/20 to-[#FF3B3B]/20 border border-[#FFB800]/30">
            <Package className="text-[#FFB800]" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Evidence & Hash Manager</h1>
            <p className="text-white/60 text-sm">Upload evidence, compute SHA-256 hashes, generate BSA Sec 63 certificates</p>
          </div>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Upload & Hash */}
        <div className="space-y-4">
          {/* Case Context Selection */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Shield className="text-[#00C2FF]" size={18} />
              Case Context
            </h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin text-[#00C2FF]" size={24} />
              </div>
            ) : caseContexts.length === 0 ? (
              <div className="text-center py-4">
                <AlertCircle className="text-[#FFB800] mx-auto mb-2" size={24} />
                <p className="text-white/60 text-sm">No case contexts found</p>
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
                    {ctx.fir_number || 'No FIR'} - {ctx.police_station}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Upload Evidence */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Upload className="text-[#00FFB3]" size={18} />
              Upload Evidence
            </h3>
            
            <div className="space-y-3">
              <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center">
                {selectedFile ? (
                  <div>
                    <FileCheck className="text-[#00FFB3] mx-auto mb-2" size={24} />
                    <p className="text-white text-sm">{selectedFile.name}</p>
                    <p className="text-white/50 text-xs">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="text-white/30 mx-auto mb-2" size={24} />
                    <p className="text-white/50 text-sm">Click to select file</p>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., CCTV footage from shop"
                  className="bg-[#030614] border-white/20 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Seized From</label>
                <Input
                  value={seizedFrom}
                  onChange={(e) => setSeizedFrom(e.target.value)}
                  placeholder="Auto-filled from complainant"
                  className="bg-[#030614] border-white/20 text-white text-sm"
                />
              </div>

              <Button
                onClick={uploadEvidence}
                disabled={!selectedFile || !selectedContext || isUploading}
                className="w-full bg-gradient-to-r from-[#00FFB3] to-[#00C2FF] text-black font-semibold"
              >
                {isUploading ? (
                  <><Loader2 className="animate-spin mr-2" size={16} /> Uploading...</>
                ) : (
                  <><Upload size={16} className="mr-2" /> Upload & Hash</>
                )}
              </Button>
            </div>
          </div>

          {/* Quick Hash */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Hash className="text-[#4F7EFF]" size={18} />
              Quick Hash (No Storage)
            </h3>
            
            <div className="space-y-3">
              <label className="cursor-pointer block">
                <div className="border-2 border-dashed border-white/20 rounded-lg p-3 text-center hover:border-[#4F7EFF]/50 transition-colors">
                  {quickHashFile ? (
                    <p className="text-white text-sm">{quickHashFile.name}</p>
                  ) : (
                    <p className="text-white/50 text-sm">Select file to hash</p>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setQuickHashFile(e.target.files[0])}
                />
              </label>

              <Button
                onClick={computeQuickHash}
                disabled={!quickHashFile || isHashing}
                className="w-full bg-[#4F7EFF] hover:bg-[#4F7EFF]/80"
                size="sm"
              >
                {isHashing ? 'Computing...' : 'Compute Hash'}
              </Button>

              {quickHashResult && (
                <div className="p-3 rounded-lg bg-[#030614] border border-[#4F7EFF]/30">
                  <p className="text-white/50 text-xs mb-1">SHA-256 Hash</p>
                  <p className="text-[#4F7EFF] text-xs font-mono break-all">
                    {quickHashResult.sha256_hash}
                  </p>
                  <Button
                    onClick={() => copyHash(quickHashResult.sha256_hash)}
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-white/60"
                  >
                    <Copy size={12} className="mr-1" /> Copy
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Panel - Evidence List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Verify Hash */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Shield className="text-[#FFB800]" size={18} />
              Verify Evidence Integrity
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-white/60 text-xs mb-1 block">Evidence ID</label>
                <Input
                  value={verifyEvidenceId}
                  onChange={(e) => setVerifyEvidenceId(e.target.value)}
                  placeholder="Enter evidence ID"
                  className="bg-[#030614] border-white/20 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">File to Verify</label>
                <label className="cursor-pointer block">
                  <div className={`p-2 rounded-lg border text-center text-sm ${
                    verifyFile ? 'border-[#00FFB3]/50 text-white' : 'border-white/20 text-white/50'
                  }`}>
                    {verifyFile ? verifyFile.name : 'Select file'}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setVerifyFile(e.target.files[0])}
                  />
                </label>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={verifyHash}
                  disabled={!verifyFile || !verifyEvidenceId || isVerifying}
                  className="w-full bg-[#FFB800] hover:bg-[#FFB800]/80 text-black"
                >
                  {isVerifying ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </div>

            {verificationResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-4 rounded-lg border ${
                  verificationResult.is_valid 
                    ? 'bg-[#00FFB3]/10 border-[#00FFB3]/50'
                    : 'bg-[#FF3B3B]/10 border-[#FF3B3B]/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  {verificationResult.is_valid ? (
                    <CheckCircle2 className="text-[#00FFB3]" size={24} />
                  ) : (
                    <XCircle className="text-[#FF3B3B]" size={24} />
                  )}
                  <span className={`font-bold ${
                    verificationResult.is_valid ? 'text-[#00FFB3]' : 'text-[#FF3B3B]'
                  }`}>
                    {verificationResult.verdict}
                  </span>
                </div>
                <div className="text-xs text-white/60 space-y-1">
                  <p>Stored Hash: <span className="font-mono text-white/80">{verificationResult.stored_hash?.substring(0, 32)}...</span></p>
                  <p>Computed Hash: <span className="font-mono text-white/80">{verificationResult.computed_hash?.substring(0, 32)}...</span></p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Evidence List */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="text-[#00C2FF]" size={18} />
                Evidence Library ({evidenceItems.length})
              </span>
            </h3>

            {evidenceItems.length === 0 ? (
              <div className="text-center py-8">
                <Package className="text-white/20 mx-auto mb-3" size={48} />
                <p className="text-white/40">No evidence uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {evidenceItems.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 rounded-lg bg-[#030614] border border-white/10 hover:border-[#00C2FF]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileCheck className="text-[#00FFB3]" size={16} />
                          <span className="text-white font-medium">{item.file_name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60">
                            {item.file_type}
                          </span>
                        </div>
                        
                        <div className="text-xs text-white/50 space-y-1">
                          <p>Description: {item.description || '-'}</p>
                          <p>Seized From: {item.seized_from || '-'}</p>
                          <p>Date: {item.seizure_date || '-'}</p>
                        </div>

                        <div className="mt-2 p-2 rounded bg-[#0B0F1A] border border-white/5">
                          <p className="text-[8px] text-white/40 mb-1">SHA-256</p>
                          <p className="text-xs text-[#00C2FF] font-mono break-all">
                            {item.sha256_hash}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          onClick={() => copyHash(item.sha256_hash)}
                          variant="ghost"
                          size="sm"
                          className="text-white/50 hover:text-white"
                        >
                          <Copy size={14} />
                        </Button>
                        <Button
                          onClick={() => generateBSACertificate(item.id)}
                          variant="ghost"
                          size="sm"
                          className="text-[#4F7EFF] hover:text-[#4F7EFF]"
                          title="Generate BSA Sec 63 Certificate"
                        >
                          <FileCheck size={14} />
                        </Button>
                      </div>
                    </div>

                    {item.bsa_certificate_generated && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-[#00FFB3]">
                        <CheckCircle2 size={12} />
                        BSA Sec 63 Certificate Generated
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
};

export default EvidenceHash;
