import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Languages, 
  FileText, 
  Scale, 
  Phone, 
  ArrowRight, 
  Zap, 
  Shield, 
  DollarSign,
  MapPin,
  Calendar,
  Activity,
  FileStack,
  FolderOpen,
  Package
} from 'lucide-react';
import Layout from '../components/Layout';

const Dashboard = () => {
  const navigate = useNavigate();

  const modules = [
    {
      icon: Languages,
      title: 'Language Intelligence',
      description: 'OCR, Speech-to-Text, Translation & Legal Rewrite Pipeline',
      path: '/language-intelligence',
      color: 'from-cyan-500/20 to-blue-600/20',
      borderColor: 'border-cyan-500/50',
      iconColor: 'text-cyan-400',
      highlight: true
    },
    {
      icon: FileText,
      title: 'FIR Draft Assistant',
      description: 'Convert complaints to court-ready FIR narratives with error analysis',
      path: '/fir-draft',
      color: 'from-purple-500/20 to-indigo-600/20',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-400'
    },
    {
      icon: Scale,
      title: 'Legal Intelligence Engine',
      description: 'BNS, BNSS & BSA Analysis with Case Peer-Reviewer & BSA 63 Certifier',
      path: '/legal-intelligence',
      color: 'from-amber-500/20 to-orange-600/20',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400'
    },
    {
      icon: FileStack,
      title: 'Investigation Documents',
      description: 'Generate police documents - Petition, CSR, Witness Statement & more',
      path: '/investigation-documents',
      color: 'from-indigo-500/20 to-violet-600/20',
      borderColor: 'border-indigo-500/30',
      iconColor: 'text-indigo-400',
      isNew: true
    },
    {
      icon: Shield,
      title: 'Media Forensic Validator',
      description: 'Multi-layer deepfake detection for audio/video evidence',
      path: '/media-forensic',
      color: 'from-red-500/20 to-pink-600/20',
      borderColor: 'border-red-500/30',
      iconColor: 'text-red-400'
    },
    {
      icon: DollarSign,
      title: 'Fraud Recovery Assistant',
      description: 'Bank freeze letters, UPI investigation & transaction analysis',
      path: '/fraud-recovery',
      color: 'from-green-500/20 to-emerald-600/20',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-400'
    },
    {
      icon: Phone,
      title: 'CDR Analyzer',
      description: 'Parse CDR, contact frequency analysis & call timeline',
      path: '/cdr-analyzer',
      color: 'from-blue-500/20 to-cyan-600/20',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400'
    },
    {
      icon: Calendar,
      title: 'Smart Summons Tracker',
      description: 'OCR-powered court summons management with reminders',
      path: '/smart-summons',
      color: 'from-violet-500/20 to-purple-600/20',
      borderColor: 'border-violet-500/30',
      iconColor: 'text-violet-400'
    },
    {
      icon: MapPin,
      title: 'Jurisdiction Finder',
      description: '700+ Telangana PS lookup with Zero FIR generator',
      path: '/jurisdiction-finder',
      color: 'from-teal-500/20 to-cyan-600/20',
      borderColor: 'border-teal-500/30',
      iconColor: 'text-teal-400'
    },
    {
      icon: Activity,
      title: 'SENTICEL Diary',
      description: 'Social pulse monitoring & volatility alerts for cases',
      path: '/senticel-diary',
      color: 'from-rose-500/20 to-red-600/20',
      borderColor: 'border-rose-500/30',
      iconColor: 'text-rose-400',
      isNew: true
    },
    {
      icon: Package,
      title: 'Evidence Manager',
      description: 'Upload, hash & manage digital evidence with integrity verification',
      path: '/evidence-manager',
      color: 'from-orange-500/20 to-amber-600/20',
      borderColor: 'border-orange-500/30',
      iconColor: 'text-orange-400',
      isNew: true
    },
    {
      icon: FolderOpen,
      title: 'Case File Manager',
      description: 'Organize case documents, evidence & generate case file PDFs',
      path: '/case-file-manager',
      color: 'from-slate-500/20 to-gray-600/20',
      borderColor: 'border-slate-500/30',
      iconColor: 'text-slate-400',
      isNew: true
    }
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="dashboard">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-accent/20 rounded-lg border border-accent">
                <Activity className="text-accent" size={28} strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="dashboard-title">
                  SAAKSHYAM AI
                </h1>
                <p className="text-accent text-sm font-semibold tracking-wider">INVESTIGATION COMMAND CONSOLE</p>
              </div>
            </div>
            <p className="text-white/60 text-lg mt-2">Select a module to begin cyber investigation assistance</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  data-testid={`module-card-${module.title.toLowerCase().replace(/ /g, '-')}`}
                  className={`group relative overflow-hidden bg-gradient-to-br ${module.color} backdrop-blur-md rounded-xl border ${module.borderColor} transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer ${
                    module.highlight ? 'md:col-span-2 lg:col-span-2' : ''
                  }`}
                  onClick={() => navigate(module.path)}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-all" />
                  
                  <div className="relative p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-3 rounded-lg bg-white/5 border border-white/10 group-hover:border-white/20 transition-all`}>
                        <Icon className={module.iconColor} size={24} strokeWidth={1.5} />
                      </div>
                      <div className="flex items-center gap-2">
                        {module.isNew && (
                          <span className="px-2 py-0.5 bg-success/20 text-success text-xs font-bold rounded border border-success/30">
                            NEW
                          </span>
                        )}
                        {module.highlight && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-accent/20 text-accent text-xs font-bold rounded border border-accent/30">
                            <Zap size={10} />
                            HERO
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-lg font-heading font-bold text-white mb-1 group-hover:text-accent transition-colors">
                      {module.title}
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed">
                      {module.description}
                    </p>

                    <div className="mt-4 flex items-center text-white/40 group-hover:text-accent transition-colors">
                      <span className="text-xs font-semibold uppercase tracking-wider">Access Module</span>
                      <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 p-5 bg-black/40 backdrop-blur-md rounded-xl border border-white/10"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-alert/20 rounded-lg border border-alert flex items-center justify-center flex-shrink-0">
                <span className="text-alert text-xl">!</span>
              </div>
              <div>
                <h4 className="text-white font-heading font-bold text-lg mb-2">System Notice</h4>
                <p className="text-white/60 text-sm leading-relaxed">
                  This is a <span className="text-accent font-semibold">Pre-CCTNS Intelligence</span> and FIR Drafting Assistant. 
                  All drafts and analyses prepared here must be manually entered into official CCTNS systems. 
                  This system does NOT register FIRs directly. Evidence integrity is maintained via SHA-256 hashing 
                  for compliance with <span className="text-accent">BSA Section 63</span>.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <p className="text-2xl font-bold text-accent">12</p>
              <p className="text-white/60 text-xs">Active Modules</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <p className="text-2xl font-bold text-success">BNS</p>
              <p className="text-white/60 text-xs">2023 Compliant</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <p className="text-2xl font-bold text-purple-400">SHA-256</p>
              <p className="text-white/60 text-xs">Evidence Hash</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
              <p className="text-2xl font-bold text-amber-400">BSA 63</p>
              <p className="text-white/60 text-xs">Digital Evidence</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Dashboard;
