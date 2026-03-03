import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Search, Zap, FileText } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { bns } from '../utils/api';

const CriminalLawEngine = () => {
  const [analysisText, setAnalysisText] = useState('');
  const [sectionNumber, setSectionNumber] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const quickChips = [
    { label: 'Assault', keyword: 'assault' },
    { label: 'Robbery', keyword: 'robbery' },
    { label: 'Theft', keyword: 'theft' },
    { label: 'Arrest', keyword: 'arrest' },
    { label: 'Search', keyword: 'search' },
    { label: 'CCTV', keyword: 'cctv' },
  ];

  const handleAnalyze = async () => {
    if (!analysisText.trim()) {
      toast.error('Please enter text to analyze');
      return;
    }

    setLoading(true);
    try {
      const response = await bns.analyze(analysisText);
      setAnalysisResult(response);
      
      const offenceCount = response.suggested_sections.filter(s => s.category === 'offence').length;
      const procedureCount = response.suggested_sections.filter(s => s.category === 'procedure').length;
      const evidenceCount = response.suggested_sections.filter(s => s.category === 'evidence').length;
      
      toast.success(`Found ${offenceCount} BNS, ${procedureCount} BNSS, ${evidenceCount} BSA sections`);
    } catch (err) {
      toast.error('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!sectionNumber.trim()) {
      toast.error('Please enter a section number');
      return;
    }

    try {
      const response = await bns.search(sectionNumber);
      setSearchResult(response);
      if (response.message) {
        toast.info(response.message);
      } else {
        toast.success('Section found');
      }
    } catch (err) {
      toast.error('Search failed');
    }
  };

  const handleQuickChip = (keyword) => {
    setAnalysisText(prev => prev + (prev ? ' ' : '') + keyword);
  };

  const handleInsertToDraft = (section) => {
    const sectionText = `${section.section_number} - ${section.title}`;
    navigator.clipboard.writeText(sectionText);
    toast.success('Section copied to clipboard!');
  };

  const offenceSections = analysisResult?.suggested_sections.filter(s => s.category === 'offence') || [];
  const procedureSections = analysisResult?.suggested_sections.filter(s => s.category === 'procedure') || [];
  const evidenceSections = analysisResult?.suggested_sections.filter(s => s.category === 'evidence') || [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="criminal-law-engine-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-heading font-bold text-white text-glow mb-3" data-testid="page-title">
            Criminal Law Intelligence Engine
          </h1>
          <p className="text-white/60 text-lg">
            Comprehensive analysis: BNS (Offence) • BNSS (Procedure) • BSA (Evidence)
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-4">
              <FileText className="text-accent" size={24} />
              <h2 className="text-xl font-heading font-bold text-white" data-testid="fir-analyzer-title">
                FIR/Complaint Analyzer
              </h2>
            </div>

            <div className="mb-4">
              <label className="text-white/90 mb-2 block text-sm">Quick Keywords</label>
              <div className="flex flex-wrap gap-2">
                {quickChips.map((chip) => (
                  <button
                    key={chip.keyword}
                    onClick={() => handleQuickChip(chip.keyword)}
                    data-testid={`quick-chip-${chip.keyword}`}
                    className="px-3 py-1 bg-accent/20 border border-accent/30 text-accent rounded-full text-sm hover:bg-accent/30 transition-all"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              data-testid="analysis-textarea"
              value={analysisText}
              onChange={(e) => setAnalysisText(e.target.value)}
              placeholder="Paste FIR text or complaint here...

Example:
The accused assaulted the complainant, searched his premises without warrant, and seized digital devices. CCTV recording was obtained as evidence."
              className="bg-black/20 border-white/10 focus:border-accent text-white min-h-[250px] font-mono text-sm mb-4"
            />

            <Button
              data-testid="analyze-button"
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider"
            >
              {loading ? 'Analyzing...' : 'Analyze Legal Sections'}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-4">
              <Search className="text-accent" size={24} />
              <h2 className="text-xl font-heading font-bold text-white" data-testid="section-mapper-title">
                Section Mapper
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/90 mb-2 block text-sm">Enter Section Number</label>
                <div className="flex gap-2">
                  <Input
                    data-testid="section-search-input"
                    value={sectionNumber}
                    onChange={(e) => setSectionNumber(e.target.value)}
                    placeholder="e.g., 103, BNS 303, BNSS 35"
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                  />
                  <Button
                    data-testid="search-section-button"
                    onClick={handleSearch}
                    className="bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm px-6"
                  >
                    <Search size={16} />
                  </Button>
                </div>
              </div>

              {searchResult && !searchResult.message && (
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-4" data-testid="search-result">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-accent font-bold font-heading text-lg">{searchResult.bns}</span>
                    <span className="text-white/60 text-sm">→ {searchResult.ipc}</span>
                  </div>
                  <p className="text-white text-sm">{searchResult.title}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {analysisResult && analysisResult.suggested_sections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-6">
              <Zap className="text-accent" size={24} />
              <h2 className="text-xl font-heading font-bold text-white">Analysis Results</h2>
              <span className="ml-auto text-success font-bold">
                {analysisResult.suggested_sections.length} Section(s) Detected
              </span>
            </div>

            {analysisResult.matched_keywords.length > 0 && (
              <div className="mb-6">
                <span className="text-white/60 text-sm mr-2">Matched Keywords:</span>
                {analysisResult.matched_keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-block px-2 py-1 bg-success/20 border border-success/30 text-success rounded text-xs mr-2 mb-2"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}

            <Tabs defaultValue="bns" className="w-full">
              <TabsList className="bg-black/40 border border-white/10 mb-6">
                <TabsTrigger value="bns" className="data-[state=active]:bg-accent data-[state=active]:text-black">
                  BNS (Offence) {offenceSections.length > 0 && `(${offenceSections.length})`}
                </TabsTrigger>
                <TabsTrigger value="bnss" className="data-[state=active]:bg-accent data-[state=active]:text-black">
                  BNSS (Procedure) {procedureSections.length > 0 && `(${procedureSections.length})`}
                </TabsTrigger>
                <TabsTrigger value="bsa" className="data-[state=active]:bg-accent data-[state=active]:text-black">
                  BSA (Evidence) {evidenceSections.length > 0 && `(${evidenceSections.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="bns" className="space-y-4">
                {offenceSections.length === 0 ? (
                  <p className="text-white/60 text-center py-8">No offence sections detected</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {offenceSections.map((section, index) => (
                      <div
                        key={index}
                        className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-accent/50 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-accent font-bold font-heading text-lg">{section.section_number}</span>
                          {section.ipc_equivalent && (
                            <span className="text-white/40 text-xs">{section.ipc_equivalent}</span>
                          )}
                        </div>
                        <h3 className="text-white font-semibold mb-2">{section.title}</h3>
                        <p className="text-white/60 text-sm mb-3">{section.description}</p>
                        <Button
                          onClick={() => handleInsertToDraft(section)}
                          className="w-full bg-transparent border border-accent/50 text-accent hover:bg-accent/10 text-xs"
                        >
                          Insert into Draft
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bnss" className="space-y-4">
                {procedureSections.length === 0 ? (
                  <p className="text-white/60 text-center py-8">No procedure sections detected</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {procedureSections.map((section, index) => (
                      <div
                        key={index}
                        className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-accent/50 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-accent font-bold font-heading text-lg">{section.section_number}</span>
                          {section.crpc_equivalent && (
                            <span className="text-white/40 text-xs">{section.crpc_equivalent}</span>
                          )}
                        </div>
                        <h3 className="text-white font-semibold mb-2">{section.title}</h3>
                        <p className="text-white/60 text-sm mb-3">{section.description}</p>
                        <Button
                          onClick={() => handleInsertToDraft(section)}
                          className="w-full bg-transparent border border-accent/50 text-accent hover:bg-accent/10 text-xs"
                        >
                          Insert into Draft
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bsa" className="space-y-4">
                {evidenceSections.length === 0 ? (
                  <p className="text-white/60 text-center py-8">No evidence sections detected</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {evidenceSections.map((section, index) => (
                      <div
                        key={index}
                        className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-accent/50 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-accent font-bold font-heading text-lg">{section.section_number}</span>
                          {section.evidence_act_equivalent && (
                            <span className="text-white/40 text-xs">{section.evidence_act_equivalent}</span>
                          )}
                        </div>
                        <h3 className="text-white font-semibold mb-2">{section.title}</h3>
                        <p className="text-white/60 text-sm mb-3">{section.description}</p>
                        <Button
                          onClick={() => handleInsertToDraft(section)}
                          className="w-full bg-transparent border border-accent/50 text-accent hover:bg-accent/10 text-xs"
                        >
                          Insert into Draft
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default CriminalLawEngine;
