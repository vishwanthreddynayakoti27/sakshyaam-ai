import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PricingModal from '../components/PricingModal';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import ForceChangePasswordModal from '../components/ForceChangePasswordModal';

const Login = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ officer_id: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPricing, setShowPricing] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forceChange, setForceChange] = useState(null); // holds temp password when must_change_password

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await auth.login(formData.officer_id, formData.password);
      localStorage.setItem('token', response.token);
      localStorage.setItem('officer', JSON.stringify(response.officer));
      localStorage.setItem('officer_id', formData.officer_id);
      localStorage.setItem('officer_password', formData.password);

      // If officer logged in with a temporary password, force change before entering app
      if (response.must_change_password) {
        setForceChange(formData.password);
        toast.info('You must change your password before continuing');
        return;
      }

      setIsAuthenticated(true);
      toast.success('Login successful!');
      navigate('/');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Login failed';
      setError(typeof errorMsg === 'string' ? errorMsg : 'Login failed');
      toast.error(typeof errorMsg === 'string' ? errorMsg : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForceChangeDone = () => {
    setForceChange(null);
    setIsAuthenticated(true);
    toast.success('Welcome! Redirecting to dashboard...');
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary cyber-grid-bg relative overflow-hidden">
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1746470427657-eb0b0115455f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxibHVlJTIwZGF0YSUyMG5ldHdvcmslMjBhYnN0cmFjdHxlbnwwfHx8fDE3NzIzODQzMzF8MA&ixlib=rb-4.1.0&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="glassmorphism rounded-xl p-8 border border-white/10">
          <div className="flex flex-col items-center mb-8">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mb-4"
            >
              <Shield className="w-16 h-16 text-accent" strokeWidth={1.5} />
            </motion.div>
            <h1 className="text-4xl font-heading font-bold text-white text-glow mb-2" data-testid="login-title">
              SAAKSHYAM AI
            </h1>
            <p className="text-sm text-white/60 text-center" data-testid="login-subtitle">
              Cyber Investigation Command Console
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="officer_id" className="text-white/90 mb-2 block">Officer ID</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="officer_id"
                  data-testid="login-officer-id-input"
                  type="text"
                  value={formData.officer_id}
                  onChange={(e) => setFormData({ ...formData, officer_id: e.target.value })}
                  className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                  placeholder="Enter Officer ID"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-white/90 mb-2 block">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                  placeholder="Enter Password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-alert text-sm bg-alert/10 border border-alert/30 rounded-md p-3" data-testid="login-error-message">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-black font-bold hover:bg-accent/80 transition-all duration-300 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider py-6"
            >
              {loading ? 'Authenticating...' : 'Secure Login'}
            </Button>
          </form>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-white/60 hover:text-accent underline underline-offset-2"
                data-testid="login-forgot-password-link"
              >
                Forgot password?
              </button>
              <div className="flex items-center gap-2 text-white/60">
                <span>New Officer?</span>
                <Link to="/signup" className="text-accent hover:text-accent/80 font-semibold" data-testid="login-signup-link">
                  Create Account
                </Link>
              </div>
            </div>
            <button
              onClick={() => setShowPricing(true)}
              className="w-full text-sm text-accent hover:text-accent/80 underline"
              data-testid="login-view-plans-button"
            >
              View Access Plans
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 text-center text-xs text-white/40">
            Authorized Personnel Only — Secure Police Network
          </div>
        </div>
      </motion.div>

      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      {forceChange && (
        <ForceChangePasswordModal
          currentPassword={forceChange}
          onDone={handleForceChangeDone}
        />
      )}
    </div>
  );
};

export default Login;
