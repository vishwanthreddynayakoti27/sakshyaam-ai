import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Copy, AlertCircle, CheckCircle, Calendar, FileCheck } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { fir, reminders, api } from '../utils/api';

const FIRDraftAssistant = () => {
  const [complaintText, setComplaintText] = useState('');
  const [firDraft, setFirDraft] = useState(null);
  const [errorAnalysis, setErrorAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzingErrors, setAnalyzingErrors] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [showRemandDialog, setShowRemandDialog] = useState(false);
  const [remandData, setRemandData] = useState({
    accused_name: '',
    charges: '',
    remand_duration: '',
    remand_type: 'Police Custody'
  });
  const [remandReport, setRemandReport] = useState(null);
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

  const handleAnalyzeErrors = async () => {
    if (!complaintText.trim()) {
      toast.error('Please enter complaint text first');
      return;
    }

    setAnalyzingErrors(true);
    try {
      const formData = new FormData();
      formData.append('complaint_text', complaintText);
      const response = await api.post('/fir/analyze-errors', formData);
      setErrorAnalysis(response.data);
      
      if (response.data.has_errors) {
        toast.warning(`Found ${response.data.error_count} issue(s) - Review before generating`);
      } else {
        toast.success('No major issues detected!');
      }
    } catch (err) {
      toast.error('Error analysis failed');
    } finally {
      setAnalyzingErrors(false);
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
      setErrorAnalysis(null);
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
    const content = `FIR DRAFT\n\nORIGINAL COMPLAINT:\n${firDraft.complaint_text}\n\nFIR NARRATIVE (Third Person):\n${firDraft.fir_draft}`;
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

  const handleGenerateRemand = async () => {
    if (!firDraft) {
      toast.error('Please generate FIR draft first');
      return;
    }

    if (!remandData.accused_name || !remandData.charges || !remandData.remand_duration) {
      toast.error('Please fill all remand details');
      return;
    }

    try {
      const response = await api.post('/remand/create', {
        fir_id: firDraft.id,
        ...remandData
      });
      setRemandReport(response.data);
      toast.success('Remand report generated!');
      setShowRemandDialog(false);
    } catch (err) {
      toast.error('Failed to generate remand report');
    }
  };

  const handleDownloadRemand = () => {
    if (!remandReport) return;
    const blob = new Blob([remandReport.report_text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remand-report-${remandReport.id}.txt`;
    a.click();
    toast.success('Remand report downloaded!');
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
            Convert complaints to court-ready third-person FIR narratives with error detection
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4" data-testid="input-section-title">
              Complaint Text (First Person)
            </h2>
            
            <Textarea
              data-testid="complaint-textarea"
              value={complaintText}
              onChange={(e) => {
                setComplaintText(e.target.value);
                setErrorAnalysis(null);
              }}
              placeholder="Enter complaint text in first person...

Example:
I, Rajesh Kumar, residing at House No. 123, MG Road, Hyderabad, want to file a complaint that on 15th January 2025, around 10 PM, someone broke into my house and stole my laptop, mobile phone, and cash worth Rs. 50,000."
              className="bg-black/20 border-white/10 focus:border-accent text-white min-h-[300px] font-mono text-sm"
            />

            <div className="flex gap-3 mt-4">
              <Button
                data-testid="analyze-errors-button"
                onClick={handleAnalyzeErrors}
                disabled={analyzingErrors || !complaintText.trim()}
                className="flex-1 bg-transparent border border-warning text-warning hover:bg-warning/10 transition-all rounded-sm uppercase tracking-wider"
              >
                {analyzingErrors ? 'Analyzing...' : 'Analyze Errors'}
              </Button>

              <Button
                data-testid="generate-draft-button"
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider"
              >
                {loading ? 'Generating...' : 'Generate FIR Draft'}
              </Button>
            </div>

            {errorAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-4 rounded-lg border ${
                  errorAnalysis.has_errors
                    ? 'bg-warning/10 border-warning/30'
                    : 'bg-success/10 border-success/30'
                }`}
                data-testid="error-analysis-result"
              >
                <div className="flex items-center gap-2 mb-2">
                  {errorAnalysis.has_errors ? (
                    <AlertCircle className="text-warning" size={20} />
                  ) : (
                    <CheckCircle className="text-success" size={20} />
                  )}
                  <span className={`font-bold ${errorAnalysis.has_errors ? 'text-warning' : 'text-success'}`}>
                    {errorAnalysis.has_errors
                      ? `${errorAnalysis.error_count} Issue(s) Detected`
                      : 'No Major Issues Found'}
                  </span>
                </div>
                {errorAnalysis.errors.length > 0 && (
                  <ul className="space-y-1 text-sm text-white/80">
                    {errorAnalysis.errors.map((error, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-warning mt-0.5">•</span>
                        {error}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 text-xs text-white/60">
                  First-person pronouns: {errorAnalysis.first_person_count} | 
                  Third-person references: {errorAnalysis.third_person_count}
                </div>
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-white" data-testid="output-section-title">
                FIR Draft (Third Person)
              </h2>
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
              <div className="flex items-center justify-center h-[300px] text-white/40">
                <div className="text-center">
                  <FileText size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Generate a draft to see results</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4" data-testid="fir-draft-output">
                <div className="bg-black/30 border border-accent/30 rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto">
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap" data-testid="generated-fir-text">
                    {firDraft.fir_draft}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        data-testid="set-reminder-button"
                        className="w-full bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm uppercase tracking-wider text-xs"
                      >
                        <Calendar size={14} className="mr-2" />
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

                  <Button
                    data-testid="generate-remand-button"
                    onClick={() => setShowRemandDialog(true)}
                    className="w-full bg-transparent border border-success/50 text-success hover:bg-success/10 transition-all rounded-sm uppercase tracking-wider text-xs"
                  >
                    <FileCheck size={14} className="mr-2" />
                    Remand Report
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {remandReport && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 glassmorphism rounded-xl p-6 border border-success/30"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                <FileCheck className="text-success" size={24} />
                Remand Report Generated
              </h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCopy(remandReport.report_text)}
                  className="bg-transparent border border-success/50 text-success hover:bg-success/10 rounded-sm p-2"
                >
                  <Copy size={16} />
                </Button>
                <Button
                  onClick={handleDownloadRemand}
                  className="bg-transparent border border-success/50 text-success hover:bg-success/10 rounded-sm p-2"
                >
                  <Download size={16} />
                </Button>
              </div>
            </div>
            <div className="bg-black/30 border border-success/20 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-white/90 text-sm whitespace-pre-wrap font-mono">
                {remandReport.report_text}
              </pre>
            </div>
          </motion.div>
        )}

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
                  onClick={() => {
                    setComplaintText(draft.complaint_text);
                    setFirDraft(draft);
                  }}
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

        <Dialog open={showRemandDialog} onOpenChange={setShowRemandDialog}>
          <DialogContent className="bg-secondary border-white/10 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl text-accent flex items-center gap-2">
                <FileCheck size={24} />
                Generate Remand Report
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-white/90">Accused Name *</Label>
                <Input
                  value={remandData.accused_name}
                  onChange={(e) => setRemandData({...remandData, accused_name: e.target.value})}
                  className="bg-black/20 border-white/10 text-white"
                  placeholder="Full name of the accused"
                />
              </div>
              <div>
                <Label className="text-white/90">Charges (Sections) *</Label>
                <Textarea
                  value={remandData.charges}
                  onChange={(e) => setRemandData({...remandData, charges: e.target.value})}
                  className="bg-black/20 border-white/10 text-white"
                  placeholder="e.g., BNS 303 (Theft), BNS 115 (Voluntarily Causing Hurt)"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-white/90">Remand Type *</Label>
                <Select 
                  value={remandData.remand_type} 
                  onValueChange={(value) => setRemandData({...remandData, remand_type: value})}
                >
                  <SelectTrigger className="bg-black/20 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-secondary border-white/10 text-white">
                    <SelectItem value="Police Custody">Police Custody</SelectItem>
                    <SelectItem value="Judicial Custody">Judicial Custody</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/90">Remand Duration *</Label>
                <Input
                  value={remandData.remand_duration}
                  onChange={(e) => setRemandData({...remandData, remand_duration: e.target.value})}
                  className="bg-black/20 border-white/10 text-white"
                  placeholder="e.g., 7 days, 14 days"
                />
              </div>
              <Button
                onClick={handleGenerateRemand}
                className="w-full bg-accent text-black font-bold hover:bg-accent/80"
              >
                Generate Remand Report
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default FIRDraftAssistant;
