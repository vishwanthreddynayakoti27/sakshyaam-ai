import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, User, Mail, Building, Award, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const southIndiaDistricts = [
  'Hyderabad', 'Warangal', 'Khammam', 'Nizamabad', 'Karimnagar',
  'Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Kurnool',
  'Bangalore Urban', 'Mysore', 'Mangalore', 'Hubli', 'Belgaum',
  'Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli',
  'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'
];

const Signup = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    officer_id: '',
    name: '',
    department: '',
    rank: '',
    district: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await auth.signup(formData);
      // New flow: account is queued for admin approval — no token issued.
      if (response?.approval_status === 'PENDING') {
        setPendingApproval(true);
        toast.success('Registration submitted — pending admin approval');
        return;
      }
      // Backwards-compatible (in case backend ever returns a token)
      if (response?.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('officer', JSON.stringify(response.officer));
        setIsAuthenticated(true);
        toast.success('Account created successfully!');
        navigate('/');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary cyber-grid-bg py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl px-6"
      >
        {pendingApproval ? (
          <div className="glassmorphism rounded-xl p-10 border border-accent/30 text-center" data-testid="pending-approval-card">
            <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-accent" strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-heading font-bold text-white mb-3">
              Registration Submitted
            </h1>
            <p className="text-white/70 mb-2">
              Officer ID: <span className="text-accent font-mono">{formData.officer_id}</span>
            </p>
            <div className="my-6 p-4 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-left">
              <p className="text-[#FFB800] text-sm font-semibold mb-1">⏳ Pending admin approval</p>
              <p className="text-white/70 text-sm">
                Your account has been created but cannot be used until an administrator approves it.
                Once approved, you will be granted <span className="text-accent font-semibold">20 free trial credits</span> to start using the platform.
              </p>
            </div>
            <p className="text-white/50 text-xs mb-6">
              Please contact your department admin if approval takes longer than expected.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 rounded-md bg-accent text-black font-semibold hover:bg-accent/90 transition"
              data-testid="pending-approval-back-to-login"
            >
              Back to Login
            </button>
          </div>
        ) : (
        <div className="glassmorphism rounded-xl p-8 border border-white/10">
          <div className="flex flex-col items-center mb-8">
            <Shield className="w-12 h-12 text-accent mb-3" strokeWidth={1.5} />
            <h1 className="text-3xl font-heading font-bold text-white text-glow" data-testid="signup-title">
              OFFICER REGISTRATION
            </h1>
            <p className="text-sm text-white/60 mt-2">Create your secure access account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="name" className="text-white/90 mb-2 block">Officer Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    id="name"
                    data-testid="signup-name-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="officer_id" className="text-white/90 mb-2 block">Officer ID</Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    id="officer_id"
                    data-testid="signup-officer-id-input"
                    value={formData.officer_id}
                    onChange={(e) => setFormData({ ...formData, officer_id: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="department" className="text-white/90 mb-2 block">Department/Wing</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    id="department"
                    data-testid="signup-department-input"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                    placeholder="e.g., Crime Branch"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="rank" className="text-white/90 mb-2 block">Rank</Label>
                <div className="relative">
                  <Award className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    id="rank"
                    data-testid="signup-rank-input"
                    value={formData.rank}
                    onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                    placeholder="e.g., Inspector"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="district" className="text-white/90 mb-2 block">District</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 z-10" />
                  <Select value={formData.district} onValueChange={(value) => setFormData({ ...formData, district: value })} required>
                    <SelectTrigger data-testid="signup-district-select" className="bg-black/20 border-white/10 focus:border-accent text-white pl-10">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent className="bg-secondary border-white/10 text-white max-h-60">
                      {southIndiaDistricts.map((district) => (
                        <SelectItem key={district} value={district} className="hover:bg-white/10">
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-white/90 mb-2 block">Official Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    id="email"
                    data-testid="signup-email-input"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-white/90 mb-2 block">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="password"
                  data-testid="signup-password-input"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                  required
                />
              </div>
            </div>

            <Button
              data-testid="signup-submit-button"
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-black font-bold hover:bg-accent/80 transition-all duration-300 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider py-6 mt-6"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm text-white/60">Already have an account? </span>
            <Link to="/login" className="text-accent hover:text-accent/80 font-semibold" data-testid="signup-login-link">
              Login Here
            </Link>
          </div>
        </div>
        )}
      </motion.div>
    </div>
  );
};

export default Signup;
