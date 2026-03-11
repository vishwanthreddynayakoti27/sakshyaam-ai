import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Languages, 
  FileText, 
  Scale, 
  Phone, 
  User, 
  LogOut,
  Menu,
  X,
  DollarSign,
  MapPin,
  Calendar,
  Activity,
  FileStack,
  Package,
  FolderOpen
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

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Languages, label: 'Language Intelligence', path: '/language-intelligence' },
    { icon: FileText, label: 'FIR Draft Assistant', path: '/fir-draft' },
    { icon: Scale, label: 'Legal Intelligence', path: '/legal-intelligence' },
    { icon: FileStack, label: 'Investigation Docs', path: '/investigation-documents', isNew: true },
    { icon: DollarSign, label: 'Fraud Recovery', path: '/fraud-recovery' },
    { icon: Phone, label: 'CDR Analyzer', path: '/cdr-analyzer' },
    { icon: Calendar, label: 'Smart Summons', path: '/smart-summons' },
    { icon: MapPin, label: 'Jurisdiction Finder', path: '/jurisdiction-finder' },
    { icon: Activity, label: 'SENTICEL Diary', path: '/senticel-diary' },
    { icon: Package, label: 'Evidence Manager', path: '/evidence-manager', isNew: true },
    { icon: FolderOpen, label: 'Case File Manager', path: '/case-file-manager', isNew: true },
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
                  <span className="text-accent/80 text-[10px] font-semibold tracking-wider">COMMAND CONSOLE</span>
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
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-link-${item.label.toLowerCase().replace(/ /g, '-')}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                    isActive
                      ? 'bg-accent/20 text-accent border border-accent/30'
                      : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon size={18} strokeWidth={1.5} />
                  {sidebarOpen && (
                    <span className="font-medium text-sm flex-1">{item.label}</span>
                  )}
                  {sidebarOpen && item.isNew && (
                    <span className="px-1.5 py-0.5 bg-success/20 text-success text-[9px] font-bold rounded">
                      NEW
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/10 space-y-1">
            <Link
              to="/profile"
              data-testid="nav-link-profile"
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
              <p className="text-xs text-white/50">Pre-CCTNS Intelligence & FIR Preparation System</p>
            </div>
            {officer && (
              <div className="text-right">
                <p className="text-white font-semibold text-sm" data-testid="header-officer-name">{officer.name}</p>
                <p className="text-xs text-white/60">{officer.rank} • {officer.district}</p>
              </div>
            )}
          </div>
        </header>

        <main className="p-6" data-testid="main-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
