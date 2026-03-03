import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Download, Printer, Mail, Share2, Eye, FileText, Upload, Clock, AlertTriangle, CheckCircle, Hash } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
    fir_number: '',
    status: 'Pending',
    nodal_officer_email: ''
  });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceHash, setEvidenceHash] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [savedRequests, setSavedRequests] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLetter, setPreviewLetter] = useState('');
  const [loading, setLoading] = useState(false);
  const [nodalOfficers, setNodalOfficers] = useState([]);

  useEffect(() => {
    loadRequests();
    loadNodalOfficers();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await api.get('/fraud/list');
      setSavedRequests(response.data);
    } catch (err) {
      console.error('Failed to load requests');
    }
  };

  const loadNodalOfficers = async () => {
    try {
      const response = await api.get('/nodal-officers');
      setNodalOfficers(response.data);
    } catch (err) {
      console.error('Failed to load nodal officers');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setEvidenceFile(file);
        
        // Client-side SHA-256 hash generation using Web Crypto API
        try {
          const buffer = await file.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
          
          setEvidenceHash(hashHex);
          toast.success('Evidence hash generated instantly!');
        } catch (err) {
          toast.error('Hash generation failed');
        }
        
        // OCR Extraction Pipeline
        performOCRExtraction(file);
      }
    }
  });

  const performOCRExtraction = async (file) => {
    // Mock OCR - In production, this would call Vision API
    setTimeout(() => {
      // Simulate OCR text extraction
      const mockOCRText = `Transaction Details
UTR: UTR202501234567890
Account Number: 1234567890123456
IFSC Code: HDFC0001234
Amount: Rs. 50,000.00
Date: 15/01/2025
Transaction successful`;

      // Extract UTR (alphanumeric 10-22 chars, often starts with UTR)
      const utrMatch = mockOCRText.match(/UTR[:\s]*([A-Z0-9]{10,22})/i);
      const utr = utrMatch ? utrMatch[1] : '';

      // Extract Account Number (9-18 digits)
      const accountMatch = mockOCRText.match(/Account\s*(?:Number|No)?[:\s]*(\d{9,18})/i);
      const accountNumber = accountMatch ? accountMatch[1] : '';

      // Extract IFSC (4 letters + 0 + 6 digits)
      const ifscMatch = mockOCRText.match(/IFSC[:\s]*([A-Z]{4}0[A-Z0-9]{6})/i);
      const ifsc = ifscMatch ? ifscMatch[1] : '';

      // Extract Amount (currency with digits)
      const amountMatch = mockOCRText.match(/(?:Rs\.?|₹|Amount)[:\s]*([\d,]+(?:\.\d{2})?)/i);
      const amount = amountMatch ? amountMatch[1].replace(/,/g, '') : '';

      // Extract Date (various formats)
      const dateMatch = mockOCRText.match(/(?:Date|Transaction\s*Date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
      let transactionDate = '';
      if (dateMatch) {
        const parts = dateMatch[1].split(/[\/\-]/);
        // Convert to YYYY-MM-DD format
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          transactionDate = `${year}-${month}-${day}`;
        }
      }

      const extracted = {
        utr,
        accountNumber,
        ifsc,
        amount,
        transactionDate
      };

      setExtractedData(extracted);

      // Auto-fill form
      setFormData(prev => ({
        ...prev,
        transaction_id: utr || prev.transaction_id,
        account_number: accountNumber || prev.account_number,
        ifsc_code: ifsc || prev.ifsc_code,
        amount: amount || prev.amount,
        transaction_date: transactionDate || prev.transaction_date
      }));

      if (utr || accountNumber || ifsc || amount) {
        toast.success('Transaction details auto-detected and filled!');
      } else {
        toast.warning('⚠ Manual verification required - OCR detection partial');
      }
    }, 1500);
  };

  const generateSec63Certificate = () => {
    if (!evidenceHash) {
      toast.error('No evidence hash available');
      return;
    }

    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const certificateText = `
CERTIFICATE UNDER SECTION 63
BHARATIYA SAKSHYA ADHINIYAM, 2023

Date: ${today}

I, ${formData.investigating_officer || '[Officer Name]'}, ${formData.police_station || '[Police Station]'}, hereby certify that:

1. ELECTRONIC EVIDENCE DETAILS:
   
   File Hash (SHA-256):
   ${evidenceHash}
   
   This hash was computed on ${today} using SHA-256 cryptographic algorithm as per standard forensic procedures.

2. EVIDENCE DESCRIPTION:
   
   Case Reference: ${formData.fir_number || 'Pending FIR Registration'}
   Transaction ID/UTR: ${formData.transaction_id || 'N/A'}
   Amount Involved: Rs. ${formData.amount ? parseFloat(formData.amount).toLocaleString('en-IN') : 'N/A'}
   Bank: ${formData.bank_name || 'N/A'}

3. CHAIN OF CUSTODY:
   
   Evidence obtained from: ${formData.victim_name || '[Victim Name]'}
   Date of Collection: ${today}
   Location: ${formData.police_station || '[Police Station]'}

4. AUTHENTICATION:
   
   This electronic record has been authenticated as per Section 63 of the Bharatiya Sakshya Adhiniyam, 2023. The hash value ensures the integrity and authenticity of the digital evidence.

5. DECLARATION:
   
   I declare that the above information is true and correct to the best of my knowledge and belief. The electronic evidence has been preserved in its original form and has not been tampered with.


___________________________
${formData.investigating_officer || '[Officer Name]'}
${formData.police_station || '[Police Station]'}

Date: ${today}


Note: This certificate is issued for the purpose of legal proceedings and investigation under the provisions of the Bharatiya Sakshya Adhiniyam, 2023.
    `.trim();

    doc.setFont('courier');
    doc.setFontSize(10);

    const lines = doc.splitTextToSize(certificateText, 180);
    let y = 20;

    lines.forEach(line => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 15, y);
      y += 5;
    });

    doc.save(`sec63-certificate-${Date.now()}.pdf`);
    toast.success('Section 63 BSA Certificate generated!');
  };

  const handleBankChange = (bankName) => {
    setFormData(prev => ({ ...prev, bank_name: bankName }));
    
    const nodal = nodalOfficers.find(n => n.bank_name === bankName);
    if (nodal) {
      setFormData(prev => ({ ...prev, nodal_officer_email: nodal.nodal_officer_email }));
      toast.info(`Nodal officer auto-filled: ${nodal.nodal_officer_email}`);
    }
  };

  const calculateTimeRemaining = (createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diff = 24 * 60 * 60 * 1000 - (now - created);
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${hours}h ${minutes}m`;
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
${data.nodal_officer_email ? `Nodal Officer: ${data.nodal_officer_email}` : ''}

Subject: Urgent Request for Account Lien/Freezing - Cyber Fraud Investigation

Respected Sir/Madam,

This is with reference to a cyber fraud complaint registered at ${data.police_station}${data.fir_number ? ` vide FIR No. ${data.fir_number}` : ''}. The investigation is being conducted by ${data.investigating_officer}.

DETAILS OF THE FRAUDULENT TRANSACTION:

Victim Name: ${data.victim_name}
Contact Number: ${data.complainant_contact}
Transaction ID/UTR: ${data.transaction_id}
Amount Involved: Rs. ${parseFloat(data.amount).toLocaleString('en-IN')}
Transaction Date: ${new Date(data.transaction_date).toLocaleDateString('en-IN')}
${data.account_number ? `Suspect Account Number: ${data.account_number}` : ''}

EVIDENCE REFERENCE:

${evidenceHash ? `This request is supported by electronic evidence bearing SHA-256 hash:
${evidenceHash}

Evidence authentication completed as per Section 63 of the Bharatiya Sakshya Adhiniyam, 2023.` : 'Evidence documentation in progress.'}

The victim has reported that the above-mentioned amount was fraudulently transferred/debited through cyber fraud tactics. The investigation is in progress, and immediate action is necessary to prevent further movement of funds and preserve evidence.

In view of the urgency and to ensure effective investigation, you are hereby requested to:

1. Immediately place a lien on the account associated with Transaction ID/UTR: ${data.transaction_id}
2. Freeze all transactions from the said account with immediate effect
3. Preserve all transaction records, account details, and beneficiary information
4. Provide transaction history and complete KYC details of the account holder to the undersigned
5. Confirm compliance and provide acknowledgment at the earliest

This is a matter of urgent investigation under the provisions of the Indian Penal Code and Information Technology Act. Your prompt cooperation is solicited in the interest of justice and victim relief.

The Golden Hour for fraud recovery is critical. Please treat this as most urgent.

Thanking you for your cooperation,

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

  const handleStatusUpdate = async (requestId, newStatus) => {
    try {
      const formData = new FormData();
      formData.append('status', newStatus);
      await api.put(`/fraud/${requestId}/status`, formData);
      toast.success('Status updated!');
      loadRequests();
    } catch (err) {
      toast.error('Failed to update status');
    }
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
              AASARA Fraud Recovery Assistant
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            Golden Hour Dashboard • Bank Lien Generator • Evidence Management
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glassmorphism rounded-xl p-6 border border-white/10 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Upload className="text-accent" size={24} />
            <h2 className="text-xl font-heading font-bold text-white">Upload Evidence (Bank Screenshot / Passbook / SMS)</h2>
          </div>

          <div
            {...getRootProps()}
            data-testid="evidence-dropzone"
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-accent bg-accent/10'
                : 'border-white/20 hover:border-accent/50 bg-white/5'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                <Upload className="text-accent" size={24} />
              </div>
              {evidenceFile ? (
                <div>
                  <p className="text-white font-semibold mb-1">{evidenceFile.name}</p>
                  <p className="text-white/60 text-sm">{(evidenceFile.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-white font-semibold mb-1">Upload Image or PDF</p>
                  <p className="text-white/60 text-sm">JPG, PNG, PDF</p>
                </div>
              )}
            </div>
          </div>

          {evidenceHash && (
            <div className="mt-4 space-y-3">
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="text-accent" size={20} />
                  <span className="text-accent font-bold text-sm">🔐 Digital Evidence Hash (SHA-256)</span>
                </div>
                <div className="bg-black/30 rounded p-3 font-mono text-xs text-white break-all">
                  {evidenceHash}
                </div>
              </div>
              
              <Button
                onClick={generateSec63Certificate}
                className="w-full bg-transparent border border-success/50 text-success hover:bg-success/10 transition-all rounded-sm uppercase tracking-wider text-sm"
              >
                📜 Generate Sec 63 BSA Certificate
              </Button>
            </div>
          )}

          {extractedData && (
            <div className="mt-4 bg-success/10 border border-success/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="text-success" size={20} />
                <span className="text-success font-bold">✔ Extracted Transaction Details</span>
                <span className="ml-auto text-white/60 text-xs">
                  {(extractedData.utr && extractedData.accountNumber && extractedData.ifsc)
                    ? '✔ Auto Detected'
                    : '⚠ Manual Verification Required'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/90 text-xs">UTR Number</Label>
                  <Input
                    value={extractedData.utr}
                    onChange={(e) => {
                      setExtractedData({...extractedData, utr: e.target.value});
                      setFormData({...formData, transaction_id: e.target.value});
                    }}
                    className="bg-black/30 border-white/10 text-white text-sm h-9"
                    placeholder="UTR not detected"
                  />
                </div>
                <div>
                  <Label className="text-white/90 text-xs">Account Number</Label>
                  <Input
                    value={extractedData.accountNumber}
                    onChange={(e) => {
                      setExtractedData({...extractedData, accountNumber: e.target.value});
                      setFormData({...formData, account_number: e.target.value});
                    }}
                    className="bg-black/30 border-white/10 text-white text-sm h-9"
                    placeholder="Account not detected"
                  />
                </div>
                <div>
                  <Label className="text-white/90 text-xs">IFSC Code</Label>
                  <Input
                    value={extractedData.ifsc}
                    onChange={(e) => {
                      setExtractedData({...extractedData, ifsc: e.target.value});
                      setFormData({...formData, ifsc_code: e.target.value});
                    }}
                    className="bg-black/30 border-white/10 text-white text-sm h-9"
                    placeholder="IFSC not detected"
                  />
                </div>
                <div>
                  <Label className="text-white/90 text-xs">Amount</Label>
                  <Input
                    value={extractedData.amount}
                    onChange={(e) => {
                      setExtractedData({...extractedData, amount: e.target.value});
                      setFormData({...formData, amount: e.target.value});
                    }}
                    className="bg-black/30 border-white/10 text-white text-sm h-9"
                    placeholder="Amount not detected"
                  />
                </div>
                <div>
                  <Label className="text-white/90 text-xs">Transaction Date</Label>
                  <Input
                    type="date"
                    value={extractedData.transactionDate}
                    onChange={(e) => {
                      setExtractedData({...extractedData, transactionDate: e.target.value});
                      setFormData({...formData, transaction_date: e.target.value});
                    }}
                    className="bg-black/30 border-white/10 text-white text-sm h-9"
                  />
                </div>
              </div>
            </div>
          )}
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
                  <Label className="text-white/90">Transaction ID/UTR *</Label>
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
                  <Select value={formData.bank_name} onValueChange={handleBankChange} required>
                    <SelectTrigger className="bg-black/20 border-white/10 text-white">
                      <SelectValue placeholder="Select Bank" />
                    </SelectTrigger>
                    <SelectContent className="bg-secondary border-white/10 text-white">
                      {nodalOfficers.map((bank) => (
                        <SelectItem key={bank.bank_name} value={bank.bank_name}>
                          {bank.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                {formData.nodal_officer_email && (
                  <div>
                    <Label className="text-white/90">Nodal Officer Email</Label>
                    <Input
                      value={formData.nodal_officer_email}
                      className="bg-black/20 border-success/30 text-success"
                      readOnly
                    />
                  </div>
                )}
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
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-warning" size={24} />
              <h3 className="text-xl font-heading font-bold text-white">Golden Hour Dashboard</h3>
            </div>
            <div className="space-y-3">
              {savedRequests.slice(0, 10).map((request) => {
                const timeRemaining = calculateTimeRemaining(request.created_at);
                const isExpired = timeRemaining === 'Expired';
                
                return (
                  <div
                    key={request.id}
                    className={`bg-black/20 border rounded-lg p-4 ${
                      isExpired ? 'border-alert/30' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-white font-semibold">{request.victim_name}</p>
                        <p className="text-white/60 text-sm">
                          {request.bank_name} • UTR: {request.transaction_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-accent font-bold">₹{parseFloat(request.amount).toLocaleString('en-IN')}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isExpired ? 'text-alert' : 'text-warning'}`}>
                          {isExpired ? <AlertTriangle size={14} /> : <Clock size={14} />}
                          <span className="text-xs font-semibold">{timeRemaining}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Select 
                        value={request.status || 'Pending'} 
                        onValueChange={(value) => handleStatusUpdate(request.id, value)}
                      >
                        <SelectTrigger className="bg-black/20 border-white/10 text-white h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-secondary border-white/10 text-white">
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Lien Sent">Lien Sent</SelectItem>
                          <SelectItem value="Bank Acknowledged">Bank Acknowledged</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-white/40 text-xs">
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
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
