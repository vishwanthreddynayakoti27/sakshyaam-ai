import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Search, BookOpen, ArrowRight, FileText, Gavel, Shield } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { api } from '../utils/api';

const LegalIntelligenceEngine = () => {
  const [activeTab, setActiveTab] = useState('bns');
  const [searchText, setSearchText] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);

  const tabs = [
    { id: 'bns', label: 'BNS', icon: Scale, description: 'Bharatiya Nyaya Sanhita (Offences)', oldLaw: 'IPC' },
    { id: 'bnss', label: 'BNSS', icon: Gavel, description: 'Bharatiya Nagarik Suraksha Sanhita (Procedures)', oldLaw: 'CrPC' },
    { id: 'bsa', label: 'BSA', icon: Shield, description: 'Bharatiya Sakshya Adhiniyam (Evidence)', oldLaw: 'Evidence Act' }
  ];

  const legalDatabase = {
    bns: [
      { section: 'BNS 103', title: 'Murder', description: 'Whoever commits murder shall be punished with death or imprisonment for life', oldEquivalent: 'IPC 302', keywords: ['murder', 'killed', 'death', 'homicide', 'slain'] },
      { section: 'BNS 105', title: 'Culpable Homicide', description: 'Causing death by doing an act with intention or knowledge', oldEquivalent: 'IPC 304', keywords: ['culpable', 'homicide', 'death', 'intention'] },
      { section: 'BNS 115', title: 'Voluntarily Causing Hurt', description: 'Whoever causes hurt voluntarily shall be punished', oldEquivalent: 'IPC 323', keywords: ['hurt', 'assault', 'beat', 'injury', 'attacked', 'hit'] },
      { section: 'BNS 117', title: 'Voluntarily Causing Grievous Hurt', description: 'Grievous hurt causing permanent damage', oldEquivalent: 'IPC 325', keywords: ['grievous', 'serious injury', 'fracture', 'permanent'] },
      { section: 'BNS 121', title: 'Causing Hurt by Dangerous Weapons', description: 'Hurt caused by weapons or means dangerous to life', oldEquivalent: 'IPC 324', keywords: ['weapon', 'knife', 'gun', 'dangerous', 'blade'] },
      { section: 'BNS 137', title: 'Kidnapping', description: 'Kidnapping from lawful guardianship', oldEquivalent: 'IPC 363', keywords: ['kidnapping', 'abducted', 'taken away', 'missing child'] },
      { section: 'BNS 140', title: 'Kidnapping for Ransom', description: 'Kidnapping or abducting for ransom', oldEquivalent: 'IPC 364A', keywords: ['ransom', 'kidnap', 'demand', 'money'] },
      { section: 'BNS 63', title: 'Sexual Harassment', description: 'Sexual harassment and punishment', oldEquivalent: 'IPC 354A', keywords: ['sexual', 'harassment', 'molestation', 'inappropriate'] },
      { section: 'BNS 64', title: 'Rape', description: 'Sexual assault without consent', oldEquivalent: 'IPC 376', keywords: ['rape', 'sexual assault', 'consent'] },
      { section: 'BNS 303', title: 'Theft', description: 'Dishonest taking of property', oldEquivalent: 'IPC 379', keywords: ['theft', 'stolen', 'stole', 'took', 'property', 'snatched'] },
      { section: 'BNS 309', title: 'Robbery', description: 'Robbery with violence or threat', oldEquivalent: 'IPC 392', keywords: ['robbery', 'robbed', 'violence', 'force', 'looted'] },
      { section: 'BNS 310', title: 'Dacoity', description: 'Robbery by five or more persons', oldEquivalent: 'IPC 395', keywords: ['dacoity', 'gang', 'armed robbery', 'group'] },
      { section: 'BNS 318', title: 'Cheating', description: 'Cheating and dishonestly inducing delivery of property', oldEquivalent: 'IPC 420', keywords: ['cheating', 'fraud', 'deceived', 'dishonest', 'scam'] },
      { section: 'BNS 319', title: 'Cheating by Personation', description: 'Cheating by pretending to be another person', oldEquivalent: 'IPC 419', keywords: ['impersonation', 'identity', 'pretend', 'fake'] },
      { section: 'BNS 329', title: 'Criminal Breach of Trust', description: 'Dishonest misappropriation of property entrusted', oldEquivalent: 'IPC 406', keywords: ['breach', 'trust', 'misappropriation', 'embezzlement'] },
      { section: 'BNS 336', title: 'Forgery', description: 'Making false documents with intent to cause damage', oldEquivalent: 'IPC 463', keywords: ['forgery', 'forged', 'fake document', 'fabricated'] },
      { section: 'BNS 351', title: 'Criminal Intimidation', description: 'Threatening injury to person, reputation or property', oldEquivalent: 'IPC 506', keywords: ['threat', 'intimidation', 'threatening', 'scared'] },
      { section: 'BNS 352', title: 'Intentional Insult', description: 'Intentional insult to provoke breach of peace', oldEquivalent: 'IPC 504', keywords: ['insult', 'abuse', 'provoke', 'humiliate'] }
    ],
    bnss: [
      { section: 'BNSS 35', title: 'Arrest Without Warrant', description: 'When police may arrest without warrant in cognizable offences', oldEquivalent: 'CrPC 41', keywords: ['arrest', 'arrested', 'custody', 'apprehend', 'detained'] },
      { section: 'BNSS 37', title: 'Arrest by Private Person', description: 'Private person may arrest in certain circumstances', oldEquivalent: 'CrPC 43', keywords: ['citizen arrest', 'private', 'caught'] },
      { section: 'BNSS 47', title: 'Search of Arrested Person', description: 'Search of person arrested', oldEquivalent: 'CrPC 51', keywords: ['search', 'body search', 'frisk'] },
      { section: 'BNSS 105', title: 'Power to Summon', description: 'Power to summon persons', oldEquivalent: 'CrPC 61', keywords: ['summon', 'summons', 'appear', 'court'] },
      { section: 'BNSS 173', title: 'Police Report to Magistrate', description: 'Report of police officer on completion of investigation', oldEquivalent: 'CrPC 173', keywords: ['chargesheet', 'final report', 'investigation'] },
      { section: 'BNSS 176', title: 'FIR Registration', description: 'Information in cognizable cases', oldEquivalent: 'CrPC 154', keywords: ['fir', 'first information', 'complaint', 'report'] },
      { section: 'BNSS 180', title: 'Investigation Procedure', description: 'Procedure for investigation', oldEquivalent: 'CrPC 157', keywords: ['investigation', 'inquiry', 'examine'] },
      { section: 'BNSS 185', title: 'Examination of Witnesses', description: 'Police officer examination of witnesses', oldEquivalent: 'CrPC 161', keywords: ['witness', 'statement', 'examine', 'testimony'] },
      { section: 'BNSS 187', title: 'Search Warrant', description: 'Power to issue search warrant', oldEquivalent: 'CrPC 93', keywords: ['search', 'warrant', 'seizure', 'premises', 'raid'] },
      { section: 'BNSS 193', title: 'Seizure of Property', description: 'Seizure of property which may be required as evidence', oldEquivalent: 'CrPC 102', keywords: ['seizure', 'seize', 'evidence', 'property'] },
      { section: 'BNSS 187(3)', title: 'Digital Evidence Seizure', description: 'Seizure of digital devices and electronic records', oldEquivalent: 'CrPC 91 (extended)', keywords: ['digital', 'phone', 'computer', 'electronic', 'device'] },
      { section: 'BNSS 480', title: 'Bail', description: 'Provisions relating to bail', oldEquivalent: 'CrPC 436-439', keywords: ['bail', 'release', 'surety', 'bond'] },
      { section: 'BNSS 483', title: 'Anticipatory Bail', description: 'Direction for grant of bail', oldEquivalent: 'CrPC 438', keywords: ['anticipatory', 'pre-arrest', 'bail'] }
    ],
    bsa: [
      { section: 'BSA 63', title: 'Admissibility of Electronic Records', description: 'Electronic records including digital evidence are admissible', oldEquivalent: 'Evidence Act 65B', keywords: ['digital', 'electronic', 'cctv', 'recording', 'computer', 'email', 'message'] },
      { section: 'BSA 64', title: 'Certificate for Electronic Evidence', description: 'Certificate required for electronic evidence', oldEquivalent: 'Evidence Act 65B(4)', keywords: ['certificate', 'authentication', 'electronic', 'custodian'] },
      { section: 'BSA 136', title: 'Authentication of Electronic Records', description: 'Hash value and digital signature authentication', oldEquivalent: 'Evidence Act 47A', keywords: ['hash', 'digital signature', 'authentication', 'verify'] },
      { section: 'BSA 23', title: 'Admissions', description: 'Statement suggesting inference of relevant fact', oldEquivalent: 'Evidence Act 17-21', keywords: ['admission', 'confess', 'admit', 'acknowledge'] },
      { section: 'BSA 24', title: 'Oral Admissions', description: 'Oral admissions relevancy', oldEquivalent: 'Evidence Act 22', keywords: ['oral', 'verbal', 'spoken', 'statement'] },
      { section: 'BSA 39', title: 'Dying Declaration', description: 'Statement by person who is dead', oldEquivalent: 'Evidence Act 32', keywords: ['dying', 'death bed', 'last words', 'declaration'] },
      { section: 'BSA 45', title: 'Expert Opinion', description: 'Opinions of experts', oldEquivalent: 'Evidence Act 45', keywords: ['expert', 'forensic', 'specialist', 'opinion', 'doctor'] },
      { section: 'BSA 47', title: 'Opinion on Digital Signature', description: 'Expert opinion on electronic signature', oldEquivalent: 'Evidence Act 47A', keywords: ['digital signature', 'electronic', 'expert'] },
      { section: 'BSA 57', title: 'Primary Evidence', description: 'Document itself produced as primary evidence', oldEquivalent: 'Evidence Act 62', keywords: ['original', 'primary', 'document', 'evidence'] },
      { section: 'BSA 58', title: 'Secondary Evidence', description: 'Copies when original not available', oldEquivalent: 'Evidence Act 63', keywords: ['copy', 'secondary', 'duplicate', 'photocopy'] },
      { section: 'BSA 118', title: 'Witness Competency', description: 'Who may testify as witness', oldEquivalent: 'Evidence Act 118', keywords: ['witness', 'competent', 'testify', 'testimony'] },
      { section: 'BSA 145', title: 'Cross Examination', description: 'Rules for cross examination', oldEquivalent: 'Evidence Act 145-146', keywords: ['cross', 'examination', 'question', 'contradict'] }
    ]
  };

  const handleAnalyze = async () => {
    if (!searchText.trim()) {
      toast.error('Please enter text to analyze');
      return;
    }

    setAnalyzing(true);
    
    try {
      const response = await api.post('/bns/analyze', { text: searchText });
      
      const textLower = searchText.toLowerCase();
      const currentLawData = legalDatabase[activeTab];
      const matchedSections = [];
      const matchedKeywords = [];

      currentLawData.forEach(item => {
        item.keywords.forEach(keyword => {
          if (textLower.includes(keyword)) {
            if (!matchedSections.find(s => s.section === item.section)) {
              matchedSections.push(item);
              matchedKeywords.push(keyword);
            }
          }
        });
      });

      setResults({
        sections: matchedSections,
        keywords: [...new Set(matchedKeywords)],
        lawType: activeTab.toUpperCase()
      });

      if (matchedSections.length > 0) {
        toast.success(`Found ${matchedSections.length} relevant sections`);
      } else {
        toast.info('No matching sections found. Try different keywords.');
      }
    } catch (err) {
      toast.error('Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSectionSearch = () => {
    if (!sectionSearch.trim()) {
      toast.error('Please enter a section number');
      return;
    }

    const searchLower = sectionSearch.toLowerCase().replace(/\s+/g, '');
    let found = null;
    let foundIn = null;

    Object.entries(legalDatabase).forEach(([lawType, sections]) => {
      sections.forEach(item => {
        const sectionLower = item.section.toLowerCase().replace(/\s+/g, '');
        const oldLower = item.oldEquivalent.toLowerCase().replace(/\s+/g, '');
        
        if (sectionLower.includes(searchLower) || oldLower.includes(searchLower) || 
            searchLower.includes(sectionLower.replace(/[a-z]/gi, '')) ||
            searchLower.includes(oldLower.replace(/[a-z]/gi, ''))) {
          found = item;
          foundIn = lawType;
        }
      });
    });

    if (found) {
      setActiveTab(foundIn);
      setResults({
        sections: [found],
        keywords: [],
        lawType: foundIn.toUpperCase(),
        isDirectSearch: true
      });
      toast.success(`Found: ${found.section}`);
    } else {
      toast.error('Section not found');
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
            BNS, BNSS & BSA Analysis with IPC/CrPC/Evidence Act Mappings
          </p>
        </motion.div>

        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={`flex-1 p-4 rounded-lg border transition-all ${
                  activeTab === tab.id
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30'
                }`}
              >
                <Icon size={24} className="mx-auto mb-2" />
                <p className="font-bold">{tab.label}</p>
                <p className="text-xs opacity-70">{tab.description}</p>
                <p className="text-xs mt-1 opacity-50">Replaces: {tab.oldLaw}</p>
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
              placeholder="Enter complaint text, case facts, or incident description to identify applicable legal sections..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="bg-white/5 border-white/20 text-white min-h-[150px] mb-4"
              data-testid="case-text-input"
            />

            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              data-testid="analyze-btn"
              className="w-full bg-accent text-black font-bold hover:bg-accent/80 mb-6"
            >
              {analyzing ? 'Analyzing...' : `Analyze Under ${activeTab.toUpperCase()}`}
            </Button>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <BookOpen size={18} className="text-accent" />
                Direct Section Lookup
              </h3>

              <div className="flex gap-2">
                <Input
                  placeholder="Enter section (e.g., BNS 303, IPC 420, CrPC 154)"
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
                Search by new law (BNS/BNSS/BSA) or old law (IPC/CrPC/Evidence Act) sections
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
              Suggested Sections
            </h2>

            {!results ? (
              <div className="flex items-center justify-center h-64 text-white/40">
                <div className="text-center">
                  <Scale size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Enter case facts to find applicable sections</p>
                </div>
              </div>
            ) : results.sections.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-white/40">
                <div className="text-center">
                  <Search size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No matching sections found</p>
                  <p className="text-sm mt-1">Try different keywords</p>
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
                        <span className="text-accent font-bold text-lg">{section.section}</span>
                        <h4 className="text-white font-semibold">{section.title}</h4>
                      </div>
                      <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded border border-white/20">
                        {results.lawType}
                      </span>
                    </div>

                    <p className="text-white/70 text-sm mb-3">{section.description}</p>

                    <div className="flex items-center gap-2 p-2 bg-black/30 rounded">
                      <span className="text-white/50 text-xs">Old Law Equivalent:</span>
                      <ArrowRight size={12} className="text-accent" />
                      <span className="text-accent text-sm font-semibold">{section.oldEquivalent}</span>
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
          className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <Scale size={24} className="text-accent mb-2" />
            <h3 className="text-white font-bold mb-1">BNS Sections</h3>
            <p className="text-white/60 text-sm">{legalDatabase.bns.length} offence provisions</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <Gavel size={24} className="text-accent mb-2" />
            <h3 className="text-white font-bold mb-1">BNSS Sections</h3>
            <p className="text-white/60 text-sm">{legalDatabase.bnss.length} procedural provisions</p>
          </div>
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <Shield size={24} className="text-accent mb-2" />
            <h3 className="text-white font-bold mb-1">BSA Sections</h3>
            <p className="text-white/60 text-sm">{legalDatabase.bsa.length} evidence provisions</p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default LegalIntelligenceEngine;
