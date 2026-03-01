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
  X
} from 'lucide-react';
import { Button } from '../components/ui/button';
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
    { icon: Scale, label: 'BNS Intelligence', path: '/bns-intelligence' },
    { icon: Phone, label: 'CDR Analyzer', path: '/cdr-analyzer' },
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
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                <div className="w-10 h-10 bg-accent/20 rounded border border-accent flex items-center justify-center">
                  <span className="text-accent font-bold font-heading text-xl">NP</span>
                </div>
                <span className="text-white font-heading font-bold text-lg">NYAYA PRAHARI</span>
              </motion.div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white/60 hover:text-white transition"
              data-testid="sidebar-toggle-button"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-link-${item.label.toLowerCase().replace(/ /g, '-')}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all ${
                    isActive
                      ? 'bg-accent/20 text-accent border border-accent/30'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  {sidebarOpen && <span className="font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 space-y-2">
            <Link
              to="/profile"
              data-testid="nav-link-profile"
              className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all ${
                location.pathname === '/profile'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <User size={20} strokeWidth={1.5} />
              {sidebarOpen && <span className="font-medium">Profile</span>}
            </Link>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-alert/80 hover:bg-alert/10 hover:text-alert transition-all"
            >
              <LogOut size={20} strokeWidth={1.5} />
              {sidebarOpen && <span className="font-medium">Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-20'
        }`}
      >
        <header className="bg-black/20 backdrop-blur-md border-b border-white/10 px-8 py-4" data-testid="header">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-heading font-bold text-white">Investigation Command Center</h2>
              <p className="text-sm text-white/50">Pre-CCTNS Intelligence & FIR Preparation System</p>
            </div>
            {officer && (
              <div className="text-right">
                <p className="text-white font-semibold" data-testid="header-officer-name">{officer.name}</p>
                <p className="text-sm text-white/60">{officer.rank} • {officer.district}</p>
              </div>
            )}
          </div>
        </header>

        <main className="p-8" data-testid="main-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
