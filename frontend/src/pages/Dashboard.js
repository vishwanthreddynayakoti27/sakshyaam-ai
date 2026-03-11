import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  AlertCircle,
  ChevronRight,
  Shield,
  X
} from 'lucide-react';
import { Input } from '../components/ui/input';

// Background image URL
const BACKGROUND_IMAGE = "https://customer-assets.emergentagent.com/job_nyaya-prahari/artifacts/f5u6gl1x_ChatGPT%20Image%20Mar%2011%2C%202026%2C%2001_48_38%20PM.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [officer, setOfficer] = useState({ name: 'Officer', role: 'Sub-Inspector', station: 'Cyber Cell' });
  const [showWelcome, setShowWelcome] = useState(false);

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
      
      // Show welcome message on first load
      const hasShownWelcome = sessionStorage.getItem('welcomeShown');
      if (!hasShownWelcome) {
        setShowWelcome(true);
        sessionStorage.setItem('welcomeShown', 'true');
        setTimeout(() => setShowWelcome(false), 5000);
      }
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
      {/* Animated Stars Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Centered India Map Background */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="relative"
        >
          {/* Pulsing Glow Effect */}
          <motion.div
            className="absolute inset-0 z-0"
            animate={{
              boxShadow: [
                '0 0 100px 50px rgba(0,194,255,0.1)',
                '0 0 150px 75px rgba(0,194,255,0.2)',
                '0 0 100px 50px rgba(0,194,255,0.1)',
              ]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              borderRadius: '50%',
              width: '700px',
              height: '700px',
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
              position: 'absolute'
            }}
          />
          
          {/* India Map Image */}
          <motion.img
            src={BACKGROUND_IMAGE}
            alt="India Cyber Map"
            className="w-[800px] h-[800px] object-contain"
            animate={{
              filter: [
                'drop-shadow(0 0 30px rgba(0,194,255,0.3))',
                'drop-shadow(0 0 50px rgba(0,194,255,0.5))',
                'drop-shadow(0 0 30px rgba(0,194,255,0.3))',
              ]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Scanning Line Animation */}
          <motion.div
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00C2FF] to-transparent opacity-50"
            animate={{
              top: ['10%', '90%', '10%'],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </motion.div>
      </div>

      {/* Welcome Banner */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-[#00C2FF]/20 via-[#4F7EFF]/20 to-[#00C2FF]/20 backdrop-blur-md border-b border-[#00C2FF]/30"
          >
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="w-12 h-12 rounded-full bg-[#00C2FF]/20 border-2 border-[#00C2FF] flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Shield className="text-[#00C2FF]" size={24} />
                </motion.div>
                <div>
                  <motion.h2 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl font-bold text-white"
                  >
                    Welcome, <span className="text-[#00C2FF]">{officer.name}</span>!
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-white/70"
                  >
                    {officer.role} • {officer.station} Police
                  </motion.p>
                </div>
              </div>
              <button 
                onClick={() => setShowWelcome(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="text-white/60 hover:text-white" size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <div className={`relative z-10 px-6 py-4 border-b border-[#00C2FF]/20 bg-[#030614]/80 backdrop-blur-md ${showWelcome ? 'mt-20' : ''}`}>
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

      <div className="relative z-10 flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Module Cards */}
        <div className="w-72 border-r border-[#00C2FF]/20 bg-[#030614]/80 backdrop-blur-md p-4 overflow-y-auto">
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
                    className="relative p-4 rounded-xl border transition-all duration-300 bg-[#0B0F1A]/60 group-hover:bg-[#0B0F1A]/80"
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

          {/* System Info Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 p-4 rounded-xl border border-[#4F7EFF]/30 bg-gradient-to-br from-[#4F7EFF]/10 to-transparent"
            style={{ boxShadow: '0 0 30px rgba(79,126,255,0.1)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-[#4F7EFF]" />
              <span className="text-[#4F7EFF] text-xs font-semibold">System Status</span>
            </div>
            <p className="text-white/50 text-xs leading-relaxed">
              Pre-CCTNS Intelligence System
            </p>
            <p className="text-white/40 text-xs mt-1">
              BNS 2023 & BSA Sec. 63 Compliant
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00FFB3] animate-pulse" />
              <span className="text-[#00FFB3] text-xs">All Systems Online</span>
            </div>
          </motion.div>
        </div>

        {/* Center Area - Empty to show background */}
        <div className="flex-1" />

        {/* Right Panel - Active Investigations */}
        <div className="w-80 border-l border-[#00C2FF]/20 bg-[#030614]/80 backdrop-blur-md p-4 overflow-y-auto">
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
