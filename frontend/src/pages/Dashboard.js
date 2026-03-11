import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Languages, 
  FileText, 
  Scale, 
  Phone, 
  Search,
  User,
  MapPin,
  Calendar,
  Activity,
  FileStack,
  FolderOpen,
  Package,
  DollarSign,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { Input } from '../components/ui/input';

// Background image URL
const BACKGROUND_IMAGE = "https://customer-assets.emergentagent.com/job_nyaya-prahari/artifacts/f5u6gl1x_ChatGPT%20Image%20Mar%2011%2C%202026%2C%2001_48_38%20PM.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [officer, setOfficer] = useState({ name: 'Officer', role: 'Sub-Inspector', station: 'Cyber Cell' });

  useEffect(() => {
    // Load officer data
    const storedOfficer = localStorage.getItem('officer');
    if (storedOfficer) {
      const data = JSON.parse(storedOfficer);
      setOfficer({
        name: data.name || 'Officer',
        role: data.rank || 'Sub-Inspector',
        station: data.district || 'Cyber Cell'
      });
    }
  }, []);

  const modules = [
    { icon: Languages, title: 'Language Intelligence', path: '/language-intelligence', color: '#00C2FF' },
    { icon: FileText, title: 'FIR Draft Assistant', path: '/fir-draft', color: '#4F7EFF' },
    { icon: Scale, title: 'Legal Intelligence', path: '/legal-intelligence', color: '#00FFB3' },
    { icon: DollarSign, title: 'Fraud Recovery', path: '/fraud-recovery', color: '#FF3B3B' },
    { icon: Phone, title: 'CDR Analyzer', path: '/cdr-analyzer', color: '#FFB800' },
    { icon: Calendar, title: 'Smart Summons', path: '/smart-summons', color: '#00C2FF' },
    { icon: MapPin, title: 'Jurisdiction Finder', path: '/jurisdiction-finder', color: '#4F7EFF' },
    { icon: Activity, title: 'SENTICEL Diary', path: '/senticel-diary', color: '#FF3B3B' },
    { icon: Package, title: 'Evidence Manager', path: '/evidence-manager', color: '#00FFB3' },
    { icon: FolderOpen, title: 'Case File Manager', path: '/case-file-manager', color: '#FFB800' },
    { icon: FileStack, title: 'Investigation Docs', path: '/investigation-documents', color: '#00C2FF' },
  ];

  const activeInvestigations = [
    { id: 1, title: 'Fraud Case', subtitle: 'Transaction Analysis', status: 'In Progress', priority: 'high' },
    { id: 2, title: 'Cyber Harassment', subtitle: 'Social Media Tracking', status: 'Pending', priority: 'medium' },
    { id: 3, title: 'Financial Scam', subtitle: 'Bank Freeze Request', status: 'Critical', priority: 'critical' },
  ];

  const filteredModules = modules.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen overflow-hidden relative bg-[#030614]" data-testid="dashboard">
      {/* System Status Warning Bar at TOP */}
      <div className="relative z-20 bg-gradient-to-r from-[#FFB800]/20 via-[#FF3B3B]/20 to-[#FFB800]/20 border-b border-[#FFB800]/50">
        <div className="max-w-[1800px] mx-auto px-6 py-2 flex items-center justify-center gap-4">
          <AlertTriangle className="text-[#FFB800] animate-pulse" size={18} />
          <div className="flex items-center gap-6 text-sm">
            <span className="text-[#FFB800] font-bold">System Status:</span>
            <span className="text-white/80">Pre-CCTNS Intelligence System</span>
            <span className="text-white/40">|</span>
            <span className="text-white/80">BNS 2023 & BSA Sec. 63 Compliant</span>
            <span className="text-white/40">|</span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00FFB3] animate-pulse"></span>
              <span className="text-[#00FFB3] font-semibold">All Systems Online</span>
            </span>
          </div>
        </div>
      </div>

      {/* Top Bar */}
      <div className="relative z-20 px-6 py-4 border-b border-[#00C2FF]/20 bg-[#030614]/90 backdrop-blur-md">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          {/* Search Bar */}
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00C2FF]/50" size={18} />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Investigation Tool..."
              className="w-full pl-12 pr-4 py-3 bg-[#0B0F1A]/60 border border-[#00C2FF]/30 rounded-full text-white placeholder:text-white/40 focus:border-[#00C2FF] focus:ring-1 focus:ring-[#00C2FF]/50"
              data-testid="search-input"
            />
          </div>

          {/* User Info */}
          <div 
            className="flex items-center gap-4 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all"
            onClick={() => navigate('/profile')}
            data-testid="user-profile-link"
          >
            <div className="text-right">
              <p className="text-white font-semibold">{officer.name}</p>
              <p className="text-[#00C2FF]/70 text-xs">{officer.role} • {officer.station}</p>
            </div>
            <motion.div 
              className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C2FF]/30 to-[#4F7EFF]/30 border-2 border-[#00C2FF]/50 flex items-center justify-center"
              whileHover={{ scale: 1.1, boxShadow: '0 0 20px rgba(0,194,255,0.5)' }}
            >
              <User className="text-[#00C2FF]" size={24} />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex h-[calc(100vh-105px)]">
        {/* Left Sidebar - Module Cards */}
        <div className="w-72 border-r border-[#00C2FF]/20 bg-[#030614]/90 backdrop-blur-md p-4 overflow-y-auto z-20">
          <h3 className="text-[#00C2FF] text-xs font-bold uppercase tracking-wider mb-4 px-2">Investigation Modules</h3>
          
          <div className="space-y-2">
            {filteredModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.path}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ 
                    scale: 1.02,
                    x: 5,
                  }}
                  onClick={() => navigate(module.path)}
                  data-testid={`module-${module.title.toLowerCase().replace(/ /g, '-')}`}
                  className="relative group cursor-pointer"
                >
                  {/* Card Background with Glow */}
                  <div 
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
                    style={{ backgroundColor: module.color, opacity: 0.2 }}
                  />
                  
                  {/* Card Content */}
                  <div 
                    className="relative p-4 rounded-xl border transition-all duration-300 bg-[#0B0F1A]/80 group-hover:bg-[#0B0F1A]/95"
                    style={{ 
                      borderColor: `${module.color}30`,
                      boxShadow: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = module.color;
                      e.currentTarget.style.boxShadow = `0 0 20px ${module.color}40, inset 0 0 20px ${module.color}10`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${module.color}30`;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon with Glow */}
                      <motion.div 
                        className="p-2.5 rounded-lg transition-all duration-300"
                        style={{ 
                          backgroundColor: `${module.color}20`,
                          boxShadow: `0 0 10px ${module.color}30`
                        }}
                        whileHover={{
                          boxShadow: `0 0 20px ${module.color}60`
                        }}
                      >
                        <Icon 
                          size={20} 
                          style={{ color: module.color }}
                          className="transition-all duration-300 group-hover:drop-shadow-lg"
                        />
                      </motion.div>
                      
                      {/* Title */}
                      <span className="text-white/90 text-sm font-medium group-hover:text-white transition-colors">
                        {module.title}
                      </span>
                    </div>
                    
                    {/* Hover Indicator */}
                    <motion.div
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
                      initial={{ x: -10 }}
                      whileHover={{ x: 0 }}
                    >
                      <ChevronRight size={16} style={{ color: module.color }} />
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Center Area - Full Background Image */}
        <div 
          className="flex-1 relative"
          style={{
            backgroundImage: `url(${BACKGROUND_IMAGE})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Optional: Subtle overlay for better text readability if needed */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#030614]/30 via-transparent to-[#030614]/30" />
        </div>

        {/* Right Panel - Active Investigations */}
        <div className="w-80 border-l border-[#00C2FF]/20 bg-[#030614]/90 backdrop-blur-md p-4 overflow-y-auto z-20">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Activity className="text-[#00C2FF]" size={20} />
            </motion.div>
            Active Investigations
          </h2>

          <div className="space-y-3">
            {activeInvestigations.map((inv, index) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                  inv.priority === 'critical' 
                    ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/50 hover:border-[#FF3B3B] hover:shadow-[0_0_20px_rgba(255,59,59,0.3)]' 
                    : inv.priority === 'high'
                    ? 'bg-[#FFB800]/10 border-[#FFB800]/50 hover:border-[#FFB800] hover:shadow-[0_0_20px_rgba(255,184,0,0.3)]'
                    : 'bg-[#00C2FF]/10 border-[#00C2FF]/30 hover:border-[#00C2FF] hover:shadow-[0_0_20px_rgba(0,194,255,0.3)]'
                }`}
                data-testid={`investigation-${inv.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-semibold">{inv.title}</h3>
                  <motion.span 
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      inv.priority === 'critical' 
                        ? 'bg-[#FF3B3B]/20 text-[#FF3B3B]'
                        : inv.priority === 'high'
                        ? 'bg-[#FFB800]/20 text-[#FFB800]'
                        : 'bg-[#00C2FF]/20 text-[#00C2FF]'
                    }`}
                    animate={inv.priority === 'critical' ? { opacity: [1, 0.5, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {inv.status}
                  </motion.span>
                </div>
                <p className="text-white/50 text-sm">{inv.subtitle}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full bg-[#4F7EFF]/30 border border-[#4F7EFF]/50" />
                    ))}
                  </div>
                  <ChevronRight className="text-white/40" size={16} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <motion.div 
              className="p-4 rounded-xl border border-[#00FFB3]/30 text-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(0,255,179,0.1) 0%, transparent 100%)',
                boxShadow: '0 0 30px rgba(0,255,179,0.1)'
              }}
              whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(0,255,179,0.2)' }}
            >
              <p className="text-3xl font-bold text-[#00FFB3]">247</p>
              <p className="text-white/50 text-xs">Resolved</p>
            </motion.div>
            <motion.div 
              className="p-4 rounded-xl border border-[#FFB800]/30 text-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(255,184,0,0.1) 0%, transparent 100%)',
                boxShadow: '0 0 30px rgba(255,184,0,0.1)'
              }}
              whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(255,184,0,0.2)' }}
            >
              <p className="text-3xl font-bold text-[#FFB800]">89</p>
              <p className="text-white/50 text-xs">Active</p>
            </motion.div>
          </div>

          {/* Legend */}
          <div className="mt-4 p-4 rounded-xl border border-white/10 bg-black/30">
            <p className="text-white/60 text-xs mb-3 font-semibold">Node Legend</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Cyber Crime', color: '#00C2FF' },
                { label: 'Fraud', color: '#FF3B3B' },
                { label: 'Active', color: '#FFB800' },
                { label: 'Resolved', color: '#00FFB3' }
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <motion.div 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: item.color,
                      boxShadow: `0 0 10px ${item.color}`
                    }}
                    animate={{
                      boxShadow: [
                        `0 0 5px ${item.color}`,
                        `0 0 15px ${item.color}`,
                        `0 0 5px ${item.color}`
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-white/60 text-xs">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
