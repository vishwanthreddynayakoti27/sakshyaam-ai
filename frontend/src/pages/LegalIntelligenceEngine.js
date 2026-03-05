import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Search, BookOpen, ArrowRight, FileText, Gavel, Shield, Copy, Download, AlertTriangle } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { api } from '../utils/api';
import jsPDF from 'jspdf';

const LegalIntelligenceEngine = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [remandNote, setRemandNote] = useState('');

  const tabs = [
    { id: 'all', label: 'All Laws', icon: Scale, description: 'Analyze across BNS, BNSS & BSA', oldLaw: 'Comprehensive' },
    { id: 'bns', label: 'BNS', icon: Scale, description: 'Bharatiya Nyaya Sanhita (Offences)', oldLaw: 'IPC' },
    { id: 'bnss', label: 'BNSS', icon: Gavel, description: 'Bharatiya Nagarik Suraksha Sanhita (Procedures)', oldLaw: 'CrPC' },
    { id: 'bsa', label: 'BSA', icon: Shield, description: 'Bharatiya Sakshya Adhiniyam (Evidence)', oldLaw: 'Evidence Act' }
  ];

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
            Analyze case facts to identify BNS, BNSS & BSA sections with auto-generated remand notes
          </p>
        </motion.div>

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
