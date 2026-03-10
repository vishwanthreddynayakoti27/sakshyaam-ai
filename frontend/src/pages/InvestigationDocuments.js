import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileStack, 
  FileText, 
  Download, 
  Copy, 
  Printer, 
  Save,
  ChevronRight,
  User,
  MapPin,
  Calendar,
  Hash,
  Building,
  Shield
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const InvestigationDocuments = () => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    policeStation: '',
    crimeNumber: '',
    complainantName: '',
    accusedName: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    officerName: '',
    officerRank: '',
    witnessName: '',
    witnessAddress: '',
    seizureItems: '',
    bankName: '',
    accountNumber: '',
    description: ''
  });
  const [generatedDocument, setGeneratedDocument] = useState('');

  const templates = [
    { id: 'petition', name: 'Petition Report', icon: FileText, description: 'Initial petition/complaint report' },
    { id: 'csr', name: 'CSR Entry', icon: FileText, description: 'Crime & Station Report entry' },
    { id: 'witness', name: 'Witness Statement', icon: User, description: '161 CrPC / BNSS witness statement' },
    { id: 'arrest', name: 'Arrest Memo', icon: Shield, description: 'Arrest memorandum under BNSS' },
    { id: 'seizure', name: 'Seizure Panchanama', icon: FileStack, description: 'Evidence seizure document' },
    { id: 'bank', name: 'Bank Information Request', icon: Building, description: 'Letter to bank for account details' },
    { id: 'cdr', name: 'CDR Request Letter', icon: FileText, description: 'Call Detail Records request' },
    { id: 'cctv', name: 'CCTV Footage Request', icon: FileText, description: 'Request for CCTV footage' },
    { id: 'chargesheet', name: 'Charge Sheet Draft', icon: FileText, description: 'Draft charge sheet' },
    { id: 'status', name: 'Case Status Report', icon: FileText, description: 'Investigation status report' }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateDocument = () => {
    if (!selectedTemplate) {
      toast.error('Please select a document template');
      return;
    }

    let content = '';
    const { policeStation, crimeNumber, complainantName, accusedName, date, location, officerName, officerRank, witnessName, witnessAddress, seizureItems, bankName, accountNumber, description } = formData;

    switch (selectedTemplate) {
      case 'petition':
        content = `PETITION REPORT

Police Station: ${policeStation}
Crime Number: ${crimeNumber}
Date: ${date}

COMPLAINANT DETAILS:
Name: ${complainantName}
Address: ${location}

ACCUSED DETAILS:
Name: ${accusedName}

COMPLAINT DESCRIPTION:
${description}

This petition is filed under the provisions of Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023.

Received By: ${officerName}
Rank: ${officerRank}
Date & Time: ${new Date().toLocaleString()}

Signature of Complainant: _______________
Signature of Receiving Officer: _______________`;
        break;

      case 'csr':
        content = `CRIME & STATION REPORT (CSR)

Police Station: ${policeStation}
CSR Number: CSR/${crimeNumber}/${new Date().getFullYear()}
Date & Time of Entry: ${new Date().toLocaleString()}

INCIDENT DETAILS:
Location: ${location}
Date of Incident: ${date}

COMPLAINANT:
Name: ${complainantName}

ACCUSED (If Known):
Name: ${accusedName}

BRIEF FACTS:
${description}

ACTION TAKEN:
[ ] FIR Registered
[ ] Preliminary Enquiry Ordered
[ ] Referred to Concerned PS

Station House Officer: ${officerName}
Rank: ${officerRank}`;
        break;

      case 'witness':
        content = `WITNESS STATEMENT
(Under Section 180 BNSS / Section 161 CrPC)

Police Station: ${policeStation}
Crime Number: ${crimeNumber}
Date: ${date}

WITNESS DETAILS:
Name: ${witnessName || complainantName}
Address: ${witnessAddress || location}

STATEMENT:
I, ${witnessName || complainantName}, do hereby state as follows:

${description}

I state that the above statement is true to the best of my knowledge and belief.

Signature of Witness: _______________
Date: ${date}

Statement Recorded By:
Name: ${officerName}
Rank: ${officerRank}
Signature: _______________`;
        break;

      case 'arrest':
        content = `ARREST MEMORANDUM
(Under Section 50 BNSS)

Police Station: ${policeStation}
Crime Number: ${crimeNumber}
Date & Time of Arrest: ${new Date().toLocaleString()}

DETAILS OF ARRESTED PERSON:
Name: ${accusedName}
Address: ${location}

GROUNDS OF ARREST:
${description}

RIGHTS OF ARRESTED PERSON:
1. Right to be informed of grounds of arrest
2. Right to legal counsel
3. Right to inform a relative/friend
4. Right to be produced before Magistrate within 24 hours

Person Informed: _______________
Relationship: _______________
Time of Information: _______________

Arresting Officer:
Name: ${officerName}
Rank: ${officerRank}

Signature of Arrested Person: _______________
Signature of Arresting Officer: _______________
Signature of Witness: _______________`;
        break;

      case 'seizure':
        content = `SEIZURE PANCHANAMA
(Under Section 105 BNSS)

Police Station: ${policeStation}
Crime Number: ${crimeNumber}
Date & Time: ${new Date().toLocaleString()}
Place of Seizure: ${location}

In presence of the following witnesses, the following articles were seized:

ITEMS SEIZED:
${seizureItems || '1. \n2. \n3. '}

DESCRIPTION:
${description}

The seized articles have been properly sealed, labeled, and taken into custody.

Investigating Officer:
Name: ${officerName}
Rank: ${officerRank}
Signature: _______________

WITNESSES:
1. Name: _______________
   Address: _______________
   Signature: _______________

2. Name: _______________
   Address: _______________
   Signature: _______________`;
        break;

      case 'bank':
        content = `LETTER TO BANK FOR INFORMATION
(Under Section 94 BNSS)

From:
${officerName}
${officerRank}
${policeStation}

To:
The Branch Manager
${bankName || '[Bank Name]'}
[Branch Address]

Date: ${date}

Subject: Request for Bank Account Information - Crime No. ${crimeNumber}

Sir/Madam,

An investigation is being conducted in Crime No. ${crimeNumber} registered at ${policeStation} under the relevant sections of BNS.

In connection with the above investigation, you are requested to provide the following information:

1. Account Details for Account No: ${accountNumber || '[Account Number]'}
2. Account holder details
3. KYC documents
4. Last 6 months statement
5. Transaction details for suspicious transactions

The information is required urgently for the purpose of investigation.

This is issued under the authority vested in the undersigned under BNSS.

Yours faithfully,

${officerName}
${officerRank}
${policeStation}`;
        break;

      case 'cdr':
        content = `CDR REQUEST LETTER

From:
${officerName}
${officerRank}
${policeStation}

To:
The Nodal Officer
[Service Provider Name]
[Address]

Date: ${date}

Subject: Request for Call Detail Records - Crime No. ${crimeNumber}

Sir/Madam,

An investigation is being conducted in Crime No. ${crimeNumber} registered at ${policeStation}.

You are requested to provide the Call Detail Records (CDR) for the following mobile number(s):

Mobile Number(s): ${description || '[Mobile Numbers]'}

Period: From __________ To __________

Please provide:
1. Incoming and outgoing call details
2. SMS details
3. Data usage details
4. Cell tower/location information
5. IMEI details

This is an urgent requirement for investigation purposes.

Yours faithfully,

${officerName}
${officerRank}
${policeStation}`;
        break;

      case 'cctv':
        content = `CCTV FOOTAGE REQUEST

From:
${officerName}
${officerRank}
${policeStation}

To:
The Manager/Owner
${location || '[Establishment Name]'}
[Address]

Date: ${date}

Subject: Request for CCTV Footage - Crime No. ${crimeNumber}

Sir/Madam,

An investigation is being conducted in Crime No. ${crimeNumber} registered at ${policeStation}.

You are requested to preserve and provide the CCTV footage from your premises for:

Date: ${date}
Time: From __________ To __________
Location/Camera: ${description || '[Specific camera/location]'}

Please ensure the footage is provided in a readable format (USB/DVD).

This is required for investigation purposes under BNSS.

Yours faithfully,

${officerName}
${officerRank}
${policeStation}`;
        break;

      case 'chargesheet':
        content = `CHARGE SHEET (DRAFT)
(Under Section 193 BNSS)

IN THE COURT OF _______________

Crime Number: ${crimeNumber}
Police Station: ${policeStation}

STATE vs ${accusedName}

CHARGE SHEET

The investigation has been completed and the following charge sheet is submitted:

1. ACCUSED DETAILS:
   Name: ${accusedName}
   Address: ${location}

2. COMPLAINANT:
   Name: ${complainantName}

3. OFFENCES:
   [Applicable BNS Sections]

4. BRIEF FACTS:
${description}

5. EVIDENCE:
   - Witness Statements
   - Documentary Evidence
   - Scientific Evidence

6. PRAYER:
   It is prayed that the accused may be tried for the above offences.

Investigating Officer:
${officerName}
${officerRank}
${policeStation}
Date: ${date}`;
        break;

      case 'status':
        content = `CASE STATUS REPORT

Police Station: ${policeStation}
Crime Number: ${crimeNumber}
Date of Report: ${date}

CASE DETAILS:
Complainant: ${complainantName}
Accused: ${accusedName}
Date of Registration: __________

CURRENT STATUS:
${description || '[ ] Under Investigation\n[ ] Charge Sheet Filed\n[ ] Final Report Filed\n[ ] Trial Ongoing'}

INVESTIGATION PROGRESS:
1. Evidence collected: __________
2. Witnesses examined: __________
3. Accused status: __________
4. Next steps: __________

Investigating Officer:
${officerName}
${officerRank}

Supervisor Remarks:
_______________

Station House Officer:
Name: _______________
Signature: _______________`;
        break;

      default:
        content = 'Please select a valid template';
    }

    setGeneratedDocument(content);
    toast.success('Document generated successfully');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedDocument);
    toast.success('Copied to clipboard');
  };

  const downloadPDF = () => {
    if (!generatedDocument) {
      toast.error('Generate a document first');
      return;
    }

    const doc = new jsPDF();
    const lines = doc.splitTextToSize(generatedDocument, 180);
    
    doc.setFontSize(10);
    doc.text(lines, 15, 20);
    
    const templateName = templates.find(t => t.id === selectedTemplate)?.name || 'Document';
    doc.save(`${templateName.replace(/\s+/g, '_')}_${formData.crimeNumber || 'draft'}.pdf`);
    toast.success('PDF downloaded');
  };

  const printDocument = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${templates.find(t => t.id === selectedTemplate)?.name || 'Document'}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 40px; white-space: pre-wrap; }
          </style>
        </head>
        <body>${generatedDocument}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="investigation-documents-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <FileStack className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Investigation Documents
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            Generate police documents - Petitions, CSR, Statements, Memos & More
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Template Selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-lg font-heading font-bold text-white mb-4">Select Template</h2>
            
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    data-testid={`template-${template.id}`}
                    className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 ${
                      selectedTemplate === template.id
                        ? 'bg-accent/20 border-accent'
                        : 'bg-white/5 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <Icon size={18} className={selectedTemplate === template.id ? 'text-accent' : 'text-white/60'} />
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${selectedTemplate === template.id ? 'text-accent' : 'text-white'}`}>
                        {template.name}
                      </p>
                      <p className="text-white/50 text-xs">{template.description}</p>
                    </div>
                    <ChevronRight size={16} className={selectedTemplate === template.id ? 'text-accent' : 'text-white/30'} />
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Form Fields */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-lg font-heading font-bold text-white mb-4">Document Details</h2>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Police Station</label>
                  <Input
                    placeholder="PS Name"
                    value={formData.policeStation}
                    onChange={(e) => handleInputChange('policeStation', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm"
                    data-testid="input-police-station"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Crime Number</label>
                  <Input
                    placeholder="123/2025"
                    value={formData.crimeNumber}
                    onChange={(e) => handleInputChange('crimeNumber', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm"
                    data-testid="input-crime-number"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Complainant Name</label>
                <Input
                  placeholder="Full Name"
                  value={formData.complainantName}
                  onChange={(e) => handleInputChange('complainantName', e.target.value)}
                  className="bg-white/5 border-white/20 text-white text-sm"
                  data-testid="input-complainant"
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Accused Name</label>
                <Input
                  placeholder="Full Name (if known)"
                  value={formData.accusedName}
                  onChange={(e) => handleInputChange('accusedName', e.target.value)}
                  className="bg-white/5 border-white/20 text-white text-sm"
                  data-testid="input-accused"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Date</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm"
                    data-testid="input-date"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Location</label>
                  <Input
                    placeholder="Address/Place"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm"
                    data-testid="input-location"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Officer Name</label>
                  <Input
                    placeholder="Your Name"
                    value={formData.officerName}
                    onChange={(e) => handleInputChange('officerName', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm"
                    data-testid="input-officer-name"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Rank</label>
                  <Input
                    placeholder="SI/CI/Inspector"
                    value={formData.officerRank}
                    onChange={(e) => handleInputChange('officerRank', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm"
                    data-testid="input-officer-rank"
                  />
                </div>
              </div>

              {selectedTemplate === 'bank' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Bank Name</label>
                    <Input
                      placeholder="Bank Name"
                      value={formData.bankName}
                      onChange={(e) => handleInputChange('bankName', e.target.value)}
                      className="bg-white/5 border-white/20 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">Account Number</label>
                    <Input
                      placeholder="Account No."
                      value={formData.accountNumber}
                      onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                      className="bg-white/5 border-white/20 text-white text-sm"
                    />
                  </div>
                </div>
              )}

              {selectedTemplate === 'seizure' && (
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Items Seized</label>
                  <Textarea
                    placeholder="1. Item description&#10;2. Item description&#10;3. Item description"
                    value={formData.seizureItems}
                    onChange={(e) => handleInputChange('seizureItems', e.target.value)}
                    className="bg-white/5 border-white/20 text-white text-sm min-h-[80px]"
                  />
                </div>
              )}

              <div>
                <label className="text-white/60 text-xs mb-1 block">Description / Details</label>
                <Textarea
                  placeholder="Enter relevant details..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="bg-white/5 border-white/20 text-white text-sm min-h-[100px]"
                  data-testid="input-description"
                />
              </div>

              <Button
                onClick={generateDocument}
                data-testid="generate-document-btn"
                className="w-full bg-accent text-black font-bold hover:bg-accent/80"
              >
                Generate Document
              </Button>
            </div>
          </motion.div>

          {/* Document Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-white">Preview</h2>
              {generatedDocument && (
                <div className="flex gap-2">
                  <Button onClick={copyToClipboard} size="sm" className="bg-white/10 text-white hover:bg-white/20">
                    <Copy size={14} />
                  </Button>
                  <Button onClick={downloadPDF} size="sm" className="bg-white/10 text-white hover:bg-white/20">
                    <Download size={14} />
                  </Button>
                  <Button onClick={printDocument} size="sm" className="bg-white/10 text-white hover:bg-white/20">
                    <Printer size={14} />
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-black/40 rounded-lg p-4 border border-white/10 h-[500px] overflow-y-auto">
              {generatedDocument ? (
                <pre className="text-white/80 text-xs whitespace-pre-wrap font-mono" data-testid="document-preview">
                  {generatedDocument}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-white/40">
                  <div className="text-center">
                    <FileText size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Select a template and fill details</p>
                    <p className="text-sm mt-2">Document preview will appear here</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default InvestigationDocuments;
