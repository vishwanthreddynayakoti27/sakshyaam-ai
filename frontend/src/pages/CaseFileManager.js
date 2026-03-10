import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FolderOpen, 
  Plus, 
  FileText, 
  Package, 
  Scale,
  Download,
  Eye,
  Trash2,
  Search,
  Calendar,
  User,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const CaseFileManager = () => {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);
  const [newCase, setNewCase] = useState({
    caseId: '',
    complainantName: '',
    accusedName: '',
    offenceType: '',
    sections: '',
    description: '',
    status: 'Under Investigation'
  });

  // Load saved cases from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('case_file_manager_data');
    if (saved) {
      setCases(JSON.parse(saved));
    }
  }, []);

  // Save cases to localStorage
  useEffect(() => {
    localStorage.setItem('case_file_manager_data', JSON.stringify(cases));
  }, [cases]);

  // Link with other modules - Evidence Manager
  useEffect(() => {
    if (selectedCase) {
      const evidenceData = localStorage.getItem('evidence_manager_data');
      if (evidenceData) {
        const allEvidence = JSON.parse(evidenceData);
        const caseEvidence = allEvidence.filter(e => e.caseId === selectedCase.caseId);
        setSelectedCase(prev => ({ ...prev, evidence: caseEvidence }));
      }
    }
  }, [selectedCase?.caseId]);

  const handleCreateCase = () => {
    if (!newCase.caseId || !newCase.complainantName) {
      toast.error('Please fill required fields');
      return;
    }

    const caseFile = {
      id: `CF-${Date.now()}`,
      ...newCase,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
      evidence: [],
      diaryEntries: []
    };

    setCases(prev => [caseFile, ...prev]);
    setNewCase({
      caseId: '',
      complainantName: '',
      accusedName: '',
      offenceType: '',
      sections: '',
      description: '',
      status: 'Under Investigation'
    });
    setShowNewCaseForm(false);
    toast.success('Case file created!');
  };

  const updateCaseStatus = (status) => {
    if (!selectedCase) return;
    
    setCases(prev => prev.map(c => 
      c.id === selectedCase.id 
        ? { ...c, status, updatedAt: new Date().toISOString() }
        : c
    ));
    setSelectedCase(prev => ({ ...prev, status }));
    toast.success(`Status updated to ${status}`);
  };

  const deleteCase = (id) => {
    setCases(prev => prev.filter(c => c.id !== id));
    if (selectedCase?.id === id) {
      setSelectedCase(null);
    }
    toast.success('Case file deleted');
  };

  const exportCasePDF = () => {
    if (!selectedCase) return;

    const doc = new jsPDF();
    let y = 20;

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CASE FILE SUMMARY', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Case ID: ${selectedCase.caseId}`, 105, 25, { align: 'center' });

    y = 45;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CASE DETAILS', 15, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const details = [
      ['Case ID:', selectedCase.caseId],
      ['Status:', selectedCase.status],
      ['Complainant:', selectedCase.complainantName],
      ['Accused:', selectedCase.accusedName || 'Unknown'],
      ['Offence Type:', selectedCase.offenceType || 'N/A'],
      ['Sections:', selectedCase.sections || 'N/A'],
      ['Created:', new Date(selectedCase.createdAt).toLocaleString()],
      ['Last Updated:', new Date(selectedCase.updatedAt).toLocaleString()]
    ];

    details.forEach(([label, value]) => {
      doc.text(`${label} ${value}`, 15, y);
      y += 7;
    });

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('CASE DESCRIPTION', 15, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    
    const descLines = doc.splitTextToSize(selectedCase.description || 'No description provided.', 180);
    doc.text(descLines, 15, y);
    y += descLines.length * 5 + 10;

    // Evidence Section
    if (selectedCase.evidence && selectedCase.evidence.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('EVIDENCE ATTACHED', 15, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      
      selectedCase.evidence.forEach((ev, i) => {
        doc.text(`${i + 1}. ${ev.fileName} - ${ev.fileType} - Hash: ${ev.sha256Hash.substring(0, 16)}...`, 15, y);
        y += 6;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by SAAKSHYAM AI - Case File Manager', 105, 285, { align: 'center' });

    doc.save(`CaseFile_${selectedCase.caseId.replace(/\//g, '_')}.pdf`);
    toast.success('Case file PDF exported!');
  };

  const filteredCases = cases.filter(c =>
    c.caseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.complainantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.accusedName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'Under Investigation': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'Charge Sheet Filed': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'Trial Ongoing': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'Closed': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'Final Report': return 'text-red-400 bg-red-500/20 border-red-500/30';
      default: return 'text-white/60 bg-white/10 border-white/20';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Under Investigation': return Clock;
      case 'Charge Sheet Filed': return FileText;
      case 'Trial Ongoing': return Scale;
      case 'Closed': return CheckCircle;
      case 'Final Report': return AlertTriangle;
      default: return Clock;
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="case-file-manager-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <FolderOpen className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Case File Manager
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            Organize case documents, evidence & generate comprehensive case files
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Case List Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-white">Case Files</h2>
              <Button
                onClick={() => setShowNewCaseForm(true)}
                size="sm"
                className="bg-accent text-black font-bold hover:bg-accent/80"
              >
                <Plus size={14} className="mr-1" />
                New
              </Button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Search cases..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border-white/20 text-white pl-9 text-sm"
              />
            </div>

            {/* New Case Form */}
            {showNewCaseForm && (
              <div className="mb-4 p-4 bg-white/5 rounded-lg border border-accent/30 space-y-3">
                <Input
                  placeholder="Case ID (e.g., CR/2025/001) *"
                  value={newCase.caseId}
                  onChange={(e) => setNewCase(prev => ({ ...prev, caseId: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm"
                />
                <Input
                  placeholder="Complainant Name *"
                  value={newCase.complainantName}
                  onChange={(e) => setNewCase(prev => ({ ...prev, complainantName: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm"
                />
                <Input
                  placeholder="Accused Name"
                  value={newCase.accusedName}
                  onChange={(e) => setNewCase(prev => ({ ...prev, accusedName: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm"
                />
                <Input
                  placeholder="Offence Type"
                  value={newCase.offenceType}
                  onChange={(e) => setNewCase(prev => ({ ...prev, offenceType: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm"
                />
                <Input
                  placeholder="Sections (BNS/BNSS)"
                  value={newCase.sections}
                  onChange={(e) => setNewCase(prev => ({ ...prev, sections: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm"
                />
                <Textarea
                  placeholder="Case Description"
                  value={newCase.description}
                  onChange={(e) => setNewCase(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white text-sm min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button onClick={handleCreateCase} className="flex-1 bg-accent text-black text-sm">
                    Create
                  </Button>
                  <Button onClick={() => setShowNewCaseForm(false)} className="bg-white/10 text-white text-sm">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Case List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredCases.length === 0 ? (
                <div className="text-center py-8 text-white/40">
                  <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No case files found</p>
                  <p className="text-xs mt-1">Create a new case to get started</p>
                </div>
              ) : (
                filteredCases.map((caseFile) => {
                  const StatusIcon = getStatusIcon(caseFile.status);
                  return (
                    <div
                      key={caseFile.id}
                      onClick={() => setSelectedCase(caseFile)}
                      data-testid={`case-${caseFile.id}`}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedCase?.id === caseFile.id
                          ? 'bg-accent/20 border-accent'
                          : 'bg-white/5 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold text-sm">{caseFile.caseId}</span>
                        <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(caseFile.status)}`}>
                          {caseFile.status}
                        </span>
                      </div>
                      <p className="text-white/60 text-xs flex items-center gap-1">
                        <User size={10} />
                        {caseFile.complainantName}
                      </p>
                      <p className="text-white/40 text-xs mt-1">
                        {caseFile.offenceType || 'Offence not specified'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* Case Details Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 glassmorphism rounded-xl p-6 border border-white/10"
          >
            {!selectedCase ? (
              <div className="flex items-center justify-center h-full text-white/40 min-h-[400px]">
                <div className="text-center">
                  <FolderOpen size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Select a case to view details</p>
                  <p className="text-sm mt-2">Or create a new case file</p>
                </div>
              </div>
            ) : (
              <div data-testid="case-details">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-heading font-bold text-white">{selectedCase.caseId}</h2>
                    <p className="text-white/60 text-sm">{selectedCase.offenceType || 'Case File'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={exportCasePDF} className="bg-accent text-black font-bold hover:bg-accent/80">
                      <Download size={14} className="mr-2" />
                      Export PDF
                    </Button>
                    <Button 
                      onClick={() => deleteCase(selectedCase.id)}
                      className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                {/* Status Bar */}
                <div className={`p-4 rounded-lg border mb-6 ${getStatusColor(selectedCase.status)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {React.createElement(getStatusIcon(selectedCase.status), { size: 20 })}
                      <div>
                        <p className="font-bold">Status: {selectedCase.status}</p>
                        <p className="text-xs opacity-70">Last updated: {new Date(selectedCase.updatedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <select
                      value={selectedCase.status}
                      onChange={(e) => updateCaseStatus(e.target.value)}
                      className="bg-black/30 border border-white/20 text-white rounded-lg px-3 py-1 text-sm"
                    >
                      <option value="Under Investigation">Under Investigation</option>
                      <option value="Charge Sheet Filed">Charge Sheet Filed</option>
                      <option value="Trial Ongoing">Trial Ongoing</option>
                      <option value="Closed">Closed</option>
                      <option value="Final Report">Final Report</option>
                    </select>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white/60 text-xs mb-1">Complainant</p>
                    <p className="text-white font-semibold">{selectedCase.complainantName}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white/60 text-xs mb-1">Accused</p>
                    <p className="text-white font-semibold">{selectedCase.accusedName || 'Unknown'}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white/60 text-xs mb-1">Sections Applied</p>
                    <p className="text-accent font-semibold">{selectedCase.sections || 'Not specified'}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white/60 text-xs mb-1">Created On</p>
                    <p className="text-white font-semibold">{new Date(selectedCase.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-accent" />
                    Case Description
                  </h3>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white/80 text-sm whitespace-pre-wrap">
                      {selectedCase.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* Evidence Section */}
                <div>
                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <Package size={16} className="text-accent" />
                    Linked Evidence ({selectedCase.evidence?.length || 0})
                  </h3>
                  {selectedCase.evidence && selectedCase.evidence.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCase.evidence.map((ev, i) => (
                        <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between">
                          <div>
                            <p className="text-white text-sm font-semibold">{ev.fileName}</p>
                            <p className="text-white/50 text-xs">Type: {ev.fileType} | Hash: {ev.sha256Hash?.substring(0, 24)}...</p>
                          </div>
                          <CheckCircle size={16} className="text-green-400" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center text-white/40">
                      <p className="text-sm">No evidence linked to this case</p>
                      <p className="text-xs mt-1">Upload evidence in Evidence Manager with this Case ID</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default CaseFileManager;
