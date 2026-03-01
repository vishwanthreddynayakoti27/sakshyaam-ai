import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Award, Mail, MapPin, Building, Calendar } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import PricingModal from '../components/PricingModal';
import { auth, reminders } from '../utils/api';
import { toast } from 'sonner';

const Profile = () => {
  const [officer, setOfficer] = useState(null);
  const [remindersList, setRemindersList] = useState([]);
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    loadProfile();
    loadReminders();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await auth.getProfile();
      setOfficer(data);
    } catch (err) {
      toast.error('Failed to load profile');
    }
  };

  const loadReminders = async () => {
    try {
      const data = await reminders.list();
      setRemindersList(data);
    } catch (err) {
      console.error('Failed to load reminders');
    }
  };

  if (!officer) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p className="text-white/60">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto" data-testid="profile-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-heading font-bold text-white text-glow mb-3" data-testid="page-title">
            Officer Profile
          </h1>
          <p className="text-white/60 text-lg">Manage your account and subscription</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
              <div className="w-20 h-20 bg-accent/20 rounded-full border-2 border-accent flex items-center justify-center">
                <User className="text-accent" size={40} />
              </div>
              <div>
                <h2 className="text-2xl font-heading font-bold text-white" data-testid="officer-name">{officer.name}</h2>
                <p className="text-accent font-semibold" data-testid="officer-id">{officer.officer_id}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-black/20 rounded-lg border border-white/10">
                <Award className="text-accent mt-1" size={20} />
                <div>
                  <p className="text-white/60 text-sm">Rank</p>
                  <p className="text-white font-semibold" data-testid="officer-rank">{officer.rank}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-black/20 rounded-lg border border-white/10">
                <Building className="text-accent mt-1" size={20} />
                <div>
                  <p className="text-white/60 text-sm">Department</p>
                  <p className="text-white font-semibold" data-testid="officer-department">{officer.department}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-black/20 rounded-lg border border-white/10">
                <MapPin className="text-accent mt-1" size={20} />
                <div>
                  <p className="text-white/60 text-sm">District</p>
                  <p className="text-white font-semibold" data-testid="officer-district">{officer.district}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-black/20 rounded-lg border border-white/10">
                <Mail className="text-accent mt-1" size={20} />
                <div>
                  <p className="text-white/60 text-sm">Email</p>
                  <p className="text-white font-semibold text-sm" data-testid="officer-email">{officer.email}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-accent" size={24} />
              <h3 className="text-xl font-heading font-bold text-white">Subscription</h3>
            </div>

            <div className="mb-6">
              <div className="inline-block px-4 py-2 bg-accent/20 border border-accent rounded-lg">
                <p className="text-accent font-bold uppercase tracking-wider" data-testid="subscription-plan">
                  {officer.subscription_plan === 'none' ? 'No Active Plan' : officer.subscription_plan}
                </p>
              </div>
            </div>

            <Button
              data-testid="manage-subscription-button"
              onClick={() => setShowPricing(true)}
              className="w-full bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider"
            >
              Manage Subscription
            </Button>
          </motion.div>
        </div>

        {remindersList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-accent" size={24} />
              <h3 className="text-xl font-heading font-bold text-white">Upcoming Reminders</h3>
            </div>

            <div className="space-y-3">
              {remindersList.slice(0, 5).map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-start gap-4 p-4 bg-black/20 border border-white/10 rounded-lg"
                >
                  <div className="w-12 h-12 bg-accent/20 rounded-lg border border-accent flex items-center justify-center flex-shrink-0">
                    <Calendar className="text-accent" size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-accent font-semibold uppercase text-sm">{reminder.reminder_type}</span>
                      <span className="text-white/40 text-xs">
                        {new Date(reminder.reminder_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-white/80 text-sm">{reminder.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
    </Layout>
  );
};

export default Profile;
