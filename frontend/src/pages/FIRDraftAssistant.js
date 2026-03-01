import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Send, Copy, Plus, Calendar } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { fir, reminders } from '../utils/api';

const FIRDraftAssistant = () => {
  const [complaintText, setComplaintText] = useState('');
  const [firDraft, setFirDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [reminderData, setReminderData] = useState({
    reminder_type: '',
    reminder_date: '',
    note: ''
  });

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      const drafts = await fir.list();
      setSavedDrafts(drafts);
    } catch (err) {
      console.error('Failed to load drafts');
    }
  };

  const handleGenerate = async () => {
    if (!complaintText.trim()) {
      toast.error('Please enter complaint text');
      return;
    }

    setLoading(true);
    try {
      const response = await fir.create(complaintText);
      setFirDraft(response);
      toast.success('FIR draft generated successfully!');
      loadDrafts();
    } catch (err) {
      toast.error('Failed to generate FIR draft');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleDownload = () => {
    if (!firDraft) return;
    const content = `FIR DRAFT\n\nCOMPLAINT:\n${firDraft.complaint_text}\n\nFIR NARRATIVE (Third Person):\n${firDraft.fir_draft}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fir-draft-${firDraft.id}.txt`;
    a.click();
    toast.success('Downloaded!');
  };

  const handleSetReminder = async () => {
    if (!firDraft || !reminderData.reminder_type || !reminderData.reminder_date) {
      toast.error('Please fill all reminder fields');
      return;
    }

    try {
      await reminders.create({
        fir_id: firDraft.id,
        ...reminderData
      });
      toast.success('Reminder set successfully!');
      setReminderData({ reminder_type: '', reminder_date: '', note: '' });
    } catch (err) {
      toast.error('Failed to set reminder');
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="fir-draft-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-heading font-bold text-white text-glow mb-3" data-testid="page-title">
            FIR Draft Assistant
          </h1>
          <p className="text-white/60 text-lg">
            Convert complaints to court-ready third-person FIR narratives
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4" data-testid="input-section-title">Complaint Text (First Person)</h2>
            
            <Textarea
              data-testid="complaint-textarea"
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              placeholder="Enter complaint text in first person...\n\nExample:\nI, Rajesh Kumar, residing at House No. 123, MG Road, Hyderabad, want to file a complaint that on 15th January 2025, around 10 PM, someone broke into my house and stole my laptop, mobile phone, and cash worth Rs. 50,000."
              className="bg-black/20 border-white/10 focus:border-accent text-white min-h-[400px] font-mono text-sm"
            />

            <Button
              data-testid="generate-draft-button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full mt-4 bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider py-6"
            >
              {loading ? 'Generating...' : 'Generate FIR Draft'}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-white" data-testid="output-section-title">FIR Draft (Third Person)</h2>
              {firDraft && (
                <div className="flex gap-2">
                  <Button
                    data-testid="copy-draft-button"
                    onClick={() => handleCopy(firDraft.fir_draft)}
                    className="bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm p-2"
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    data-testid="download-draft-button"
                    onClick={handleDownload}
                    className="bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm p-2"
                  >
                    <Download size={16} />
                  </Button>
                </div>
              )}
            </div>

            {!firDraft ? (
              <div className="flex items-center justify-center h-[400px] text-white/40">
                <div className="text-center">
                  <FileText size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Generate a draft to see results</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4" data-testid="fir-draft-output">
                <div className="bg-black/30 border border-accent/30 rounded-lg p-4 min-h-[400px]">
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap" data-testid="generated-fir-text">
                    {firDraft.fir_draft}
                  </p>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      data-testid="set-reminder-button"
                      className="w-full bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm uppercase tracking-wider"
                    >
                      <Calendar size={16} className="mr-2" />
                      Set Reminder
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-secondary border-white/10 text-white">
                    <DialogHeader>
                      <DialogTitle className="font-heading text-2xl text-accent">Set Reminder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label className="text-white/90">Reminder Type</Label>
                        <Select 
                          value={reminderData.reminder_type} 
                          onValueChange={(value) => setReminderData({...reminderData, reminder_type: value})}
                        >
                          <SelectTrigger className="bg-black/20 border-white/10 text-white">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent className="bg-secondary border-white/10 text-white">
                            <SelectItem value="remand">Remand Reminder</SelectItem>
                            <SelectItem value="court">Court Submission</SelectItem>
                            <SelectItem value="followup">Follow-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-white/90">Date & Time</Label>
                        <Input
                          type="datetime-local"
                          value={reminderData.reminder_date}
                          onChange={(e) => setReminderData({...reminderData, reminder_date: e.target.value})}
                          className="bg-black/20 border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-white/90">Note</Label>
                        <Textarea
                          value={reminderData.note}
                          onChange={(e) => setReminderData({...reminderData, note: e.target.value})}
                          className="bg-black/20 border-white/10 text-white"
                          placeholder="Additional notes..."
                        />
                      </div>
                      <Button
                        onClick={handleSetReminder}
                        className="w-full bg-accent text-black font-bold"
                      >
                        Set Reminder
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </motion.div>
        </div>

        {savedDrafts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h3 className="text-xl font-heading font-bold text-white mb-4">Recent Drafts</h3>
            <div className="space-y-3">
              {savedDrafts.slice(0, 5).map((draft) => (
                <div
                  key={draft.id}
                  className="bg-black/20 border border-white/10 rounded-lg p-4 hover:border-accent/30 transition-all cursor-pointer"
                  onClick={() => setFirDraft(draft)}
                >
                  <p className="text-white/80 text-sm truncate">{draft.complaint_text}</p>
                  <p className="text-white/40 text-xs mt-2">
                    {new Date(draft.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default FIRDraftAssistant;
