import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Languages, 
  Scale, 
  Phone, 
  Search,
  MapPin,
  Calendar,
  FileStack,
  Package,
  DollarSign,
  AlertTriangle,
  Shield,
  Workflow,
  FileCheck,
  Database,
  Camera,
  Microscope,
  User
} from 'lucide-react';
import { Input } from '../components/ui/input';

// Background image URL
const BACKGROUND_IMAGE = "https://customer-assets.emergentagent.com/job_nyaya-prahari/artifacts/f5u6gl1x_ChatGPT%20Image%20Mar%2011%2C%202026%2C%2001_48_38%20PM.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [officer, setOfficer] = useState({ name: 'Officer', role: 'Sub-Inspector', station: 'Cyber Cell' });

  useEffect(() => {
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

  // WING 1: SAAKSHYAM ADMIN - Investigation & Documentation
  const adminWing = [
    { icon: Workflow, title: 'Charge Sheet Fusion', path: '/charge-sheet-fusion', color: '#00C2FF', badge: 'NEW' },
    { icon: Shield, title: 'Remand Report', path: '/remand-report', color: '#FF3B3B', badge: 'NEW' },
    { icon: FileStack, title: 'CDF Filler', path: '/cdf-filler', color: '#FFB800', badge: 'NEW' },
    { icon: FileCheck, title: 'Document Generator', path: '/document-generator', color: '#4F7EFF' },
    { icon: Database, title: 'CCTNS Bridge', path: '/cctns-bridge', color: '#00FFB3' },
    { icon: Languages, title: 'Language Intelligence', path: '/language-intelligence', color: '#00C2FF' },
    { icon: Scale, title: 'Legal Intelligence', path: '/legal-intelligence', color: '#00FFB3' },
    { icon: DollarSign, title: 'Fraud Recovery', path: '/fraud-recovery', color: '#FF3B3B' },
    { icon: Calendar, title: 'Smart Summons', path: '/smart-summons', color: '#FFB800' },
    { icon: MapPin, title: 'Jurisdiction Finder', path: '/jurisdiction-finder', color: '#00C2FF' },
  ];

  // WING 2: SAAKSHYAM LAB - Advanced Forensic Lab
  const labWing = [
    { icon: Phone, title: 'CDR Analyzer', path: '/cdr-analyzer', color: '#FFB800' },
    { icon: Microscope, title: 'Media Forensic', path: '/media-forensic', color: '#FF3B3B' },
    { icon: Camera, title: 'CCTV Search', path: '/cctv-search', color: '#4F7EFF' },
    { icon: Package, title: 'e-Sakshya & Hash', path: '/evidence-hash', color: '#00FFB3' },
  ];

  const allModules = [...adminWing, ...labWing];
  const filteredModules = allModules.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-screen overflow-hidden relative bg-[#030614]" data-testid="dashboard">
      {/* System Status Warning Bar at TOP */}
      <div className="relative z-20 bg-gradient-to-r from-[#FFB800]/20 via-[#FF3B3B]/20 to-[#FFB800]/20 border-b border-[#FFB800]/50">
        <div className="max-w-[1800px] mx-auto px-4 py-1.5 flex items-center justify-center gap-4">
          <AlertTriangle className="text-[#FFB800] animate-pulse" size={16} />
          <div className="flex items-center gap-4 text-xs">
            <span className="text-[#FFB800] font-bold">System Status:</span>
            <span className="text-white/80">Pre-CCTNS Intelligence System</span>
            <span className="text-white/40">|</span>
            <span className="text-white/80">BNS 2023 & BSA Sec. 63 Compliant</span>
            <span className="text-white/40">|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00FFB3] animate-pulse"></span>
              <span className="text-[#00FFB3] font-semibold">All Systems Online</span>
            </span>
          </div>
        </div>
      </div>

      {/* Top Bar with System Icon */}
      <div className="relative z-20 px-4 py-2 border-b border-[#00C2FF]/20 bg-[#030614]/90 backdrop-blur-md">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          {/* System Icon + Search */}
          <div className="flex items-center gap-6">
            {/* System Icon */}
            <div className="flex items-center gap-3">
              <motion.div 
                className="p-2 rounded-full bg-[#00C2FF]/20 border border-[#00C2FF]/50"
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              >
                <Shield className="text-[#00C2FF]" size={18} />
              </motion.div>
              <div>
                <p className="text-white font-semibold text-sm">
                  SAAKSHYAM AI <span className="text-[#00C2FF]">Command Center</span>
                </p>
                <p className="text-white/50 text-xs">Dual-Wing Modular System</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00C2FF]/50" size={16} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Investigation Tool..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-[#0B0F1A]/60 border border-[#00C2FF]/30 rounded-full text-white placeholder:text-white/40 focus:border-[#00C2FF] focus:ring-1 focus:ring-[#00C2FF]/50"
                data-testid="search-input"
              />
            </div>
          </div>

          {/* User Info - Profile Icon Only */}
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all"
            onClick={() => navigate('/profile')}
            data-testid="user-profile-link"
          >
            <motion.div 
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C2FF]/30 to-[#4F7EFF]/30 border-2 border-[#00C2FF]/50 flex items-center justify-center"
              whileHover={{ scale: 1.1, boxShadow: '0 0 20px rgba(0,194,255,0.5)' }}
            >
              <User className="text-[#00C2FF]" size={20} />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex" style={{ height: 'calc(100vh - 85px)' }}>
        {/* Left Sidebar - WING 1: ADMIN */}
        <div className="w-56 border-r border-[#00C2FF]/20 bg-[#030614]/90 backdrop-blur-md p-2 overflow-hidden z-20">
          
          <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            {/* WING 1: ADMIN */}
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
              <Shield size={12} className="text-[#00C2FF]" />
              <span className="text-[9px] text-[#00C2FF] font-bold tracking-wider">WING 1: ADMIN</span>
            </div>
            {adminWing.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase())).map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={{ scale: 1.02, x: 3 }}
                  onClick={() => navigate(module.path)}
                  data-testid={`module-${module.title.toLowerCase().replace(/ /g, '-')}`}
                  className="relative group cursor-pointer"
                >
                  <div 
                    className="relative p-2 rounded-lg border transition-all duration-300 bg-[#0B0F1A]/80 group-hover:bg-[#0B0F1A]/95"
                    style={{ borderColor: `${module.color}20` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = module.color;
                      e.currentTarget.style.boxShadow = `0 0 15px ${module.color}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${module.color}20`;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="p-1 rounded-md"
                        style={{ backgroundColor: `${module.color}15` }}
                      >
                        <Icon size={14} style={{ color: module.color }} />
                      </div>
                      <span className="text-white/85 text-[11px] font-medium group-hover:text-white transition-colors flex-1">
                        {module.title}
                      </span>
                      {module.badge && (
                        <span className="px-1 py-0.5 text-[7px] font-bold rounded bg-[#00FFB3]/20 text-[#00FFB3]">
                          {module.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Center Area - Full Background Image with Animations */}
        <div className="flex-1 relative overflow-hidden">
          {/* Animated Background Image */}
          <motion.div 
            className="absolute inset-0"
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5 }}
            style={{
              backgroundImage: `url(${BACKGROUND_IMAGE})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          />
          
          {/* Scanning Line Animation */}
          <motion.div
            className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00C2FF] to-transparent z-10"
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            style={{ opacity: 0.6 }}
          />
          
          {/* Pulsing Glow Overlay */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              background: [
                'radial-gradient(circle at center, rgba(0,194,255,0.05) 0%, transparent 50%)',
                'radial-gradient(circle at center, rgba(0,194,255,0.1) 0%, transparent 60%)',
                'radial-gradient(circle at center, rgba(0,194,255,0.05) 0%, transparent 50%)',
              ]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* Edge Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#030614]/40 via-transparent to-[#030614]/40 pointer-events-none" />
          
          {/* Corner Decorations */}
          <motion.div 
            className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-[#00C2FF]/50"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div 
            className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-[#00C2FF]/50"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          />
          <motion.div 
            className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-[#00C2FF]/50"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 1 }}
          />
          <motion.div 
            className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-[#00C2FF]/50"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
          />
        </div>

        {/* Right Panel - WING 2: FORENSIC LAB */}
        <div className="w-56 border-l border-[#FF3B3B]/20 bg-[#030614]/90 backdrop-blur-md p-2 overflow-hidden z-20 flex flex-col">
          <div className="space-y-1 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            {/* WING 2: LAB */}
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
              <Microscope size={12} className="text-[#FF3B3B]" />
              <span className="text-[9px] text-[#FF3B3B] font-bold tracking-wider">WING 2: FORENSIC LAB</span>
            </div>
            {labWing.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase())).map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.path}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={{ scale: 1.02, x: -3 }}
                  onClick={() => navigate(module.path)}
                  data-testid={`module-${module.title.toLowerCase().replace(/ /g, '-')}`}
                  className="relative group cursor-pointer"
                >
                  <div 
                    className="relative p-2 rounded-lg border transition-all duration-300 bg-[#0B0F1A]/80 group-hover:bg-[#0B0F1A]/95"
                    style={{ borderColor: `${module.color}20` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = module.color;
                      e.currentTarget.style.boxShadow = `0 0 15px ${module.color}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${module.color}20`;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="p-1 rounded-md"
                        style={{ backgroundColor: `${module.color}15` }}
                      >
                        <Icon size={14} style={{ color: module.color }} />
                      </div>
                      <span className="text-white/85 text-[11px] font-medium group-hover:text-white transition-colors flex-1">
                        {module.title}
                      </span>
                      {module.badge && (
                        <span className="px-1 py-0.5 text-[7px] font-bold rounded bg-[#00FFB3]/20 text-[#00FFB3]">
                          {module.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Quick Stats - Compact */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <motion.div 
              className="p-2.5 rounded-lg border border-[#00FFB3]/30 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(0,255,179,0.1) 0%, transparent 100%)' }}
              whileHover={{ scale: 1.05 }}
            >
              <p className="text-2xl font-bold text-[#00FFB3]">247</p>
              <p className="text-white/50 text-[10px]">Resolved</p>
            </motion.div>
            <motion.div 
              className="p-2.5 rounded-lg border border-[#FFB800]/30 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(255,184,0,0.1) 0%, transparent 100%)' }}
              whileHover={{ scale: 1.05 }}
            >
              <p className="text-2xl font-bold text-[#FFB800]">89</p>
              <p className="text-white/50 text-[10px]">Active</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
