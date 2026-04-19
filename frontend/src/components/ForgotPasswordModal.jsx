import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, KeyRound, Send, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../utils/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

const ForgotPasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({ officer_id: '', email: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.officer_id.trim()) {
      toast.error('Officer ID is required');
      return;
    }
    setLoading(true);
    try {
      const res = await auth.forgotPassword(form);
      toast.success(res.message || 'Request submitted');
      setSubmitted(true);
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
        data-testid="forgot-password-modal"
      >
        <motion.div
          initial={{ scale: 0.95, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-[#0B0F1A] border border-white/10 rounded-xl p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-[#FF3B3B] to-[#FFB800]">
                <KeyRound className="text-white" size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Reset Password</h2>
                <p className="text-white/50 text-xs mt-0.5">Admin-mediated password recovery</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white"
              data-testid="forgot-password-close-btn"
            >
              <X size={20} />
            </button>
          </div>

          {submitted ? (
            <div className="space-y-4 text-white" data-testid="forgot-password-success">
              <div className="flex gap-3 p-4 rounded-lg bg-[#00FFB3]/10 border border-[#00FFB3]/30">
                <ShieldAlert className="text-[#00FFB3] shrink-0 mt-0.5" size={18} />
                <div className="text-sm">
                  <p className="text-[#00FFB3] font-semibold mb-1">Request submitted</p>
                  <p className="text-white/70">
                    An admin will review your request and share a temporary password with you offline.
                    You will be required to change it on your next login.
                  </p>
                </div>
              </div>
              <Button
                onClick={onClose}
                className="w-full bg-accent text-black font-bold hover:bg-accent/80"
                data-testid="forgot-password-done-btn"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-white/80 text-sm mb-1.5 block">Officer ID *</Label>
                <Input
                  data-testid="forgot-officer-id-input"
                  value={form.officer_id}
                  onChange={(e) => setForm({ ...form, officer_id: e.target.value })}
                  placeholder="e.g. pc72"
                  className="bg-black/30 border-white/10 text-white"
                  required
                />
              </div>
              <div>
                <Label className="text-white/80 text-sm mb-1.5 block">Email (optional)</Label>
                <Input
                  data-testid="forgot-email-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your-email@police.gov.in"
                  className="bg-black/30 border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80 text-sm mb-1.5 block">Reason (optional)</Label>
                <textarea
                  data-testid="forgot-reason-input"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Forgot password after vacation"
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-md bg-black/30 border border-white/10 text-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex gap-3 p-3 rounded-lg bg-[#FFB800]/5 border border-[#FFB800]/20">
                <ShieldAlert className="text-[#FFB800] shrink-0 mt-0.5" size={16} />
                <p className="text-white/60 text-xs leading-relaxed">
                  For security, a generic confirmation will be shown whether or not the Officer ID
                  exists. Your admin will contact you offline with a temporary password.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="forgot-password-submit-btn"
                className="w-full bg-accent text-black font-bold hover:bg-accent/80"
              >
                <Send size={14} className="mr-2" />
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;
