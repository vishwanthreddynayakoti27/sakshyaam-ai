import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../utils/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

/**
 * Force-Change-Password modal.
 * Shown when the officer logged in with a temporary password (must_change_password=true).
 * Cannot be dismissed — officer must set a new password to continue.
 */
const ForceChangePasswordModal = ({ currentPassword = '', onDone }) => {
  const [form, setForm] = useState({
    current_password: currentPassword,
    new_password: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (form.new_password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await auth.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      // Persist new password for auto-refresh helper used elsewhere
      try {
        localStorage.setItem('officer_password', form.new_password);
      } catch (e) { /* ignore */ }
      toast.success('Password changed successfully');
      onDone?.(form.new_password);
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      data-testid="force-change-password-modal"
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#0B0F1A] border border-[#FFB800]/40 rounded-xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-[#FF3B3B] to-[#FFB800]">
            <KeyRound className="text-white" size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Change Your Password</h2>
            <p className="text-white/50 text-xs mt-0.5">Required — you logged in with a temporary password</p>
          </div>
        </div>

        <div className="flex gap-3 p-3 mb-4 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30">
          <ShieldAlert className="text-[#FFB800] shrink-0 mt-0.5" size={16} />
          <p className="text-white/70 text-xs leading-relaxed">
            For security, you must set a permanent password before continuing. Minimum 8 characters.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="text-white/80 text-sm mb-1.5 block">Temporary Password *</Label>
            <Input
              data-testid="cpw-current-input"
              type="password"
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
              className="bg-black/30 border-white/10 text-white"
              required
            />
          </div>
          <div>
            <Label className="text-white/80 text-sm mb-1.5 block">New Password * (min 8 chars)</Label>
            <Input
              data-testid="cpw-new-input"
              type="password"
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              className="bg-black/30 border-white/10 text-white"
              minLength={8}
              required
            />
          </div>
          <div>
            <Label className="text-white/80 text-sm mb-1.5 block">Confirm New Password *</Label>
            <Input
              data-testid="cpw-confirm-input"
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="bg-black/30 border-white/10 text-white"
              minLength={8}
              required
            />
            {form.confirm && form.new_password !== form.confirm && (
              <p className="text-[#FF3B3B] text-xs mt-1">Passwords do not match</p>
            )}
            {form.confirm && form.new_password === form.confirm && form.new_password.length >= 8 && (
              <p className="text-[#00FFB3] text-xs mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} /> Looks good
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            data-testid="cpw-submit-btn"
            className="w-full bg-accent text-black font-bold hover:bg-accent/80"
          >
            {loading ? 'Saving...' : 'Save & Continue'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default ForceChangePasswordModal;
