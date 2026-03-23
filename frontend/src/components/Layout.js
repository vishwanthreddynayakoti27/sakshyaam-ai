import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Languages, 
  Scale, 
  Phone, 
  User, 
  LogOut,
  Menu,
  X,
  DollarSign,
  MapPin,
  Calendar,
  FileStack,
  Package,
  Workflow,
  FileCheck,
  Camera,
  Database,
  Activity,
  Shield,
  Microscope
} from 'lucide-react';
import { toast } from 'sonner';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [officer, setOfficer] = React.useState(null);

  React.useEffect(() => {
    const officerData = localStorage.getItem('officer');
    if (officerData) {
      setOfficer(JSON.parse(officerData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('officer');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // WING 1: SAAKSHYAM ADMIN - Investigation & Documentation
  const adminWing = [
    { icon: Workflow, label: 'Charge Sheet Fusion', path: '/charge-sheet-fusion', isNew: true },
    { icon: FileCheck, label: 'Document Generator', path: '/document-generator' },
    { icon: Database, label: 'CCTNS Bridge', path: '/cctns-bridge' },
    { icon: Languages, label: 'Language Intelligence', path: '/language-intelligence' },
    { icon: Scale, label: 'Legal Intelligence', path: '/legal-intelligence' },
    { icon: FileStack, label: 'Investigation Docs', path: '/investigation-documents' },
    { icon: DollarSign, label: 'Fraud Recovery', path: '/fraud-recovery' },
    { icon: Calendar, label: 'Smart Summons', path: '/smart-summons' },
    { icon: MapPin, label: 'Jurisdiction Finder', path: '/jurisdiction-finder' },
  ];

  // WING 2: SAAKSHYAM LAB - Advanced Forensic Lab
  const labWing = [
    { icon: Phone, label: 'CDR Analyzer', path: '/cdr-analyzer' },
    { icon: Microscope, label: 'Media Forensic', path: '/media-forensic', isNew: true },
    { icon: Camera, label: 'CCTV Search', path: '/cctv-search' },
    { icon: Package, label: 'e-Sakshya & Hash', path: '/evidence-hash' },
  ];

  return (
    <div className="min-h-screen bg-primary cyber-grid-bg">
      <aside
        className={`fixed left-0 top-0 h-full bg-black/40 backdrop-blur-xl border-r border-white/10 transition-all duration-300 z-50 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                <div className="w-10 h-10 bg-accent/20 rounded border border-accent flex items-center justify-center">
                  <Activity className="text-accent" size={20} />
                </div>
                <div>
                  <span className="text-white font-heading font-bold text-sm block">SAAKSHYAM AI</span>
                  <span className="text-accent/80 text-[10px] font-semibold tracking-wider">DUAL-WING SYSTEM</span>
                </div>
              </motion.div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white/60 hover:text-white transition p-2"
              data-testid="sidebar-toggle-button"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {/* Dashboard */}
            <Link
              to="/"
              data-testid="sidebar-dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                location.pathname === '/'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <LayoutDashboard size={18} strokeWidth={1.5} />
              {sidebarOpen && <span className="font-medium text-sm">Dashboard</span>}
            </Link>

            {/* WING 1: ADMIN */}
            {sidebarOpen && (
              <div className="pt-3 pb-1">
                <div className="flex items-center gap-2 px-3 py-1">
                  <Shield size={12} className="text-[#00C2FF]" />
                  <span className="text-[10px] text-[#00C2FF] font-bold tracking-wider">WING 1: ADMIN</span>
                </div>
              </div>
            )}
            {adminWing.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`sidebar-${item.label.toLowerCase().replace(/ /g, '-')}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all ${
                    isActive
                      ? 'bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/30'
                      : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  {sidebarOpen && (
                    <span className="font-medium text-xs flex-1">{item.label}</span>
                  )}
                  {sidebarOpen && item.isNew && (
                    <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-[#00FFB3]/20 text-[#00FFB3]">NEW</span>
                  )}
                </Link>
              );
            })}

            {/* WING 2: LAB */}
            {sidebarOpen && (
              <div className="pt-4 pb-1">
                <div className="flex items-center gap-2 px-3 py-1">
                  <Microscope size={12} className="text-[#FF3B3B]" />
                  <span className="text-[10px] text-[#FF3B3B] font-bold tracking-wider">WING 2: FORENSIC LAB</span>
                </div>
              </div>
            )}
            {labWing.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`sidebar-${item.label.toLowerCase().replace(/ /g, '-')}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all ${
                    isActive
                      ? 'bg-[#FF3B3B]/20 text-[#FF3B3B] border border-[#FF3B3B]/30'
                      : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  {sidebarOpen && (
                    <span className="font-medium text-xs flex-1">{item.label}</span>
                  )}
                  {sidebarOpen && item.isNew && (
                    <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-[#00FFB3]/20 text-[#00FFB3]">NEW</span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/10 space-y-1">
            <Link
              to="/profile"
              data-testid="sidebar-profile"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                location.pathname === '/profile'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <User size={18} strokeWidth={1.5} />
              {sidebarOpen && <span className="font-medium text-sm">Profile</span>}
            </Link>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-alert/80 hover:bg-alert/10 hover:text-alert transition-all"
            >
              <LogOut size={18} strokeWidth={1.5} />
              {sidebarOpen && <span className="font-medium text-sm">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        <header className="bg-black/20 backdrop-blur-md border-b border-white/10 px-6 py-3" data-testid="header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-heading font-bold text-white">Cyber Investigation Command Center</h2>
              <p className="text-xs text-white/50">Dual-Wing Modular System • Pre-CCTNS Intelligence</p>
            </div>
            {/* Profile button only - no name/designation */}
            <Link
              to="/profile"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              data-testid="header-profile-btn"
            >
              <User size={20} className="text-white/70" />
            </Link>
          </div>
        </header>

        <main className="p-6" data-testid="main-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
