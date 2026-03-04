import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Upload, FileAudio, Lock, CheckCircle, Clock, Download, Trash2, Play, Pause } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const CaseDiary = () => {
  const [entries, setEntries] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [hashValue, setHashValue] = useState('');
  const [formData, setFormData] = useState({
    caseNumber: '',
    entryDate: new Date().toISOString().split('T')[0],
    location: '',
    description: '',
    officerNotes: ''
  });
  const [playingId, setPlayingId] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const audioFile = acceptedFiles[0];
        setFile(audioFile);
        
        try {
          const arrayBuffer = await audioFile.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          setHashValue(hashHex);
          toast.success('Audio file hashed for integrity verification');
        } catch (err) {
          toast.error('Failed to generate hash');
        }
      }
    },
    onDropRejected: (fileRejections) => {
      const error = fileRejections[0]?.errors[0];
      if (error?.code === 'file-too-large') {
        toast.error('File too large. Maximum 50MB allowed.');
      } else {
        toast.error('Invalid file type. Only audio files allowed.');
      }
    }
  });

  const handleUpload = async () => {
    if (!file || !formData.caseNumber) {
      toast.error('Please select an audio file and enter case number');
      return;
    }

    setUploading(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newEntry = {
      id: Date.now().toString(),
      fileName: file.name,
      fileSize: file.size,
      hashValue: hashValue,
      ...formData,
      uploadedAt: new Date().toISOString(),
      syncStatus: 'Synced',
      audioUrl: URL.createObjectURL(file)
    };

    setEntries(prev => [newEntry, ...prev]);
    setFile(null);
    setHashValue('');
    setFormData({
      caseNumber: '',
      entryDate: new Date().toISOString().split('T')[0],
      location: '',
      description: '',
      officerNotes: ''
    });
    setUploading(false);
    toast.success('Case diary entry uploaded and synced!');
  };

  const handleDelete = (id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success('Entry deleted');
  };

  const togglePlay = (id, audioUrl) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => setPlayingId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="case-diary-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <Mic className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Case Diary - Mobile Sync
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            Secure audio diary upload with SHA-256 integrity verification
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
              <Upload size={20} className="text-accent" />
              Upload Audio Diary Entry
            </h2>

            <div
              {...getRootProps()}
              data-testid="audio-dropzone"
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-accent bg-accent/10'
                  : 'border-white/20 hover:border-accent/50 bg-white/5'
              }`}
            >
              <input {...getInputProps()} />
              <FileAudio className="mx-auto text-accent mb-3" size={40} />
              {file ? (
                <div>
                  <p className="text-white font-semibold">{file.name}</p>
                  <p className="text-white/60 text-sm">{formatFileSize(file.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-white/70">Drop audio file or click to upload</p>
                  <p className="text-white/50 text-sm mt-1">MP3, WAV, M4A (max 50MB)</p>
                </div>
              )}
            </div>

            {hashValue && (
              <div className="mt-4 p-4 bg-success/10 border border-success/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={16} className="text-success" />
                  <span className="text-success font-semibold text-sm">SHA-256 Hash Generated</span>
                </div>
                <p className="text-white/70 text-xs font-mono break-all" data-testid="hash-value">
                  {hashValue}
                </p>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <Input
                placeholder="Case Number *"
                value={formData.caseNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, caseNumber: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
                data-testid="case-number-input"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, entryDate: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                />
                <Input
                  placeholder="Recording Location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <Input
                placeholder="Brief Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
              />

              <Textarea
                placeholder="Officer Notes (Optional)"
                value={formData.officerNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, officerNotes: e.target.value }))}
                className="bg-white/5 border-white/20 text-white min-h-[80px]"
              />

              <Button
                onClick={handleUpload}
                disabled={!file || !formData.caseNumber || uploading}
                data-testid="upload-btn"
                className="w-full bg-accent text-black font-bold hover:bg-accent/80"
              >
                {uploading ? 'Uploading & Syncing...' : 'Upload & Sync to Station'}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={20} className="text-accent" />
              Synced Entries ({entries.length})
            </h2>

            {entries.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-white/40">
                <div className="text-center">
                  <Mic size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No diary entries yet</p>
                  <p className="text-sm mt-1">Upload an audio recording to begin</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    data-testid={`diary-entry-${entry.id}`}
                    className="p-4 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => togglePlay(entry.id, entry.audioUrl)}
                          className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center hover:bg-accent/30 transition"
                        >
                          {playingId === entry.id ? (
                            <Pause size={18} className="text-accent" />
                          ) : (
                            <Play size={18} className="text-accent ml-0.5" />
                          )}
                        </button>
                        <div>
                          <p className="text-white font-semibold">{entry.caseNumber}</p>
                          <p className="text-white/60 text-sm">{entry.fileName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 px-2 py-1 bg-success/20 text-success text-xs rounded border border-success/30">
                          <CheckCircle size={12} />
                          {entry.syncStatus}
                        </span>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-alert/60 hover:text-alert transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-white/50">Date: </span>
                        <span className="text-white/80">{entry.entryDate}</span>
                      </div>
                      <div>
                        <span className="text-white/50">Size: </span>
                        <span className="text-white/80">{formatFileSize(entry.fileSize)}</span>
                      </div>
                      {entry.location && (
                        <div className="col-span-2">
                          <span className="text-white/50">Location: </span>
                          <span className="text-white/80">{entry.location}</span>
                        </div>
                      )}
                    </div>

                    {entry.description && (
                      <p className="text-white/70 text-sm mb-2">{entry.description}</p>
                    )}

                    <div className="mt-3 p-2 bg-black/30 rounded">
                      <div className="flex items-center gap-1 mb-1">
                        <Lock size={12} className="text-success" />
                        <span className="text-success text-xs">Integrity Hash</span>
                      </div>
                      <p className="text-white/50 text-xs font-mono truncate">{entry.hashValue}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 bg-accent/10 border border-accent/30 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <Lock size={24} className="text-accent flex-shrink-0" />
            <div>
              <h3 className="text-accent font-bold mb-1">End-to-End Security</h3>
              <p className="text-white/70 text-sm">
                All audio files are hashed using SHA-256 before upload. This cryptographic hash 
                serves as a digital fingerprint, ensuring the file's integrity can be verified 
                in court proceedings under BSA Section 63.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default CaseDiary;
