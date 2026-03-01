import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Download, Printer, Mail, Share2, Eye, FileText } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { api } from '../utils/api';
import jsPDF from 'jspdf';

const FraudRecovery = () => {
  const [formData, setFormData] = useState({
    victim_name: '',
    complainant_contact: '',
    transaction_id: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    amount: '',
    transaction_date: '',
    police_station: '',
    investigating_officer: '',
    fir_number: ''
  });
  const [savedRequests, setSavedRequests] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLetter, setPreviewLetter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await api.get('/fraud/list');
      setSavedRequests(response.data);
    } catch (err) {
      console.error('Failed to load requests');
    }
  };

  const generateLetter = (data) => {
    const today = new Date().toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `
${data.police_station}
${today}

To,
The Branch Manager
${data.bank_name}
${data.ifsc_code ? `IFSC: ${data.ifsc_code}` : ''}

Subject: Request for Lien/Freezing of Account - Cyber Crime Investigation

Respected Sir/Madam,

This is with reference to a cyber fraud complaint registered at ${data.police_station}${data.fir_number ? ` vide FIR No. ${data.fir_number}` : ''}. The investigation is being conducted by ${data.investigating_officer}.

DETAILS OF THE FRAUD TRANSACTION:

Victim Name: ${data.victim_name}
Contact Number: ${data.complainant_contact}
Transaction ID: ${data.transaction_id}
Amount Involved: Rs. ${parseFloat(data.amount).toLocaleString('en-IN')}
Transaction Date: ${new Date(data.transaction_date).toLocaleDateString('en-IN')}
${data.account_number ? `Account Number: ${data.account_number}` : ''}

The victim has reported that the above-mentioned amount was fraudulently transferred/debited from their account due to cyber fraud. The investigation is in progress, and it is necessary to freeze the said account to prevent further transactions and preserve evidence.

In view of the above, you are hereby requested to:

1. Immediately place a lien on the account associated with Transaction ID: ${data.transaction_id}
2. Freeze all transactions from the said account with immediate effect
3. Preserve all transaction records and account details
4. Provide transaction history and KYC details of the account holder to the undersigned

This is a matter of urgent investigation, and your prompt cooperation is solicited. The bank is requested to take necessary action and confirm compliance at the earliest.

Please treat this as most urgent.

Thanking you,

Yours faithfully,

${data.investigating_officer}
${data.police_station}

Contact: ${data.complainant_contact}
${data.fir_number ? `FIR No.: ${data.fir_number}` : ''}
    `.trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/fraud/create', formData);
      toast.success('Fraud recovery request saved!');
      loadRequests();
      
      const letter = generateLetter(formData);
      setPreviewLetter(letter);
      setShowPreview(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save request');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const letter = previewLetter || generateLetter(formData);
    
    doc.setFont('courier');
    doc.setFontSize(11);
    
    const lines = doc.splitTextToSize(letter, 180);
    let y = 20;
    
    lines.forEach(line => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 15, y);
      y += 6;
    });
    
    doc.save(`fraud-lien-request-${formData.transaction_id || Date.now()}.pdf`);
    toast.success('PDF downloaded!');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Bank Lien Request</title>');
    printWindow.document.write('<style>body{font-family:monospace;padding:40px;line-height:1.6}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<pre>' + (previewLetter || generateLetter(formData)) + '</pre>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="fraud-recovery-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Fraud Recovery Assistant
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            Generate bank lien/freezing request letters for cybercrime investigations
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-6" data-testid="form-section-title">
              Fraud Case Details
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/90">Victim Name *</Label>
                  <Input
                    data-testid="victim-name-input"
                    value={formData.victim_name}
                    onChange={(e) => setFormData({ ...formData, victim_name: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/90">Complainant Contact *</Label>
                  <Input
                    data-testid="complainant-contact-input"
                    value={formData.complainant_contact}
                    onChange={(e) => setFormData({ ...formData, complainant_contact: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                    placeholder="+91 XXXXXXXXXX"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/90">Transaction ID *</Label>
                  <Input
                    data-testid="transaction-id-input"
                    value={formData.transaction_id}
                    onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/90">Bank Name *</Label>
                  <Input
                    data-testid="bank-name-input"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/90">Account Number</Label>
                  <Input
                    data-testid="account-number-input"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                  />
                </div>

                <div>
                  <Label className="text-white/90">IFSC Code</Label>
                  <Input
                    data-testid="ifsc-code-input"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                  />
                </div>

                <div>
                  <Label className="text-white/90">Amount (Rs.) *</Label>
                  <Input
                    data-testid="amount-input"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/90">Transaction Date *</Label>
                  <Input
                    data-testid="transaction-date-input"
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/90">Police Station *</Label>
                  <Input
                    data-testid="police-station-input"
                    value={formData.police_station}
                    onChange={(e) => setFormData({ ...formData, police_station: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/90">Investigating Officer *</Label>
                  <Input
                    data-testid="investigating-officer-input"
                    value={formData.investigating_officer}
                    onChange={(e) => setFormData({ ...formData, investigating_officer: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-white/90">FIR Number</Label>
                  <Input
                    data-testid="fir-number-input"
                    value={formData.fir_number}
                    onChange={(e) => setFormData({ ...formData, fir_number: e.target.value })}
                    className="bg-black/20 border-white/10 focus:border-accent text-white"
                  />
                </div>
              </div>

              <Button
                data-testid="generate-letter-button"
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider py-6 mt-6"
              >
                {loading ? 'Generating...' : 'Generate Lien Request Letter'}
              </Button>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h3 className="text-xl font-heading font-bold text-white mb-4">Actions</h3>
            
            <div className="space-y-3">
              <Button
                data-testid="preview-letter-button"
                onClick={() => {
                  setPreviewLetter(generateLetter(formData));
                  setShowPreview(true);
                }}
                className="w-full bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm uppercase tracking-wider"
              >
                <Eye size={16} className="mr-2" />
                Preview Letter
              </Button>

              <Button
                data-testid="download-pdf-button"
                onClick={handleDownloadPDF}
                className="w-full bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm uppercase tracking-wider"
              >
                <Download size={16} className="mr-2" />
                Download PDF
              </Button>

              <Button
                data-testid="print-button"
                onClick={handlePrint}
                className="w-full bg-transparent border border-accent/50 text-accent hover:bg-accent/10 transition-all rounded-sm uppercase tracking-wider"
              >
                <Printer size={16} className="mr-2" />
                Print
              </Button>

              <Button
                data-testid="email-button"
                onClick={() => toast.info('Email functionality - Mock')}
                className="w-full bg-transparent border border-white/20 text-white/60 hover:bg-white/5 transition-all rounded-sm uppercase tracking-wider"
              >
                <Mail size={16} className="mr-2" />
                Email (Mock)
              </Button>

              <Button
                data-testid="whatsapp-button"
                onClick={() => toast.info('WhatsApp sharing - Mock')}
                className="w-full bg-transparent border border-white/20 text-white/60 hover:bg-white/5 transition-all rounded-sm uppercase tracking-wider"
              >
                <Share2 size={16} className="mr-2" />
                WhatsApp (Mock)
              </Button>
            </div>
          </motion.div>
        </div>

        {savedRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h3 className="text-xl font-heading font-bold text-white mb-4">Recent Requests</h3>
            <div className="space-y-3">
              {savedRequests.slice(0, 5).map((request) => (
                <div
                  key={request.id}
                  className="bg-black/20 border border-white/10 rounded-lg p-4 hover:border-accent/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">{request.victim_name}</p>
                      <p className="text-white/60 text-sm">
                        {request.bank_name} • Transaction ID: {request.transaction_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-accent font-bold">₹{parseFloat(request.amount).toLocaleString('en-IN')}</p>
                      <p className="text-white/40 text-xs">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="bg-secondary border-white/10 text-white max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl text-accent flex items-center gap-2">
                <FileText size={24} />
                Bank Lien Request Letter Preview
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 p-6 bg-black/30 rounded-lg border border-white/10">
              <pre className="text-white/90 text-sm whitespace-pre-wrap font-mono" data-testid="letter-preview">
                {previewLetter}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default FraudRecovery;
