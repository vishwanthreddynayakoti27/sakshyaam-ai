import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Languages, 
  Printer, 
  Save,
  Download,
  ToggleLeft,
  ToggleRight,
  Users,
  MapPin,
  Phone,
  Calendar
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import api from '../utils/api';

const CDFFiller = () => {
  const [language, setLanguage] = useState('english');
  const [isSaving, setIsSaving] = useState(false);
  
  // CDF Form Fields
  const [formData, setFormData] = useState({
    police_station: '',
    district: '',
    fir_number: '',
    fir_date: '',
    sections: '',
    gd_number: '',
    gd_time: '',
    occurrence_date: '',
    occurrence_time: '',
    occurrence_place: '',
    complainant_name: '',
    complainant_father: '',
    complainant_age: '',
    complainant_caste: '',
    complainant_occupation: '',
    complainant_address: '',
    complainant_phone: '',
    accused: [{ name: '', father: '', age: '', caste: '', occupation: '', address: '', phone: '' }],
    witnesses: [{ name: '', father: '', age: '', caste: '', address: '', phone: '', role: '' }],
    modus_operandi: '',
    property_lost: '',
    property_recovered: '',
    brief_facts: '',
    rough_sketch_notes: ''
  });

  // Bilingual Labels
  const labels = {
    police_station: { english: 'Police Station', telugu: 'పోలీస్ స్టేషన్' },
    district: { english: 'District', telugu: 'జిల్లా' },
    fir_number: { english: 'FIR Number', telugu: 'ఎఫ్.ఐ.ఆర్. నంబర్' },
    fir_date: { english: 'FIR Date', telugu: 'ఎఫ్.ఐ.ఆర్. తేదీ' },
    sections: { english: 'Sections of Law', telugu: 'చట్ట సెక్షన్లు' },
    gd_number: { english: 'GD Entry No.', telugu: 'జి.డి. ఎంట్రీ నం.' },
    gd_time: { english: 'GD Entry Time', telugu: 'జి.డి. సమయం' },
    occurrence_date: { english: 'Date of Occurrence', telugu: 'సంఘటన తేదీ' },
    occurrence_time: { english: 'Time of Occurrence', telugu: 'సంఘటన సమయం' },
    occurrence_place: { english: 'Place of Occurrence', telugu: 'సంఘటన స్థలం' },
    complainant: { english: 'Complainant Details', telugu: 'ఫిర్యాదీ వివరాలు' },
    name: { english: 'Name', telugu: 'పేరు' },
    father: { english: 'Father/Husband Name', telugu: 'తండ్రి/భర్త పేరు' },
    age: { english: 'Age', telugu: 'వయస్సు' },
    caste: { english: 'Caste', telugu: 'కులం' },
    occupation: { english: 'Occupation', telugu: 'వృత్తి' },
    address: { english: 'Address', telugu: 'చిరునామా' },
    phone: { english: 'Phone', telugu: 'ఫోన్' },
    accused: { english: 'Accused Details', telugu: 'నిందితుల వివరాలు' },
    witnesses: { english: 'Witness Details', telugu: 'సాక్షుల వివరాలు' },
    modus_operandi: { english: 'Modus Operandi', telugu: 'నేర పద్ధతి' },
    property_lost: { english: 'Property Lost', telugu: 'పోయిన ఆస్తి' },
    property_recovered: { english: 'Property Recovered', telugu: 'రికవర్ చేసిన ఆస్తి' },
    brief_facts: { english: 'Brief Facts', telugu: 'సంక్షిప్త వాస్తవాలు' },
    rough_sketch: { english: 'Rough Sketch Notes', telugu: 'రఫ్ స్కెచ్ నోట్స్' }
  };

  const L = (key) => labels[key]?.[language] || key;

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'english' ? 'telugu' : 'english');
    toast.info(`Switched to ${language === 'english' ? 'Telugu' : 'English'}`);
  };

  const addAccused = () => {
    setFormData(prev => ({
      ...prev,
      accused: [...prev.accused, { name: '', father: '', age: '', caste: '', occupation: '', address: '', phone: '' }]
    }));
  };

  const addWitness = () => {
    setFormData(prev => ({
      ...prev,
      witnesses: [...prev.witnesses, { name: '', father: '', age: '', caste: '', address: '', phone: '', role: '' }]
    }));
  };

  const updateAccused = (index, field, value) => {
    setFormData(prev => {
      const newAccused = [...prev.accused];
      newAccused[index] = { ...newAccused[index], [field]: value };
      return { ...prev, accused: newAccused };
    });
  };

  const updateWitness = (index, field, value) => {
    setFormData(prev => {
      const newWitnesses = [...prev.witnesses];
      newWitnesses[index] = { ...newWitnesses[index], [field]: value };
      return { ...prev, witnesses: newWitnesses };
    });
  };

  const saveCDF = async () => {
    if (!formData.fir_number || !formData.police_station) {
      toast.error('Please fill FIR Number and Police Station');
      return;
    }

    setIsSaving(true);
    try {
      const response = await api.post('/charge-sheet-fusion/cdf-form/save', {
        police_station: formData.police_station,
        district: formData.district,
        fir_number: formData.fir_number,
        cdf_data: JSON.stringify(formData)
      }, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        toast.success('CDF saved and synced to Charge Sheet!');
        toast.info(`Synced: ${response.data.chargesheet_sync?.column_13_witnesses || 0} witnesses to Col.13`);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save CDF');
    } finally {
      setIsSaving(false);
    }
  };

  const [correlationId, setCorrelationId] = useState(null);

  const printCDF = async () => {
    // Call backend API to generate CDF with coordinate overlay
    try {
      const response = await api.post('/cdf/generate', {
        district: formData.district || 'Narayanpet',
        police_station: formData.police_station || 'Makthal',
        year: formData.fir_date?.split('/')[2] || '2026',
        fir_number: formData.fir_number,
        fir_date: formData.fir_date,
        sections: formData.sections,
        scene_informant_name: formData.complainant_name,
        scene_informant_father: formData.complainant_father,
        scene_informant_address: formData.complainant_address,
        crime_heading: formData.modus_operandi?.split('\n')[0] || '',
        modus_operandi: formData.modus_operandi?.split('\n') || [],
        crime_purpose: formData.brief_facts?.substring(0, 100) || '',
        evidence_details: formData.property_recovered || '',
        property_details: formData.property_lost || '',
        scene_visit_date: formData.occurrence_date,
        scene_visit_time: formData.occurrence_time,
        scene_description: formData.brief_facts,
        witnesses: formData.witnesses.slice(0, 2).map(w => ({
          name: w.name,
          father: w.father,
          age: w.age,
          caste: w.caste,
          occupation: w.occupation || '',
          address: w.address,
          phone: w.phone
        }))
      });

      if (response.data.success) {
        setCorrelationId(response.data.correlation_id);
        
        // Open print window with the generated HTML
        const printWindow = window.open('', '_blank');
        printWindow.document.write(response.data.html_content);
        printWindow.document.close();
        printWindow.print();
        
        toast.success(`CDF generated! ID: ${response.data.correlation_id}`);
      }
    } catch (error) {
      console.error('Print error:', error);
      const errorId = error.response?.data?.detail || 'Print failed';
      toast.error(errorId);
    }
  };

  const printCDFLocal = () => {
    // Fallback: Generate coordinate overlay HTML for printing locally
    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;700&display=swap');
          @page { size: A4; margin: 0; }
          body { 
            font-family: ${language === 'telugu' ? '"Noto Sans Telugu", ' : ''}'Times New Roman', serif;
            margin: 0; padding: 20px; font-size: 12px;
          }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 6px; text-align: left; vertical-align: top; }
          th { background: #f0f0f0; font-weight: bold; }
          .header { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 15px; }
          .section { background: #e8e8e8; font-weight: bold; text-align: center; padding: 8px; }
          .dotted-field { border-bottom: 1px dotted #000; min-height: 20px; padding: 2px 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          ${language === 'telugu' ? 'క్రైమ్ డీటెయిల్స్ ఫారం (CDF)' : 'CRIME DETAILS FORM (CDF)'}
          <br/>
          <small>${language === 'telugu' ? 'తెలంగాణ పోలీస్' : 'Telangana Police'}</small>
        </div>
        
        <table>
          <tr>
            <th width="25%">${L('police_station')}</th>
            <td class="dotted-field">${formData.police_station}</td>
            <th width="25%">${L('district')}</th>
            <td class="dotted-field">${formData.district}</td>
          </tr>
          <tr>
            <th>${L('fir_number')}</th>
            <td class="dotted-field">${formData.fir_number}</td>
            <th>${L('fir_date')}</th>
            <td class="dotted-field">${formData.fir_date}</td>
          </tr>
          <tr>
            <th>${L('sections')}</th>
            <td colspan="3" class="dotted-field">${formData.sections}</td>
          </tr>
          <tr>
            <th>${L('gd_number')}</th>
            <td class="dotted-field">${formData.gd_number}</td>
            <th>${L('gd_time')}</th>
            <td class="dotted-field">${formData.gd_time}</td>
          </tr>
        </table>

        <table style="margin-top: 10px;">
          <tr class="section"><td colspan="4">${L('complainant')}</td></tr>
          <tr>
            <th>${L('name')}</th>
            <td class="dotted-field">${formData.complainant_name}</td>
            <th>${L('father')}</th>
            <td class="dotted-field">${formData.complainant_father}</td>
          </tr>
          <tr>
            <th>${L('age')}</th>
            <td class="dotted-field">${formData.complainant_age}</td>
            <th>${L('caste')}</th>
            <td class="dotted-field">${formData.complainant_caste}</td>
          </tr>
          <tr>
            <th>${L('occupation')}</th>
            <td class="dotted-field">${formData.complainant_occupation}</td>
            <th>${L('phone')}</th>
            <td class="dotted-field">${formData.complainant_phone}</td>
          </tr>
          <tr>
            <th>${L('address')}</th>
            <td colspan="3" class="dotted-field">${formData.complainant_address}</td>
          </tr>
        </table>

        <table style="margin-top: 10px;">
          <tr class="section"><td colspan="4">${L('accused')} (→ CS Column 11)</td></tr>
          ${formData.accused.map((a, i) => `
            <tr>
              <td colspan="4">
                <strong>A${i+1}.</strong> ${a.name} S/o ${a.father}, Age: ${a.age}, Caste: ${a.caste}, Occ: ${a.occupation}<br/>
                R/o: ${a.address}, Ph: ${a.phone}
              </td>
            </tr>
          `).join('')}
        </table>

        <table style="margin-top: 10px;">
          <tr class="section"><td colspan="4">${L('witnesses')} (→ CS Column 13)</td></tr>
          ${formData.witnesses.map((w, i) => `
            <tr>
              <td colspan="4">
                <strong>LW-${i+1}.</strong> ${w.name} S/o ${w.father}, Age: ${w.age}<br/>
                R/o: ${w.address}, Role: ${w.role}
              </td>
            </tr>
          `).join('')}
        </table>

        <table style="margin-top: 10px;">
          <tr class="section"><td>${L('modus_operandi')} (→ CS Column 16)</td></tr>
          <tr><td class="dotted-field" style="min-height: 80px;">${formData.modus_operandi}</td></tr>
        </table>

        <table style="margin-top: 10px;">
          <tr class="section"><td>${L('brief_facts')}</td></tr>
          <tr><td class="dotted-field" style="min-height: 150px;">${formData.brief_facts}</td></tr>
        </table>

        <table style="margin-top: 10px;">
          <tr>
            <th>${L('property_lost')}</th>
            <th>${L('property_recovered')}</th>
          </tr>
          <tr>
            <td class="dotted-field">${formData.property_lost}</td>
            <td class="dotted-field">${formData.property_recovered}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Layout>
      <div className="min-h-screen bg-[#030614] p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#00C2FF]/20 to-[#4F7EFF]/20 border border-[#00C2FF]/30">
                <FileText className="text-[#00C2FF]" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {language === 'telugu' ? 'క్రైమ్ డీటెయిల్స్ ఫారం' : 'Crime Details Form (CDF)'}
                </h1>
                <p className="text-white/60 text-sm">Digital CDF Filler with Bilingual Support</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={toggleLanguage}
                variant="outline" 
                className="border-[#FFB800]/50 text-[#FFB800]"
              >
                <Languages size={16} className="mr-2" />
                {language === 'english' ? 'తెలుగు' : 'English'}
              </Button>
              <Button onClick={saveCDF} disabled={isSaving} className="bg-[#00FFB3] text-black">
                <Save size={16} className="mr-2" />
                {isSaving ? 'Saving...' : 'Save & Sync'}
              </Button>
              <Button onClick={printCDF} className="bg-[#00C2FF]">
                <Printer size={16} className="mr-2" />
                Print CDF
              </Button>
            </div>
          </motion.div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Case Details */}
              <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                <h3 className="text-white font-semibold mb-4">{language === 'telugu' ? 'కేసు వివరాలు' : 'Case Details'}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('police_station')}</label>
                    <Input value={formData.police_station} onChange={(e) => setFormData({...formData, police_station: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('district')}</label>
                    <Input value={formData.district} onChange={(e) => setFormData({...formData, district: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('fir_number')}</label>
                    <Input value={formData.fir_number} onChange={(e) => setFormData({...formData, fir_number: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('sections')}</label>
                    <Input value={formData.sections} onChange={(e) => setFormData({...formData, sections: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('gd_number')}</label>
                    <Input value={formData.gd_number} onChange={(e) => setFormData({...formData, gd_number: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('gd_time')}</label>
                    <Input value={formData.gd_time} onChange={(e) => setFormData({...formData, gd_time: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                </div>
              </div>

              {/* Complainant */}
              <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                <h3 className="text-white font-semibold mb-4">{L('complainant')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('name')}</label>
                    <Input value={formData.complainant_name} onChange={(e) => setFormData({...formData, complainant_name: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('father')}</label>
                    <Input value={formData.complainant_father} onChange={(e) => setFormData({...formData, complainant_father: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('age')}</label>
                    <Input value={formData.complainant_age} onChange={(e) => setFormData({...formData, complainant_age: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('caste')}</label>
                    <Input value={formData.complainant_caste} onChange={(e) => setFormData({...formData, complainant_caste: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('phone')}</label>
                    <Input value={formData.complainant_phone} onChange={(e) => setFormData({...formData, complainant_phone: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('occupation')}</label>
                    <Input value={formData.complainant_occupation} onChange={(e) => setFormData({...formData, complainant_occupation: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-white/60 text-xs mb-1 block">{L('address')}</label>
                  <Textarea value={formData.complainant_address} onChange={(e) => setFormData({...formData, complainant_address: e.target.value})}
                    className="bg-[#030614] border-white/20 text-white" />
                </div>
              </div>

              {/* Brief Facts & Modus Operandi */}
              <div className="p-4 rounded-xl bg-[#0B0F1A] border border-[#4F7EFF]/30">
                <h3 className="text-white font-semibold mb-4">{L('brief_facts')}</h3>
                <Textarea value={formData.brief_facts} onChange={(e) => setFormData({...formData, brief_facts: e.target.value})}
                  className="bg-[#030614] border-white/20 text-white min-h-[100px]" />
                
                <h3 className="text-white font-semibold mb-4 mt-4 flex items-center gap-2">
                  {L('modus_operandi')}
                  <span className="text-[#00FFB3] text-xs">(→ CS Col.16)</span>
                </h3>
                <Textarea value={formData.modus_operandi} onChange={(e) => setFormData({...formData, modus_operandi: e.target.value})}
                  className="bg-[#030614] border-white/20 text-white min-h-[100px]" />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Accused */}
              <div className="p-4 rounded-xl bg-[#0B0F1A] border border-[#FF3B3B]/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">{L('accused')} <span className="text-[#FF3B3B] text-xs">(→ CS Col.11)</span></h3>
                  <Button onClick={addAccused} size="sm" variant="outline" className="border-[#FF3B3B]/50 text-[#FF3B3B]">+ Add</Button>
                </div>
                {formData.accused.map((acc, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-[#030614] border border-white/10 mb-2">
                    <p className="text-[#FF3B3B] text-xs font-bold mb-2">A{idx + 1}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder={L('name')} value={acc.name} onChange={(e) => updateAccused(idx, 'name', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                      <Input placeholder={L('father')} value={acc.father} onChange={(e) => updateAccused(idx, 'father', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                      <Input placeholder={L('age')} value={acc.age} onChange={(e) => updateAccused(idx, 'age', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                      <Input placeholder={L('caste')} value={acc.caste} onChange={(e) => updateAccused(idx, 'caste', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                    </div>
                    <Input placeholder={L('address')} value={acc.address} onChange={(e) => updateAccused(idx, 'address', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm mt-2" />
                  </div>
                ))}
              </div>

              {/* Witnesses */}
              <div className="p-4 rounded-xl bg-[#0B0F1A] border border-[#00FFB3]/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">{L('witnesses')} <span className="text-[#00FFB3] text-xs">(→ CS Col.13)</span></h3>
                  <Button onClick={addWitness} size="sm" variant="outline" className="border-[#00FFB3]/50 text-[#00FFB3]">+ Add</Button>
                </div>
                {formData.witnesses.map((wit, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-[#030614] border border-white/10 mb-2">
                    <p className="text-[#00FFB3] text-xs font-bold mb-2">LW-{idx + 1}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder={L('name')} value={wit.name} onChange={(e) => updateWitness(idx, 'name', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                      <Input placeholder={L('father')} value={wit.father} onChange={(e) => updateWitness(idx, 'father', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                      <Input placeholder={L('age')} value={wit.age} onChange={(e) => updateWitness(idx, 'age', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                      <Input placeholder="Role (e.g., Eyewitness)" value={wit.role} onChange={(e) => updateWitness(idx, 'role', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                    </div>
                    <Input placeholder={L('address')} value={wit.address} onChange={(e) => updateWitness(idx, 'address', e.target.value)} className="bg-[#0B0F1A] border-white/10 text-white text-sm mt-2" />
                  </div>
                ))}
              </div>

              {/* Property */}
              <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('property_lost')}</label>
                    <Textarea value={formData.property_lost} onChange={(e) => setFormData({...formData, property_lost: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1 block">{L('property_recovered')}</label>
                    <Textarea value={formData.property_recovered} onChange={(e) => setFormData({...formData, property_recovered: e.target.value})}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CDFFiller;
