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
  AlertCircle,
  ChevronRight,
  Zap
} from 'lucide-react';
import { Input } from '../components/ui/input';

// India Map SVG Path - More detailed outline
const IndiaMapPath = "M 285,60 C 295,55 310,50 325,55 L 345,65 L 365,60 L 385,70 L 400,65 L 415,80 L 430,75 L 445,85 L 455,100 L 450,120 L 440,140 L 445,160 L 455,180 L 460,200 L 455,220 L 445,240 L 450,260 L 445,280 L 435,300 L 420,320 L 400,340 L 380,355 L 360,370 L 340,380 L 320,385 L 300,390 L 280,385 L 260,375 L 240,360 L 220,340 L 200,315 L 185,290 L 175,265 L 170,240 L 165,215 L 160,190 L 165,165 L 175,140 L 190,115 L 210,95 L 235,80 L 260,70 Z";

// City nodes with investigation data - positioned on map
const cityNodes = [
  { id: 1, name: 'Delhi', x: 295, y: 130, type: 'cyber', cases: 45 },
  { id: 2, name: 'Mumbai', x: 210, y: 280, type: 'fraud', cases: 38 },
  { id: 3, name: 'Hyderabad', x: 280, y: 310, type: 'active', cases: 52 },
  { id: 4, name: 'Bangalore', x: 260, y: 360, type: 'resolved', cases: 28 },
  { id: 5, name: 'Chennai', x: 310, y: 365, type: 'cyber', cases: 31 },
  { id: 6, name: 'Kolkata', x: 400, y: 210, type: 'active', cases: 24 },
  { id: 7, name: 'Pune', x: 220, y: 295, type: 'fraud', cases: 19 },
  { id: 8, name: 'Ahmedabad', x: 195, y: 230, type: 'resolved', cases: 15 },
  { id: 9, name: 'Jaipur', x: 250, y: 180, type: 'cyber', cases: 12 },
  { id: 10, name: 'Lucknow', x: 330, y: 170, type: 'active', cases: 21 },
];

// Network connections between cities
const connections = [
  [0, 2], [0, 5], [0, 8], [0, 9],
  [1, 3], [1, 6], [1, 7],
  [2, 3], [2, 4], [2, 1],
  [3, 4], [5, 9], [7, 8]
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [pulsePhase, setPulsePhase] = useState(0);
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
    
    // Pulse animation
    const interval = setInterval(() => {
      setPulsePhase(p => (p + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const getNodeColor = (type) => {
    switch(type) {
      case 'cyber': return '#00C2FF';
      case 'fraud': return '#FF3B3B';
      case 'active': return '#FFB800';
      case 'resolved': return '#00FFB3';
      default: return '#4F7EFF';
    }
  };

  const getNodeLabel = (type) => {
    switch(type) {
      case 'cyber': return 'Cyber Crime';
      case 'fraud': return 'Fraud Investigation';
      case 'active': return 'Active Investigation';
      case 'resolved': return 'Resolved Case';
      default: return 'Unknown';
    }
  };

  const modules = [
    { icon: Languages, title: 'Language Intelligence', path: '/language-intelligence' },
    { icon: FileText, title: 'FIR Draft Assistant', path: '/fir-draft' },
    { icon: Scale, title: 'Legal Intelligence', path: '/legal-intelligence' },
    { icon: DollarSign, title: 'Fraud Recovery', path: '/fraud-recovery' },
    { icon: Phone, title: 'CDR Analyzer', path: '/cdr-analyzer' },
    { icon: Calendar, title: 'Smart Summons', path: '/smart-summons' },
    { icon: MapPin, title: 'Jurisdiction Finder', path: '/jurisdiction-finder' },
    { icon: Activity, title: 'SENTICEL Diary', path: '/senticel-diary' },
    { icon: Package, title: 'Evidence Manager', path: '/evidence-manager' },
    { icon: FolderOpen, title: 'Case File Manager', path: '/case-file-manager' },
    { icon: FileStack, title: 'Investigation Docs', path: '/investigation-documents' },
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
    <div className="min-h-screen bg-[#0B0F1A] overflow-hidden relative" data-testid="dashboard">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(0,194,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,194,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }} />
        
        {/* Radar Sweep Effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-[800px] h-[800px] opacity-10"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, rgba(0,194,255,0.3) 30deg, transparent 60deg)'
            }}
          />
        </div>
      </div>

      {/* Top Bar */}
      <div className="relative z-10 px-6 py-4 border-b border-[#00C2FF]/20 bg-[#0B0F1A]/80 backdrop-blur-md">
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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-semibold">{officer.name}</p>
              <p className="text-[#00C2FF]/70 text-xs">{officer.role} • {officer.station}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00C2FF]/30 to-[#4F7EFF]/30 border-2 border-[#00C2FF]/50 flex items-center justify-center">
              <User className="text-[#00C2FF]" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Modules */}
        <div className="w-64 border-r border-[#00C2FF]/20 bg-[#0B0F1A]/60 backdrop-blur-md p-4 overflow-y-auto">
          <div className="space-y-1">
            {filteredModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.button
                  key={module.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => navigate(module.path)}
                  data-testid={`module-${module.title.toLowerCase().replace(/ /g, '-')}`}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-300 group hover:bg-[#00C2FF]/10 hover:border-l-2 hover:border-[#00C2FF]"
                >
                  <div className="p-2 rounded-lg bg-[#00C2FF]/10 group-hover:bg-[#00C2FF]/20 transition-all group-hover:shadow-[0_0_15px_rgba(0,194,255,0.3)]">
                    <Icon className="text-[#00C2FF] group-hover:text-white transition-colors" size={18} />
                  </div>
                  <span className="text-white/80 text-sm font-medium group-hover:text-white transition-colors">
                    {module.title}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* System Notes */}
          <div className="mt-6 p-4 bg-[#4F7EFF]/10 rounded-xl border border-[#4F7EFF]/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-[#4F7EFF]" />
              <span className="text-[#4F7EFF] text-xs font-semibold">System Notes</span>
            </div>
            <p className="text-white/50 text-xs leading-relaxed">
              Pre-CCTNS Intelligence System. Compliant with BNS 2023 & BSA Section 63.
            </p>
          </div>
        </div>

        {/* Center Area - India Map */}
        <div className="flex-1 flex flex-col items-center justify-center relative px-8">
          {/* Glowing India Map */}
          <div className="relative w-[600px] h-[480px]">
            {/* Orbital Rings */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 480">
              {[1, 2, 3].map((ring, i) => (
                <motion.ellipse
                  key={ring}
                  cx="300"
                  cy="430"
                  rx={180 + i * 50}
                  ry={35 + i * 12}
                  fill="none"
                  stroke="url(#ringGradient)"
                  strokeWidth="1"
                  opacity={0.3 - i * 0.08}
                  animate={{ 
                    opacity: [0.2 - i * 0.05, 0.4 - i * 0.08, 0.2 - i * 0.05]
                  }}
                  transition={{ 
                    duration: 3 + i, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              ))}
              <defs>
                <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00C2FF" stopOpacity="0" />
                  <stop offset="50%" stopColor="#00C2FF" stopOpacity="1" />
                  <stop offset="100%" stopColor="#FF3B3B" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* India Map SVG */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 480">
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="nodeGlow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00C2FF" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#4F7EFF" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#00C2FF" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              {/* Network Connections */}
              {connections.map(([from, to], idx) => (
                <motion.line
                  key={idx}
                  x1={cityNodes[from].x}
                  y1={cityNodes[from].y}
                  x2={cityNodes[to].x}
                  y2={cityNodes[to].y}
                  stroke={getNodeColor(cityNodes[from].type)}
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  opacity={0.5}
                  animate={{ 
                    strokeDashoffset: [0, -16],
                    opacity: [0.3, 0.7, 0.3]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              ))}

              {/* India Outline */}
              <motion.path
                d={IndiaMapPath}
                fill="rgba(0,194,255,0.05)"
                stroke="url(#mapGradient)"
                strokeWidth="2.5"
                filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />

              {/* City Nodes */}
              {cityNodes.map((node) => (
                <g key={node.id} style={{ cursor: 'pointer' }}>
                  {/* Outer Pulse Ring */}
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r="18"
                    fill="none"
                    stroke={getNodeColor(node.type)}
                    strokeWidth="1.5"
                    animate={{ 
                      r: [10, 25, 10],
                      opacity: [0.8, 0, 0.8]
                    }}
                    transition={{ 
                      duration: 2.5,
                      repeat: Infinity,
                      delay: node.id * 0.15
                    }}
                  />
                  {/* Inner Glow Ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="10"
                    fill={`${getNodeColor(node.type)}20`}
                    stroke={getNodeColor(node.type)}
                    strokeWidth="1"
                  />
                  {/* Node Core */}
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r="6"
                    fill={getNodeColor(node.type)}
                    filter="url(#nodeGlow)"
                    whileHover={{ scale: 1.8, r: 8 }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    animate={{
                      opacity: [0.8, 1, 0.8]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity
                    }}
                  />
                </g>
              ))}
            </svg>

            {/* Hovered Node Tooltip */}
            {hoveredNode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute z-20 px-4 py-3 rounded-lg bg-[#0B0F1A]/95 border backdrop-blur-md"
                style={{
                  left: Math.min(hoveredNode.x + 30, 500),
                  top: hoveredNode.y - 30,
                  borderColor: getNodeColor(hoveredNode.type),
                  boxShadow: `0 0 30px ${getNodeColor(hoveredNode.type)}40`
                }}
              >
                <p className="text-white font-bold text-sm">{hoveredNode.name}</p>
                <p className="text-xs font-semibold" style={{ color: getNodeColor(hoveredNode.type) }}>
                  {getNodeLabel(hoveredNode.type)}
                </p>
                <p className="text-white/60 text-xs mt-1">{hoveredNode.cases} Active Cases</p>
              </motion.div>
            )}
          </div>

          {/* Title Below Map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-4"
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="p-2 bg-[#00C2FF]/20 rounded-lg border border-[#00C2FF]/50">
                <Zap className="text-[#00C2FF]" size={24} />
              </div>
              <h1 
                className="text-5xl font-bold tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, #00C2FF 0%, #4F7EFF 50%, #00C2FF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 40px rgba(0,194,255,0.5)',
                  filter: 'drop-shadow(0 0 10px rgba(0,194,255,0.5))'
                }}
                data-testid="dashboard-title"
              >
                SAAKSHYAM AI
              </h1>
            </div>
            <p 
              className="text-lg tracking-[0.3em] uppercase"
              style={{
                color: '#00C2FF',
                textShadow: '0 0 20px rgba(0,194,255,0.5)'
              }}
            >
              Cyber Investigation Command Center
            </p>
          </motion.div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-6">
            {[
              { type: 'cyber', label: 'Cyber Crime' },
              { type: 'fraud', label: 'Fraud' },
              { type: 'active', label: 'Active' },
              { type: 'resolved', label: 'Resolved' }
            ].map(item => (
              <div key={item.type} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ 
                    backgroundColor: getNodeColor(item.type),
                    boxShadow: `0 0 10px ${getNodeColor(item.type)}`
                  }}
                />
                <span className="text-white/60 text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Active Investigations */}
        <div className="w-80 border-l border-[#00C2FF]/20 bg-[#0B0F1A]/60 backdrop-blur-md p-4 overflow-y-auto">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Activity className="text-[#00C2FF]" size={20} />
            Active Investigations
          </h2>

          <div className="space-y-3">
            {activeInvestigations.map((inv, index) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
                  inv.priority === 'critical' 
                    ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/50 hover:border-[#FF3B3B]' 
                    : inv.priority === 'high'
                    ? 'bg-[#FFB800]/10 border-[#FFB800]/50 hover:border-[#FFB800]'
                    : 'bg-[#00C2FF]/10 border-[#00C2FF]/30 hover:border-[#00C2FF]'
                }`}
                data-testid={`investigation-${inv.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-semibold">{inv.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    inv.priority === 'critical' 
                      ? 'bg-[#FF3B3B]/20 text-[#FF3B3B]'
                      : inv.priority === 'high'
                      ? 'bg-[#FFB800]/20 text-[#FFB800]'
                      : 'bg-[#00C2FF]/20 text-[#00C2FF]'
                  }`}>
                    {inv.status}
                  </span>
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
            <div className="p-4 bg-[#00FFB3]/10 rounded-xl border border-[#00FFB3]/30 text-center">
              <p className="text-2xl font-bold text-[#00FFB3]">247</p>
              <p className="text-white/50 text-xs">Cases Resolved</p>
            </div>
            <div className="p-4 bg-[#FFB800]/10 rounded-xl border border-[#FFB800]/30 text-center">
              <p className="text-2xl font-bold text-[#FFB800]">89</p>
              <p className="text-white/50 text-xs">Active Cases</p>
            </div>
          </div>

          {/* Module Count */}
          <div className="mt-4 p-4 bg-[#4F7EFF]/10 rounded-xl border border-[#4F7EFF]/30">
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-sm">Investigation Modules</span>
              <span className="text-[#4F7EFF] font-bold">11 Active</span>
            </div>
            <div className="mt-2 h-2 bg-[#0B0F1A] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#00C2FF] to-[#4F7EFF]"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.5, delay: 0.5 }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
