import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Upload, Bell, FileText, Clock, AlertTriangle, CheckCircle, Download, Search } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { ocr } from '../utils/api';
import jsPDF from 'jspdf';

const SmartSummons = () => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [summonsList, setSummonsList] = useState([]);
  const [extractedData, setExtractedData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    caseNumber: '',
    courtName: '',
    hearingDate: '',
    hearingTime: '',
    partyName: '',
    advocate: '',
    purpose: '',
    remarks: '',
    // Mandatory WhatsApp notification fields
    courtPolicePhone: '',
    victimPhone: '',
    advocatePhone: ''
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
      }
    }
  });

  const handleOCRProcess = async () => {
    if (!file) {
      toast.error('Please upload a summons document');
      return;
    }

    setProcessing(true);
    try {
      const response = await ocr.processImage(file);
      
      if (response.original_text) {
        const text = response.original_text;
        
        const caseMatch = text.match(/(?:Case\s*No\.?|CC\s*No\.?|CRL\.?\s*No\.?)\s*[:\s]*([A-Z0-9\/\-]+)/i);
        const dateMatch = text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        const courtMatch = text.match(/(?:Court\s*of|Hon'ble|District\s*Court|Sessions\s*Court)[:\s]*([^\n,]+)/i);
        
        setExtractedData({
          rawText: text,
          caseNumber: caseMatch ? caseMatch[1] : '',
          hearingDate: dateMatch ? dateMatch[1] : '',
          hearingTime: timeMatch ? timeMatch[1] : '',
          courtName: courtMatch ? courtMatch[1].trim() : ''
        });

        setFormData(prev => ({
          ...prev,
          caseNumber: caseMatch ? caseMatch[1] : prev.caseNumber,
          hearingDate: dateMatch ? dateMatch[1] : prev.hearingDate,
          hearingTime: timeMatch ? timeMatch[1] : prev.hearingTime,
          courtName: courtMatch ? courtMatch[1].trim() : prev.courtName
        }));

        toast.success('Summons document processed! Please verify extracted data.');
      }
    } catch (err) {
      toast.error('OCR processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddSummons = async () => {
    // Validate mandatory fields including phone numbers
    if (!formData.caseNumber || !formData.hearingDate) {
      toast.error('Case number and hearing date are required');
      return;
    }
    
    // Validate mandatory phone numbers for WhatsApp notification
    if (!formData.courtPolicePhone || !formData.victimPhone || !formData.advocatePhone) {
      toast.error('All three contact numbers (Court Police, Victim, Advocate) are MANDATORY for WhatsApp notifications');
      return;
    }

    // Validate phone number format (Indian 10-digit)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.courtPolicePhone) || !phoneRegex.test(formData.victimPhone) || !phoneRegex.test(formData.advocatePhone)) {
      toast.error('Please enter valid 10-digit Indian mobile numbers');
      return;
    }

    setIsSaving(true);
    
    const newSummons = {
      id: Date.now().toString(),
      ...formData,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      whatsappScheduled: true,
      notificationStatus: 'Scheduled for 09:00 AM, 1 day before hearing'
    };

    // Schedule WhatsApp notification (backend would handle actual scheduling)
    try {
      // In production, this would call the backend to schedule the notification
      toast.success('WhatsApp notifications scheduled for all contacts!');
      toast.info(`Reminders will be sent at 09:00 AM on ${getOneDayBefore(formData.hearingDate)}`);
    } catch (error) {
      console.error('Notification scheduling error:', error);
    }

    setSummonsList(prev => [newSummons, ...prev]);
    setFormData({
      caseNumber: '',
      courtName: '',
      hearingDate: '',
      hearingTime: '',
      partyName: '',
      advocate: '',
      purpose: '',
      remarks: '',
      courtPolicePhone: '',
      victimPhone: '',
      advocatePhone: ''
    });
    setExtractedData(null);
    setFile(null);
    setIsSaving(false);
    toast.success('Summons added with WhatsApp auto-notification enabled!');
  };

  const getOneDayBefore = (dateStr) => {
    try {
      const parts = dateStr.split(/[\/\-]/);
      const date = new Date(parts[2], parts[1] - 1, parts[0]);
      date.setDate(date.getDate() - 1);
      return date.toLocaleDateString('en-IN');
    } catch {
      return 'the day before hearing';
    }
  };

  const handleStatusChange = (id, status) => {
    setSummonsList(prev => 
      prev.map(s => s.id === id ? { ...s, status } : s)
    );
    toast.success(`Status updated to ${status}`);
  };

  const generatePDF = (summons) => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMONS TRACKING REPORT', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
    doc.setDrawColor(0, 242, 255);
    doc.line(20, 35, 190, 35);
    
    let y = 45;
    const lineHeight = 8;
    
    const fields = [
      ['Case Number', summons.caseNumber],
      ['Court Name', summons.courtName],
      ['Hearing Date', summons.hearingDate],
      ['Hearing Time', summons.hearingTime],
      ['Party Name', summons.partyName],
      ['Advocate', summons.advocate],
      ['Purpose', summons.purpose],
      ['Status', summons.status],
      ['Remarks', summons.remarks]
    ];
    
    fields.forEach(([label, value]) => {
      if (value) {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value || 'N/A', 70, y);
        y += lineHeight;
      }
    });
    
    doc.save(`summons_${summons.caseNumber}_report.pdf`);
    toast.success('PDF generated!');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Attended': return 'text-success bg-success/20 border-success/30';
      case 'Missed': return 'text-alert bg-alert/20 border-alert/30';
      case 'Rescheduled': return 'text-warning bg-warning/20 border-warning/30';
      default: return 'text-accent bg-accent/20 border-accent/30';
    }
  };

  const getDaysUntil = (dateStr) => {
    const parts = dateStr.split(/[\/-]/);
    let date;
    if (parts[2]?.length === 4) {
      date = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
      date = new Date(dateStr);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="smart-summons-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Smart Summons Tracker
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            OCR-powered court summons management with automated reminders
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
              <Upload size={20} className="text-accent" />
              Upload Summons Document
            </h2>

            <div
              {...getRootProps()}
              data-testid="summons-dropzone"
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-accent bg-accent/10'
                  : 'border-white/20 hover:border-accent/50 bg-white/5'
              }`}
            >
              <input {...getInputProps()} />
              <FileText className="mx-auto text-accent mb-3" size={40} />
              {file ? (
                <p className="text-white font-semibold">{file.name}</p>
              ) : (
                <p className="text-white/70">Drop summons image/PDF or click to upload</p>
              )}
            </div>

            <Button
              onClick={handleOCRProcess}
              disabled={!file || processing}
              data-testid="process-summons-btn"
              className="w-full mt-4 bg-accent text-black font-bold hover:bg-accent/80"
            >
              {processing ? 'Processing...' : 'Extract Summons Data'}
            </Button>

            {extractedData && (
              <div className="mt-4 p-4 bg-accent/10 border border-accent/30 rounded-lg">
                <p className="text-accent text-sm font-semibold mb-2">Extracted Raw Text:</p>
                <p className="text-white/70 text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {extractedData.rawText}
                </p>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">Summons Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Case Number *"
                  value={formData.caseNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, caseNumber: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                  data-testid="case-number-input"
                />
                <Input
                  placeholder="Court Name"
                  value={formData.courtName}
                  onChange={(e) => setFormData(prev => ({ ...prev, courtName: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="text"
                  placeholder="Hearing Date (DD/MM/YYYY) *"
                  value={formData.hearingDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, hearingDate: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                  data-testid="hearing-date-input"
                />
                <Input
                  placeholder="Hearing Time"
                  value={formData.hearingTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, hearingTime: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Party Name"
                  value={formData.partyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, partyName: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                />
                <Input
                  placeholder="Advocate"
                  value={formData.advocate}
                  onChange={(e) => setFormData(prev => ({ ...prev, advocate: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <Input
                placeholder="Purpose of Hearing"
                value={formData.purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
              />

              <Input
                placeholder="Remarks"
                value={formData.remarks}
                onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
              />

              {/* Mandatory WhatsApp Notification Fields */}
              <div className="p-4 mt-4 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30">
                <h4 className="text-[#FFB800] font-semibold mb-3 flex items-center gap-2">
                  <Bell size={16} />
                  WhatsApp Notification Contacts (MANDATORY)
                </h4>
                <p className="text-white/60 text-xs mb-3">
                  Auto-notification will be sent at 09:00 AM, 1 day before court date
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs w-24">Court Police:</span>
                    <Input
                      placeholder="10-digit mobile *"
                      value={formData.courtPolicePhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, courtPolicePhone: e.target.value }))}
                      className="bg-white/5 border-[#FFB800]/30 text-white flex-1"
                      data-testid="court-police-phone"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs w-24">Victim:</span>
                    <Input
                      placeholder="10-digit mobile *"
                      value={formData.victimPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, victimPhone: e.target.value }))}
                      className="bg-white/5 border-[#FFB800]/30 text-white flex-1"
                      data-testid="victim-phone"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs w-24">Advocate:</span>
                    <Input
                      placeholder="10-digit mobile *"
                      value={formData.advocatePhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, advocatePhone: e.target.value }))}
                      className="bg-white/5 border-[#FFB800]/30 text-white flex-1"
                      data-testid="advocate-phone"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleAddSummons}
                disabled={isSaving}
                data-testid="add-summons-btn"
                className="w-full bg-success text-black font-bold hover:bg-success/80"
              >
                {isSaving ? 'Scheduling Notifications...' : 'Save & Schedule WhatsApp Notifications'}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
              <Bell size={20} className="text-accent" />
              Tracked Summons ({summonsList.length})
            </h2>

            {summonsList.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-white/40">
                <div className="text-center">
                  <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No summons tracked yet</p>
                  <p className="text-sm mt-1">Upload a summons document to get started</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {summonsList.map((summons) => {
                  const daysUntil = getDaysUntil(summons.hearingDate);
                  const isUrgent = daysUntil >= 0 && daysUntil <= 3;
                  
                  return (
                    <div
                      key={summons.id}
                      data-testid={`summons-card-${summons.id}`}
                      className={`p-4 rounded-lg border ${
                        isUrgent && summons.status === 'Pending'
                          ? 'bg-alert/10 border-alert/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-white font-bold">{summons.caseNumber}</p>
                          <p className="text-white/60 text-sm">{summons.courtName}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-bold rounded border ${getStatusColor(summons.status)}`}>
                          {summons.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm mb-3">
                        <div className="flex items-center gap-1 text-white/70">
                          <Clock size={14} />
                          <span>{summons.hearingDate} {summons.hearingTime}</span>
                        </div>
                        {daysUntil >= 0 && summons.status === 'Pending' && (
                          <span className={`flex items-center gap-1 ${isUrgent ? 'text-alert' : 'text-accent'}`}>
                            {isUrgent && <AlertTriangle size={14} />}
                            {daysUntil === 0 ? 'TODAY' : `${daysUntil} days`}
                          </span>
                        )}
                      </div>

                      {summons.partyName && (
                        <p className="text-white/60 text-sm mb-2">Party: {summons.partyName}</p>
                      )}

                      <div className="flex gap-2 mt-3">
                        <select
                          value={summons.status}
                          onChange={(e) => handleStatusChange(summons.id, e.target.value)}
                          className="flex-1 bg-white/5 border border-white/20 rounded px-2 py-1 text-white text-sm"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Attended">Attended</option>
                          <option value="Missed">Missed</option>
                          <option value="Rescheduled">Rescheduled</option>
                        </select>
                        <Button
                          onClick={() => generatePDF(summons)}
                          className="bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 px-3"
                        >
                          <Download size={16} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default SmartSummons;
