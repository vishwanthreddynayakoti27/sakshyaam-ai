import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Languages, FileText, Scale, Phone, ArrowRight, Zap } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';

const Dashboard = () => {
  const navigate = useNavigate();

  const modules = [
    {
      icon: Languages,
      title: 'Language Intelligence',
      description: 'Multi-format OCR, Translation & Legal Text Conversion',
      path: '/language-intelligence',
      image: 'https://images.unsplash.com/photo-1759771963975-8a4885446f1f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwyfHxkaWdpdGFsJTIwc291bmQlMjB3YXZlJTIwbmVvbiUyMHRlY2hub2xvZ3l8ZW58MHx8fHwxNzcyMzg0MzI1fDA&ixlib=rb-4.1.0&q=85',
      highlight: true
    },
    {
      icon: FileText,
      title: 'FIR Draft Assistant',
      description: 'Convert complaints to court-ready FIR narratives',
      path: '/fir-draft',
      image: 'https://images.unsplash.com/photo-1746470427686-4c3551f3d689?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxibHVlJTIwZGF0YSUyMG5ldHdvcmslMjBhYnN0cmFjdHxlbnwwfHx8fDE3NzIzODQzMzF8MA&ixlib=rb-4.1.0&q=85',
      highlight: false
    },
    {
      icon: Scale,
      title: 'BNS Intelligence',
      description: 'AI-powered section suggestions & IPC mapping',
      path: '/bns-intelligence',
      image: 'https://images.unsplash.com/photo-1746470427617-91e8dd28298d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHw0fHxibHVlJTIwZGF0YSUyMG5ldHdvcmslMjBhYnN0cmFjdHxlbnwwfHx8fDE3NzIzODQzMzF8MA&ixlib=rb-4.1.0&q=85',
      highlight: false
    },
    {
      icon: Phone,
      title: 'CDR Analyzer',
      description: 'Parse and analyze call detail records efficiently',
      path: '/cdr-analyzer',
      image: 'https://images.unsplash.com/photo-1746470427686-4c3551f3d689?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxibHVlJTIwZGF0YSUyMG5ldHdvcmslMjBhYnN0cmFjdHxlbnwwfHx8fDE3NzIzODQzMzF8MA&ixlib=rb-4.1.0&q=85',
      highlight: false
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
            <div className="flex items-center gap-2 mb-3">
              <Zap className="text-accent" size={28} strokeWidth={2} />
              <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="dashboard-title">
                Intelligence Modules
              </h1>
            </div>
            <p className="text-white/60 text-lg">Select a module to begin investigation assistance</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  data-testid={`module-card-${module.title.toLowerCase().replace(/ /g, '-')}`}
                  className={`group relative overflow-hidden bg-black/40 backdrop-blur-md rounded-xl border transition-all duration-500 hover:scale-[1.02] ${
                    module.highlight
                      ? 'border-accent shadow-[0_0_30px_rgba(0,242,255,0.2)] md:col-span-2'
                      : 'border-white/10 hover:border-accent/50'
                  }`}
                  onClick={() => navigate(module.path)}
                  style={{ cursor: 'pointer' }}
                >
                  <div
                    className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                    style={{
                      backgroundImage: `url(${module.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                  
                  <div className="relative p-8">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-lg ${
                          module.highlight
                            ? 'bg-accent/20 border border-accent'
                            : 'bg-white/5 border border-white/10 group-hover:border-accent/50'
                        } transition-all`}>
                          <Icon className={module.highlight ? 'text-accent' : 'text-white'} size={32} strokeWidth={1.5} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-heading font-bold text-white mb-1">{module.title}</h3>
                          <p className="text-white/70">{module.description}</p>
                        </div>
                      </div>
                      <ArrowRight className="text-white/40 group-hover:text-accent group-hover:translate-x-1 transition-all" size={24} />
                    </div>

                    {module.highlight && (
                      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-accent/20 border border-accent rounded-full">
                        <Zap size={14} className="text-accent" />
                        <span className="text-accent text-xs font-bold uppercase">Hero Module</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 p-6 bg-black/40 backdrop-blur-md rounded-xl border border-white/10"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-alert/20 rounded-lg border border-alert flex items-center justify-center flex-shrink-0">
                <span className="text-alert text-2xl">⚠️</span>
              </div>
              <div>
                <h4 className="text-white font-heading font-bold text-lg mb-2">System Notice</h4>
                <p className="text-white/60 text-sm leading-relaxed">
                  This is a Pre-CCTNS Intelligence and FIR Drafting Assistant. All drafts and analyses prepared here 
                  must be manually entered into official CCTNS systems. This system does NOT register FIRs directly.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Dashboard;
