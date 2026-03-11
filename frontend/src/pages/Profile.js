import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Award, Mail, MapPin, Building, Calendar, Edit2, Save, X } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import PricingModal from '../components/PricingModal';
import { auth, reminders } from '../utils/api';
import { toast } from 'sonner';

const Profile = () => {
  const [officer, setOfficer] = useState(null);
  const [remindersList, setRemindersList] = useState([]);
  const [showPricing, setShowPricing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    rank: '',
    department: '',
    district: '',
    email: ''
  });

  useEffect(() => {
    loadProfile();
    loadReminders();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await auth.getProfile();
      setOfficer(data);
      setEditData({
        name: data.name || '',
        rank: data.rank || '',
        department: data.department || '',
        district: data.district || '',
        email: data.email || ''
      });
    } catch (err) {
      // Try loading from localStorage if API fails
      const storedOfficer = localStorage.getItem('officer');
      if (storedOfficer) {
        const data = JSON.parse(storedOfficer);
        setOfficer(data);
        setEditData({
          name: data.name || '',
          rank: data.rank || '',
          department: data.department || '',
          district: data.district || '',
          email: data.email || ''
        });
      } else {
        toast.error('Failed to load profile');
      }
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

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      // Update localStorage
      const updatedOfficer = { ...officer, ...editData };
      localStorage.setItem('officer', JSON.stringify(updatedOfficer));
      setOfficer(updatedOfficer);
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error('Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setEditData({
      name: officer.name || '',
      rank: officer.rank || '',
      department: officer.department || '',
      district: officer.district || '',
      email: officer.email || ''
    });
    setIsEditing(false);
  };

  if (!officer) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white/60">Loading profile...</p>
          </div>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-heading font-bold text-white text-glow mb-3" data-testid="page-title">
                Officer Profile
              </h1>
              <p className="text-white/60 text-lg">Manage your account information</p>
            </div>
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                data-testid="edit-profile-button"
                className="bg-accent/20 text-accent border border-accent hover:bg-accent hover:text-black transition-all"
              >
                <Edit2 size={16} className="mr-2" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveProfile}
                  data-testid="save-profile-button"
                  className="bg-green-500/20 text-green-400 border border-green-500 hover:bg-green-500 hover:text-black transition-all"
                >
                  <Save size={16} className="mr-2" />
                  Save
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  data-testid="cancel-edit-button"
                  className="bg-red-500/20 text-red-400 border border-red-500 hover:bg-red-500 hover:text-black transition-all"
                >
                  <X size={16} className="mr-2" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
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
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    value={editData.name}
                    onChange={(e) => handleEditChange('name', e.target.value)}
                    placeholder="Full Name"
                    className="text-2xl font-heading font-bold bg-black/30 border-accent/50 text-white mb-2"
                  />
                ) : (
                  <h2 className="text-2xl font-heading font-bold text-white" data-testid="officer-name">{officer.name}</h2>
                )}
                <p className="text-accent font-semibold" data-testid="officer-id">{officer.officer_id}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-black/20 rounded-lg border border-white/10">
                <Award className="text-accent mt-1 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-white/60 text-sm mb-1">Rank / Designation</p>
                  {isEditing ? (
                    <Input
                      value={editData.rank}
                      onChange={(e) => handleEditChange('rank', e.target.value)}
                      placeholder="e.g., Sub-Inspector"
                      className="bg-black/30 border-white/20 text-white text-sm"
                    />
                  ) : (
                    <p className="text-white font-semibold" data-testid="officer-rank">{officer.rank || 'Not specified'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-black/20 rounded-lg border border-white/10">
                <Building className="text-accent mt-1 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-white/60 text-sm mb-1">Department</p>
                  {isEditing ? (
                    <Input
                      value={editData.department}
                      onChange={(e) => handleEditChange('department', e.target.value)}
                      placeholder="e.g., Telangana Police"
                      className="bg-black/30 border-white/20 text-white text-sm"
                    />
                  ) : (
                    <p className="text-white font-semibold" data-testid="officer-department">{officer.department || 'Not specified'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-black/20 rounded-lg border border-white/10">
                <MapPin className="text-accent mt-1 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-white/60 text-sm mb-1">District / Station</p>
                  {isEditing ? (
                    <Input
                      value={editData.district}
                      onChange={(e) => handleEditChange('district', e.target.value)}
                      placeholder="e.g., Hyderabad"
                      className="bg-black/30 border-white/20 text-white text-sm"
                    />
                  ) : (
                    <p className="text-white font-semibold" data-testid="officer-district">{officer.district || 'Not specified'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-black/20 rounded-lg border border-white/10">
                <Mail className="text-accent mt-1 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-white/60 text-sm mb-1">Email</p>
                  {isEditing ? (
                    <Input
                      value={editData.email}
                      onChange={(e) => handleEditChange('email', e.target.value)}
                      placeholder="officer@police.gov.in"
                      className="bg-black/30 border-white/20 text-white text-sm"
                    />
                  ) : (
                    <p className="text-white font-semibold text-sm" data-testid="officer-email">{officer.email || 'Not specified'}</p>
                  )}
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
                  {officer.subscription_plan === 'none' || !officer.subscription_plan ? 'Free Plan' : officer.subscription_plan}
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

            {/* Quick Stats */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <h4 className="text-white/60 text-sm mb-3">Account Statistics</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Member Since</span>
                  <span className="text-white">{new Date().getFullYear()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Status</span>
                  <span className="text-green-400">Active</span>
                </div>
              </div>
            </div>
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
