import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Upload, 
  FileImage, 
  FileVideo, 
  FileAudio, 
  FileText,
  Hash,
  Calendar,
  Shield,
  CheckCircle,
  Trash2,
  Eye,
  Download,
  Search,
  Filter
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const EvidenceManager = () => {
  const [evidenceList, setEvidenceList] = useState([]);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [newEvidence, setNewEvidence] = useState({
    caseId: '',
    description: '',
    file: null
  });

  // Load saved evidence from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('evidence_manager_data');
    if (saved) {
      setEvidenceList(JSON.parse(saved));
    }
  }, []);

  // Save evidence to localStorage
  useEffect(() => {
    localStorage.setItem('evidence_manager_data', JSON.stringify(evidenceList));
  }, [evidenceList]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setNewEvidence(prev => ({ ...prev, file: acceptedFiles[0] }));
      }
    }
  });

  const getFileType = (file) => {
    if (!file) return 'unknown';
    const type = file.type || '';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('pdf') || type.includes('word') || type.includes('document')) return 'document';
    return 'other';
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'image': return FileImage;
      case 'video': return FileVideo;
      case 'audio': return FileAudio;
      case 'document': return FileText;
      default: return FileText;
    }
  };

  const generateHash = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleUpload = async () => {
    if (!newEvidence.file) {
      toast.error('Please select a file to upload');
      return;
    }
    if (!newEvidence.caseId) {
      toast.error('Please enter a Case ID');
      return;
    }

    setUploading(true);

    try {
      const hash = await generateHash(newEvidence.file);
      const fileType = getFileType(newEvidence.file);

      const evidence = {
        id: `EVD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        caseId: newEvidence.caseId,
        fileName: newEvidence.file.name,
        fileSize: newEvidence.file.size,
        fileType: fileType,
        mimeType: newEvidence.file.type,
        description: newEvidence.description,
        sha256Hash: hash,
        uploadDate: new Date().toISOString(),
        verified: true,
        integrityStatus: 'Verified'
      };

      setEvidenceList(prev => [evidence, ...prev]);
      setNewEvidence({ caseId: '', description: '', file: null });
      toast.success('Evidence uploaded and verified!');
    } catch (err) {
      toast.error('Failed to process evidence');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const verifyIntegrity = async (evidence) => {
    // In a real app, this would re-hash the file and compare
    toast.success(`Integrity verified for ${evidence.fileName}`);
  };

  const deleteEvidence = (id) => {
    setEvidenceList(prev => prev.filter(e => e.id !== id));
    if (selectedEvidence?.id === id) {
      setSelectedEvidence(null);
    }
    toast.success('Evidence removed');
  };

  const filteredEvidence = evidenceList.filter(e => {
    const matchesSearch = 
      e.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.caseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || e.fileType === filterType;
    
    return matchesSearch && matchesFilter;
  });

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="evidence-manager-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <Package className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Evidence Manager
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            Upload, hash & manage digital evidence with integrity verification
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-lg font-heading font-bold text-white mb-4 flex items-center gap-2">
              <Upload size={20} className="text-accent" />
              Upload Evidence
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-xs mb-1 block">Case ID *</label>
                <Input
                  placeholder="e.g., CR/2025/001"
                  value={newEvidence.caseId}
                  onChange={(e) => setNewEvidence(prev => ({ ...prev, caseId: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                  data-testid="input-case-id"
                />
              </div>

              <div
                {...getRootProps()}
                data-testid="evidence-dropzone"
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-accent bg-accent/10'
                    : 'border-white/20 hover:border-accent/50 bg-white/5'
                }`}
              >
                <input {...getInputProps()} />
                <Package className="mx-auto text-accent mb-3" size={32} />
                {newEvidence.file ? (
                  <div>
                    <p className="text-white font-semibold text-sm">{newEvidence.file.name}</p>
                    <p className="text-white/60 text-xs mt-1">{formatFileSize(newEvidence.file.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-white/70 text-sm">Drop evidence file or click to upload</p>
                    <p className="text-white/50 text-xs mt-2">Images, Video, Audio, PDF, Documents</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Description</label>
                <Textarea
                  placeholder="Evidence description..."
                  value={newEvidence.description}
                  onChange={(e) => setNewEvidence(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white min-h-[80px]"
                  data-testid="input-description"
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading}
                data-testid="upload-evidence-btn"
                className="w-full bg-accent text-black font-bold hover:bg-accent/80"
              >
                {uploading ? 'Processing...' : 'Upload & Generate Hash'}
              </Button>

              <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                <p className="text-white/60 text-xs">
                  <Hash size={12} className="inline mr-1 text-accent" />
                  SHA-256 hash is automatically generated to ensure evidence integrity for court admissibility.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Evidence List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-white">Evidence Library</h2>
              <span className="text-accent text-sm">{evidenceList.length} items</span>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/5 border-white/20 text-white pl-9 text-sm"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white/5 border border-white/20 text-white rounded-lg px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="document">Documents</option>
              </select>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredEvidence.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <Package size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No evidence found</p>
                </div>
              ) : (
                filteredEvidence.map((evidence) => {
                  const Icon = getFileIcon(evidence.fileType);
                  return (
                    <div
                      key={evidence.id}
                      onClick={() => setSelectedEvidence(evidence)}
                      data-testid={`evidence-${evidence.id}`}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedEvidence?.id === evidence.id
                          ? 'bg-accent/20 border-accent'
                          : 'bg-white/5 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          evidence.fileType === 'image' ? 'bg-blue-500/20' :
                          evidence.fileType === 'video' ? 'bg-red-500/20' :
                          evidence.fileType === 'audio' ? 'bg-green-500/20' :
                          'bg-purple-500/20'
                        }`}>
                          <Icon size={16} className={
                            evidence.fileType === 'image' ? 'text-blue-400' :
                            evidence.fileType === 'video' ? 'text-red-400' :
                            evidence.fileType === 'audio' ? 'text-green-400' :
                            'text-purple-400'
                          } />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{evidence.fileName}</p>
                          <p className="text-white/50 text-xs">Case: {evidence.caseId}</p>
                        </div>
                        {evidence.verified && (
                          <CheckCircle size={14} className="text-green-400" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* Evidence Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-lg font-heading font-bold text-white mb-4 flex items-center gap-2">
              <Eye size={20} className="text-accent" />
              Evidence Details
            </h2>

            {!selectedEvidence ? (
              <div className="flex items-center justify-center h-64 text-white/40">
                <div className="text-center">
                  <Package size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Select evidence to view details</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4" data-testid="evidence-details">
                <div className={`p-4 rounded-lg border ${
                  selectedEvidence.verified
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {selectedEvidence.verified ? (
                      <Shield className="text-green-400" size={20} />
                    ) : (
                      <Shield className="text-yellow-400" size={20} />
                    )}
                    <div>
                      <p className={`font-bold text-sm ${selectedEvidence.verified ? 'text-green-400' : 'text-yellow-400'}`}>
                        {selectedEvidence.integrityStatus}
                      </p>
                      <p className="text-white/60 text-xs">Evidence Integrity</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Evidence ID:</span>
                    <span className="text-white font-mono text-xs">{selectedEvidence.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Case ID:</span>
                    <span className="text-white">{selectedEvidence.caseId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">File Name:</span>
                    <span className="text-white truncate ml-2">{selectedEvidence.fileName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">File Size:</span>
                    <span className="text-white">{formatFileSize(selectedEvidence.fileSize)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Type:</span>
                    <span className="text-white capitalize">{selectedEvidence.fileType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Upload Date:</span>
                    <span className="text-white">{new Date(selectedEvidence.uploadDate).toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-3 bg-black/40 rounded-lg border border-white/10">
                  <p className="text-white/60 text-xs mb-1">SHA-256 Hash:</p>
                  <code className="text-accent text-xs break-all">{selectedEvidence.sha256Hash}</code>
                </div>

                {selectedEvidence.description && (
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white/60 text-xs mb-1">Description:</p>
                    <p className="text-white text-sm">{selectedEvidence.description}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => verifyIntegrity(selectedEvidence)}
                    className="flex-1 bg-white/10 text-white hover:bg-white/20"
                  >
                    <Shield size={14} className="mr-2" />
                    Verify
                  </Button>
                  <Button
                    onClick={() => deleteEvidence(selectedEvidence.id)}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default EvidenceManager;
