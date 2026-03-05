import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Search, BookOpen, ArrowRight, FileText, Gavel, Shield, Copy, Download, AlertTriangle, FileCheck, Eye, CheckCircle, XCircle, Upload, Hash } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { api } from '../utils/api';
import jsPDF from 'jspdf';

const LegalIntelligenceEngine = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [activeFeature, setActiveFeature] = useState('analyze'); // analyze, peer-review, bsa63
  const [searchText, setSearchText] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [remandNote, setRemandNote] = useState('');
  
  // Peer Review state
  const [firDraftText, setFirDraftText] = useState('');
  const [peerReviewResult, setPeerReviewResult] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  
  // BSA 63 Certifier state
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [certificateData, setCertificateData] = useState(null);
  const [generating, setGenerating] = useState(false);

  const tabs = [
    { id: 'all', label: 'All Laws', icon: Scale, description: 'Analyze across BNS, BNSS & BSA', oldLaw: 'Comprehensive' },
    { id: 'bns', label: 'BNS', icon: Scale, description: 'Bharatiya Nyaya Sanhita (Offences)', oldLaw: 'IPC' },
    { id: 'bnss', label: 'BNSS', icon: Gavel, description: 'Bharatiya Nagarik Suraksha Sanhita (Procedures)', oldLaw: 'CrPC' },
    { id: 'bsa', label: 'BSA', icon: Shield, description: 'Bharatiya Sakshya Adhiniyam (Evidence)', oldLaw: 'Evidence Act' }
  ];

  const features = [
    { id: 'analyze', label: 'Section Analyzer', icon: Scale },
    { id: 'peer-review', label: 'Case Peer-Reviewer', icon: Eye },
    { id: 'bsa63', label: 'BSA 63 Certifier', icon: FileCheck }
  ];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
      'video/*': ['.mp4', '.mov', '.avi'],
      'audio/*': ['.mp3', '.wav', '.m4a']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setEvidenceFile(acceptedFiles[0]);
        setCertificateData(null);
      }
    }
  });

  const handleAnalyze = async () => {
    if (!searchText.trim()) {
      toast.error('Please enter case facts to analyze');
      return;
    }

    setAnalyzing(true);
    setRemandNote('');
    
    try {
      const response = await api.post('/bns/analyze', { text: searchText });
      const data = response.data || response;
      
      if (data.suggested_sections) {
        let filteredSections = data.suggested_sections;
        
        if (activeTab !== 'all') {
          const categoryMap = {
            'bns': 'offence',
            'bnss': 'procedure',
            'bsa': 'evidence'
          };
          filteredSections = data.suggested_sections.filter(
            s => s.category === categoryMap[activeTab] || 
                 s.section_number.toLowerCase().startsWith(activeTab)
          );
        }

        setResults({
          sections: filteredSections,
          keywords: data.matched_keywords || [],
          lawType: activeTab.toUpperCase()
        });

        if (data.remand_note) {
          setRemandNote(data.remand_note);
        }

        if (filteredSections.length > 0) {
          toast.success(`Found ${filteredSections.length} applicable sections`);
        } else {
          toast.info('No matching sections found. Try different keywords.');
        }
      }
    } catch (err) {
      toast.error('Analysis failed');
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSectionSearch = async () => {
    if (!sectionSearch.trim()) {
      toast.error('Please enter a section number');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('section_number', sectionSearch);
      const response = await api.post('/bns/search', formData);
      const data = response.data || response;
      
      if (data.found && data.section) {
        setResults({
          sections: [data.section],
          keywords: [],
          lawType: 'SEARCH',
          isDirectSearch: true
        });
        toast.success(`Found: ${data.section.section_number}`);
      } else {
        toast.error('Section not found');
      }
    } catch (err) {
      toast.error('Search failed');
    }
  };

  // Case Peer-Reviewer - Analyzes FIR draft for weak sections
  const handlePeerReview = async () => {
    if (!firDraftText.trim()) {
      toast.error('Please enter FIR draft text to review');
      return;
    }

    setReviewing(true);
    setPeerReviewResult(null);
    
    try {
      const response = await api.post('/bns/peer-review', { text: firDraftText });
      const data = response.data || response;
      setPeerReviewResult(data);
      
      if (data.issues && data.issues.length > 0) {
        toast.warning(`Found ${data.issues.length} potential issues`);
      } else {
        toast.success('FIR draft looks strong!');
      }
    } catch (err) {
      // Fallback to client-side analysis if endpoint not available
      const issues = analyzeFirDraftLocally(firDraftText);
      setPeerReviewResult({
        legal_strength: issues.length === 0 ? 'Strong' : issues.length < 3 ? 'Moderate' : 'Weak',
        issues: issues,
        suggestions: generateSuggestions(issues)
      });
      
      if (issues.length > 0) {
        toast.warning(`Found ${issues.length} potential issues`);
      } else {
        toast.success('FIR draft looks strong!');
      }
    } finally {
      setReviewing(false);
    }
  };

  // Local FIR analysis fallback
  const analyzeFirDraftLocally = (text) => {
    const issues = [];
    const textLower = text.toLowerCase();
    
    // Check for weak sections under BNS
    if (textLower.includes('section 420') || textLower.includes('ipc 420')) {
      issues.push({
        type: 'warning',
        title: 'Old Law Reference',
        description: 'IPC 420 should be replaced with BNS 318 for cases after July 2024.',
        severity: 'medium'
      });
    }
    
    if (textLower.includes('crpc') || textLower.includes('cr.p.c')) {
      issues.push({
        type: 'warning',
        title: 'Outdated Procedure Reference',
        description: 'CrPC references should be updated to BNSS equivalents.',
        severity: 'medium'
      });
    }
    
    if (!textLower.includes('section') && !textLower.includes('bns') && !textLower.includes('bnss')) {
      issues.push({
        type: 'critical',
        title: 'Missing Section Reference',
        description: 'FIR draft does not mention any legal sections. Add applicable BNS/BNSS sections.',
        severity: 'high'
      });
    }
    
    if (text.includes('I ') || text.includes('my ') || text.includes('me ')) {
      issues.push({
        type: 'warning',
        title: 'First Person Narrative',
        description: 'FIR should be in third person. Convert "I/my/me" to "complainant/victim".',
        severity: 'low'
      });
    }
    
    if (textLower.includes('cheated') && !textLower.includes('bns 318') && !textLower.includes('section 318')) {
      issues.push({
        type: 'suggestion',
        title: 'Missing Cheating Section',
        description: 'Text mentions cheating but BNS 318 is not cited.',
        severity: 'medium'
      });
    }
    
    if (textLower.includes('threat') && !textLower.includes('bns 351') && !textLower.includes('criminal intimidation')) {
      issues.push({
        type: 'suggestion',
        title: 'Missing Intimidation Section',
        description: 'Text mentions threat but BNS 351 (Criminal Intimidation) is not cited.',
        severity: 'medium'
      });
    }

    return issues;
  };

  const generateSuggestions = (issues) => {
    const suggestions = [];
    
    if (issues.some(i => i.title.includes('Old Law'))) {
      suggestions.push('Update all IPC references to BNS equivalents (IPC 420 → BNS 318)');
    }
    if (issues.some(i => i.title.includes('Procedure'))) {
      suggestions.push('Replace CrPC citations with BNSS sections');
    }
    if (issues.some(i => i.title.includes('First Person'))) {
      suggestions.push('Convert narrative to third person for proper FIR format');
    }
    if (issues.some(i => i.title.includes('Missing Section'))) {
      suggestions.push('Use the Section Analyzer to identify applicable BNS/BNSS/BSA sections');
    }
    
    return suggestions;
  };

  // BSA 63 Certificate Generator
  const generateBSA63Certificate = async () => {
    if (!evidenceFile) {
      toast.error('Please upload an evidence file');
      return;
    }

    setGenerating(true);
    
    try {
      // Read file and generate SHA-256 hash
      const arrayBuffer = await evidenceFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const certificateInfo = {
        fileName: evidenceFile.name,
        fileSize: (evidenceFile.size / 1024).toFixed(2) + ' KB',
        fileType: evidenceFile.type || 'unknown',
        sha256Hash: hashHex,
        timestamp: new Date().toISOString(),
        certificateNumber: `BSA63-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      };
      
      setCertificateData(certificateInfo);
      toast.success('BSA 63 Certificate generated!');
    } catch (err) {
      toast.error('Failed to generate certificate');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const downloadBSA63Certificate = () => {
    if (!certificateData) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('BSA SECTION 63 - DIGITAL EVIDENCE CERTIFICATE', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Bharatiya Sakshya Adhiniyam, 2023', 105, 30, { align: 'center' });
    
    // Certificate content
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    let y = 55;
    
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICATE OF AUTHENTICITY', 105, y, { align: 'center' });
    y += 15;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Certificate Number: ${certificateData.certificateNumber}`, 20, y);
    y += 10;
    doc.text(`Generated On: ${new Date(certificateData.timestamp).toLocaleString()}`, 20, y);
    y += 15;
    
    // Evidence details box
    doc.setDrawColor(0, 150, 150);
    doc.setLineWidth(0.5);
    doc.rect(15, y - 5, 180, 60);
    
    doc.setFont('helvetica', 'bold');
    doc.text('DIGITAL EVIDENCE DETAILS', 20, y + 5);
    doc.setFont('helvetica', 'normal');
    y += 15;
    
    doc.text(`File Name: ${certificateData.fileName}`, 25, y);
    y += 8;
    doc.text(`File Size: ${certificateData.fileSize}`, 25, y);
    y += 8;
    doc.text(`File Type: ${certificateData.fileType}`, 25, y);
    y += 8;
    
    doc.setFont('helvetica', 'bold');
    doc.text('SHA-256 Hash:', 25, y);
    y += 8;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(certificateData.sha256Hash, 25, y);
    y += 20;
    
    // Legal statement
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const legalText = `This is to certify that the above digital evidence has been processed and authenticated as per the provisions of Section 63 of the Bharatiya Sakshya Adhiniyam, 2023. The SHA-256 cryptographic hash ensures the integrity and authenticity of the digital evidence from the point of collection.`;
    
    const splitLegal = doc.splitTextToSize(legalText, 175);
    doc.text(splitLegal, 20, y);
    y += splitLegal.length * 6 + 15;
    
    // Signature area
    doc.line(20, y + 20, 80, y + 20);
    doc.text('Certifying Officer', 20, y + 28);
    
    doc.line(130, y + 20, 190, y + 28);
    doc.text('Date & Seal', 130, y + 28);
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by SAAKSHYAM AI - Cyber Investigation Command Console', 105, 285, { align: 'center' });
    
    doc.save(`BSA63_Certificate_${certificateData.certificateNumber}.pdf`);
    toast.success('Certificate downloaded!');
  };

  const copyRemandNote = () => {
    if (remandNote) {
      navigator.clipboard.writeText(remandNote);
      toast.success('Remand note copied to clipboard');
    }
  };

  const downloadRemandNotePDF = () => {
    if (!remandNote) return;

    const doc = new jsPDF();
    const lines = doc.splitTextToSize(remandNote, 180);
    
    doc.setFontSize(10);
    doc.text(lines, 15, 20);
    
    doc.save('Remand_Note.pdf');
    toast.success('Remand note PDF downloaded');
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'offence': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'procedure': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'evidence': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-white/10 text-white/60 border-white/20';
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'offence': return 'BNS (Offence)';
      case 'procedure': return 'BNSS (Procedure)';
      case 'evidence': return 'BSA (Evidence)';
      default: return category?.toUpperCase() || '';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      default: return 'text-white/60 bg-white/10 border-white/20';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="legal-intelligence-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <Scale className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Legal Intelligence Engine
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            BNS Guard - Section Analysis, Case Peer-Reviewer & BSA 63 Digital Evidence Certifier
          </p>
        </motion.div>

        {/* Feature Tabs */}
        <div className="flex gap-2 mb-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                data-testid={`feature-${feature.id}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  activeFeature === feature.id
                    ? 'bg-accent text-black border-accent font-bold'
                    : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm">{feature.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section Analyzer Feature */}
        {activeFeature === 'analyze' && (
          <>
            <div className="flex gap-2 mb-6 flex-wrap">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`tab-${tab.id}`}
                    className={`flex-1 min-w-[120px] p-3 rounded-lg border transition-all ${
                      activeTab === tab.id
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30'
                    }`}
                  >
                    <Icon size={20} className="mx-auto mb-1" />
                    <p className="font-bold text-sm">{tab.label}</p>
                    <p className="text-xs opacity-70 hidden sm:block">{tab.oldLaw}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glassmorphism rounded-xl p-6 border border-white/10"
              >
                <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                  <Search size={20} className="text-accent" />
                  Analyze Case Facts
                </h2>

                <Textarea
                  placeholder="Enter complaint text, case facts, or incident description...

Example: Person cheated another person by promising a job and taking money. The accused made false promises of employment and collected Rs. 50,000 from the victim."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="bg-white/5 border-white/20 text-white min-h-[180px] mb-4"
                  data-testid="case-text-input"
                />

                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  data-testid="analyze-btn"
                  className="w-full bg-accent text-black font-bold hover:bg-accent/80 mb-6"
                >
                  {analyzing ? 'Analyzing...' : 'Analyze Case Facts'}
                </Button>

                <div className="border-t border-white/10 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <BookOpen size={18} className="text-accent" />
                    Direct Section Lookup
                  </h3>

                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., BNS 318, IPC 420, CrPC 154"
                      value={sectionSearch}
                      onChange={(e) => setSectionSearch(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSectionSearch()}
                      className="flex-1 bg-white/5 border-white/20 text-white"
                      data-testid="section-search-input"
                    />
                    <Button
                      onClick={handleSectionSearch}
                      data-testid="section-search-btn"
                      className="bg-white/10 text-white hover:bg-white/20"
                    >
                      <Search size={18} />
                    </Button>
                  </div>

                  <p className="text-white/50 text-xs mt-2">
                    Search by new law (BNS/BNSS/BSA) or old law (IPC/CrPC/Evidence Act)
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="glassmorphism rounded-xl p-6 border border-white/10"
              >
                <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                  <FileText size={20} className="text-accent" />
                  Applicable Sections
                </h2>

                {!results ? (
                  <div className="flex items-center justify-center h-64 text-white/40">
                    <div className="text-center">
                      <Scale size={48} className="mx-auto mb-4 opacity-20" />
                      <p>Enter case facts to find applicable sections</p>
                      <p className="text-sm mt-2 text-white/30">The system will analyze keywords and suggest relevant BNS, BNSS, and BSA sections</p>
                    </div>
                  </div>
                ) : results.sections.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-white/40">
                    <div className="text-center">
                      <Search size={48} className="mx-auto mb-4 opacity-20" />
                      <p>No matching sections found</p>
                      <p className="text-sm mt-1">Try different keywords or more detailed facts</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto" data-testid="results-container">
                    {results.keywords && results.keywords.length > 0 && (
                      <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg mb-4">
                        <p className="text-accent text-sm font-semibold mb-2">Matched Keywords:</p>
                        <div className="flex flex-wrap gap-2">
                          {results.keywords.map((kw, i) => (
                            <span key={i} className="px-2 py-1 bg-accent/20 text-accent text-xs rounded">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {results.sections.map((section, index) => (
                      <div
                        key={index}
                        data-testid={`section-result-${index}`}
                        className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-accent/30 transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-accent font-bold text-lg">{section.section_number}</span>
                            <h4 className="text-white font-semibold">{section.title}</h4>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded border ${getCategoryColor(section.category)}`}>
                            {getCategoryLabel(section.category)}
                          </span>
                        </div>

                        <p className="text-white/70 text-sm mb-3">{section.description}</p>

                        {section.punishment && (
                          <div className="p-2 bg-alert/10 border border-alert/30 rounded mb-3">
                            <p className="text-alert text-xs">
                              <strong>Punishment:</strong> {section.punishment}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 p-2 bg-black/30 rounded">
                          <span className="text-white/50 text-xs">Old Law:</span>
                          <ArrowRight size={12} className="text-accent" />
                          <span className="text-accent text-sm font-semibold">
                            {section.ipc_equivalent || section.crpc_equivalent || section.evidence_act_equivalent || 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {remandNote && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 glassmorphism rounded-xl p-6 border border-warning/30"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                    <AlertTriangle size={20} className="text-warning" />
                    Auto-Generated Remand Note
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      onClick={copyRemandNote}
                      className="bg-white/10 text-white hover:bg-white/20"
                      data-testid="copy-remand-btn"
                    >
                      <Copy size={16} className="mr-2" />
                      Copy
                    </Button>
                    <Button
                      onClick={downloadRemandNotePDF}
                      className="bg-warning text-black font-bold hover:bg-warning/80"
                      data-testid="download-remand-btn"
                    >
                      <Download size={16} className="mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-black/40 rounded-lg border border-white/10 max-h-[400px] overflow-y-auto">
                  <pre className="text-white/80 text-sm whitespace-pre-wrap font-mono">
                    {remandNote}
                  </pre>
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Case Peer-Reviewer Feature */}
        {activeFeature === 'peer-review' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glassmorphism rounded-xl p-6 border border-white/10"
            >
              <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                <Eye size={20} className="text-accent" />
                FIR Draft for Review
              </h2>

              <p className="text-white/60 text-sm mb-4">
                Paste your FIR draft below. The AI will analyze it for weak sections, outdated law references, and formatting issues under BNS/BNSS.
              </p>

              <Textarea
                placeholder="Paste your FIR draft here...

The system will check for:
• Old law citations (IPC/CrPC) that need BNS/BNSS updates
• Missing section references
• Narrative format issues
• Incomplete offence descriptions"
                value={firDraftText}
                onChange={(e) => setFirDraftText(e.target.value)}
                className="bg-white/5 border-white/20 text-white min-h-[300px] mb-4"
                data-testid="fir-draft-input"
              />

              <Button
                onClick={handlePeerReview}
                disabled={reviewing}
                data-testid="peer-review-btn"
                className="w-full bg-accent text-black font-bold hover:bg-accent/80"
              >
                {reviewing ? 'Reviewing...' : 'Analyze FIR Draft'}
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glassmorphism rounded-xl p-6 border border-white/10"
            >
              <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                <FileCheck size={20} className="text-accent" />
                Review Results
              </h2>

              {!peerReviewResult ? (
                <div className="flex items-center justify-center h-64 text-white/40">
                  <div className="text-center">
                    <Eye size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Paste an FIR draft to review</p>
                    <p className="text-sm mt-2 text-white/30">The system will flag sections that might fail under BNS/BNSS</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4" data-testid="peer-review-results">
                  {/* Legal Strength Indicator */}
                  <div className={`p-4 rounded-lg border ${
                    peerReviewResult.legal_strength === 'Strong' 
                      ? 'bg-green-500/20 border-green-500/30' 
                      : peerReviewResult.legal_strength === 'Moderate'
                      ? 'bg-yellow-500/20 border-yellow-500/30'
                      : 'bg-red-500/20 border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      {peerReviewResult.legal_strength === 'Strong' ? (
                        <CheckCircle className="text-green-400" size={24} />
                      ) : peerReviewResult.legal_strength === 'Moderate' ? (
                        <AlertTriangle className="text-yellow-400" size={24} />
                      ) : (
                        <XCircle className="text-red-400" size={24} />
                      )}
                      <div>
                        <p className="text-white font-bold">Legal Strength: {peerReviewResult.legal_strength}</p>
                        <p className="text-white/60 text-sm">
                          {peerReviewResult.issues?.length || 0} issues found
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Issues List */}
                  {peerReviewResult.issues && peerReviewResult.issues.length > 0 && (
                    <div className="space-y-3 max-h-[250px] overflow-y-auto">
                      {peerReviewResult.issues.map((issue, i) => (
                        <div key={i} className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}>
                          <p className="font-semibold text-sm">{issue.title}</p>
                          <p className="text-xs opacity-80 mt-1">{issue.description}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {peerReviewResult.suggestions && peerReviewResult.suggestions.length > 0 && (
                    <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                      <p className="text-accent font-semibold text-sm mb-2">Suggestions:</p>
                      <ul className="space-y-1">
                        {peerReviewResult.suggestions.map((s, i) => (
                          <li key={i} className="text-white/70 text-xs flex items-start gap-2">
                            <ArrowRight size={12} className="text-accent mt-0.5 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* BSA 63 Certifier Feature */}
        {activeFeature === 'bsa63' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glassmorphism rounded-xl p-6 border border-white/10"
            >
              <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                <Upload size={20} className="text-accent" />
                Upload Digital Evidence
              </h2>

              <p className="text-white/60 text-sm mb-4">
                Upload any digital evidence file (images, PDFs, audio, video) to generate a BSA Section 63 compliant certificate with SHA-256 hash.
              </p>

              <div
                {...getRootProps()}
                data-testid="evidence-dropzone"
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-accent bg-accent/10'
                    : 'border-white/20 hover:border-accent/50 bg-white/5'
                }`}
              >
                <input {...getInputProps()} />
                <Hash className="mx-auto text-accent mb-3" size={40} />
                {evidenceFile ? (
                  <div>
                    <p className="text-white font-semibold">{evidenceFile.name}</p>
                    <p className="text-white/60 text-sm mt-1">{(evidenceFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-white/70">Drop evidence file or click to upload</p>
                    <p className="text-white/50 text-xs mt-2">Supports: Images, PDF, Audio, Video</p>
                  </div>
                )}
              </div>

              <Button
                onClick={generateBSA63Certificate}
                disabled={!evidenceFile || generating}
                data-testid="generate-certificate-btn"
                className="w-full mt-4 bg-accent text-black font-bold hover:bg-accent/80"
              >
                {generating ? 'Generating...' : 'Generate BSA 63 Certificate'}
              </Button>

              <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-lg">
                <p className="text-white/60 text-xs">
                  <strong className="text-accent">BSA Section 63</strong> (formerly Evidence Act Section 65B) governs the admissibility of electronic records in court. A certificate verifying the authenticity of digital evidence via cryptographic hash is legally required.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glassmorphism rounded-xl p-6 border border-white/10"
            >
              <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
                <FileCheck size={20} className="text-accent" />
                Generated Certificate
              </h2>

              {!certificateData ? (
                <div className="flex items-center justify-center h-64 text-white/40">
                  <div className="text-center">
                    <FileCheck size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Upload evidence to generate certificate</p>
                    <p className="text-sm mt-2 text-white/30">SHA-256 hash will be computed automatically</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4" data-testid="certificate-preview">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="text-green-400" size={20} />
                      <p className="text-green-400 font-bold">Certificate Generated</p>
                    </div>
                    <p className="text-white/60 text-xs">Certificate No: {certificateData.certificateNumber}</p>
                  </div>

                  <div className="space-y-3 p-4 bg-white/5 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-white/60 text-sm">File Name:</span>
                      <span className="text-white text-sm">{certificateData.fileName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60 text-sm">File Size:</span>
                      <span className="text-white text-sm">{certificateData.fileSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60 text-sm">File Type:</span>
                      <span className="text-white text-sm">{certificateData.fileType}</span>
                    </div>
                    <div>
                      <span className="text-white/60 text-sm block mb-1">SHA-256 Hash:</span>
                      <code className="text-accent text-xs break-all bg-black/30 p-2 rounded block">
                        {certificateData.sha256Hash}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60 text-sm">Timestamp:</span>
                      <span className="text-white text-sm">{new Date(certificateData.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <Button
                    onClick={downloadBSA63Certificate}
                    data-testid="download-certificate-btn"
                    className="w-full bg-accent text-black font-bold hover:bg-accent/80"
                  >
                    <Download size={16} className="mr-2" />
                    Download PDF Certificate
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Quick Reference */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-4 bg-white/5 border border-white/10 rounded-xl"
        >
          <h3 className="text-white font-bold mb-3">Quick Reference - Common Offences</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-2 bg-white/5 rounded">
              <p className="text-accent font-semibold">Cheating</p>
              <p className="text-white/60">BNS 318 (IPC 420)</p>
            </div>
            <div className="p-2 bg-white/5 rounded">
              <p className="text-accent font-semibold">Theft</p>
              <p className="text-white/60">BNS 303 (IPC 379)</p>
            </div>
            <div className="p-2 bg-white/5 rounded">
              <p className="text-accent font-semibold">Assault</p>
              <p className="text-white/60">BNS 115 (IPC 323)</p>
            </div>
            <div className="p-2 bg-white/5 rounded">
              <p className="text-accent font-semibold">Cyber Fraud</p>
              <p className="text-white/60">BNS 318 + IT Act 66</p>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default LegalIntelligenceEngine;
