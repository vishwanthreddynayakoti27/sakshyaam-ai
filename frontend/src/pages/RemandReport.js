import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Shield, 
  AlertTriangle, 
  Printer, 
  Download, 
  Edit3,
  Save,
  Users,
  Scale,
  CheckCircle2
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import api from '../utils/api';

const RemandReport = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [remandHtml, setRemandHtml] = useState('');
  const [isEditing, setIsEditing] = useState(true);
  
  // Form fields
  const [formData, setFormData] = useState({
    police_station: '',
    district: '',
    fir_number: '',
    fir_date: '',
    sections: '',
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
    witnesses: [{ name: '', father: '', age: '', address: '', role: '' }],
    property_lost: '',
    property_recovered: '',
    brief_facts: '',
    grounds_of_arrest: [
      'If released on bail, the accused may abscond from the jurisdiction.',
      'If released on bail, the accused may tamper with witnesses and evidence.',
      'There is likelihood that the accused persons may commit the same offence if released.',
      'If released on bail, the accused may create law & order problems in the locality.',
      'The accused did not respond to the 41-A BNSS notice served upon them.'
    ],
    io_name: '',
    io_rank: 'Sub Inspector of Police'
  });

  const addAccused = () => {
    setFormData(prev => ({
      ...prev,
      accused: [...prev.accused, { name: '', father: '', age: '', caste: '', occupation: '', address: '', phone: '' }]
    }));
  };

  const addWitness = () => {
    setFormData(prev => ({
      ...prev,
      witnesses: [...prev.witnesses, { name: '', father: '', age: '', address: '', role: '' }]
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

  const generateRemandReport = async () => {
    if (!formData.fir_number || !formData.police_station) {
      toast.error('Please fill FIR Number and Police Station');
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        police_station: formData.police_station,
        district: formData.district,
        fir_number: formData.fir_number,
        sections: formData.sections,
        data: JSON.stringify({
          complainant: {
            name: formData.complainant_name,
            father_name: formData.complainant_father,
            age: formData.complainant_age,
            caste: formData.complainant_caste,
            occupation: formData.complainant_occupation,
            address: formData.complainant_address,
            phone: formData.complainant_phone
          },
          accused_persons: formData.accused.map((a, i) => ({
            serial: `A${i + 1}`,
            ...a
          })),
          witnesses: formData.witnesses.map((w, i) => ({
            serial: `LW-${i + 1}`,
            ...w
          })),
          offense_details: {
            date: formData.occurrence_date,
            time: formData.occurrence_time,
            place: formData.occurrence_place
          },
          property_lost: formData.property_lost,
          property_recovered: formData.property_recovered,
          brief_facts: formData.brief_facts,
          grounds_of_arrest: formData.grounds_of_arrest
        })
      };

      const response = await api.post('/charge-sheet-fusion/generate-remand', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setRemandHtml(response.data.remand_cd_html);
        toast.success('Remand Case Diary generated successfully!');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate. Check console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(remandHtml);
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#FF3B3B]/20 to-[#FF6B6B]/20 border border-[#FF3B3B]/30">
                <Shield className="text-[#FF3B3B]" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Remand Case Diary</h1>
                <p className="text-white/60 text-sm">Generate Remand Report (u/s 236 BNSS)</p>
              </div>
            </div>
            <div className="flex gap-2">
              {remandHtml && (
                <>
                  <Button onClick={printReport} className="bg-[#00C2FF]">
                    <Printer size={16} className="mr-2" /> Print
                  </Button>
                  <Button onClick={() => setRemandHtml('')} variant="outline" className="border-white/20 text-white">
                    New Report
                  </Button>
                </>
              )}
            </div>
          </motion.div>

          {!remandHtml ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Form Inputs */}
              <div className="space-y-4">
                {/* Case Details */}
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <FileText className="text-[#00C2FF]" size={18} />
                    Case Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Police Station"
                      value={formData.police_station}
                      onChange={(e) => setFormData({ ...formData, police_station: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white"
                    />
                    <Input
                      placeholder="District"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white"
                    />
                    <Input
                      placeholder="FIR Number"
                      value={formData.fir_number}
                      onChange={(e) => setFormData({ ...formData, fir_number: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white"
                    />
                    <Input
                      placeholder="Sections of Law"
                      value={formData.sections}
                      onChange={(e) => setFormData({ ...formData, sections: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white"
                    />
                  </div>
                </div>

                {/* Occurrence Details */}
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                  <h3 className="text-white font-semibold mb-4">Occurrence Details</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      placeholder="Date (DD-MM-YYYY)"
                      value={formData.occurrence_date}
                      onChange={(e) => setFormData({ ...formData, occurrence_date: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white"
                    />
                    <Input
                      placeholder="Time"
                      value={formData.occurrence_time}
                      onChange={(e) => setFormData({ ...formData, occurrence_time: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white"
                    />
                    <Input
                      placeholder="Place"
                      value={formData.occurrence_place}
                      onChange={(e) => setFormData({ ...formData, occurrence_place: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white"
                    />
                  </div>
                </div>

                {/* Complainant */}
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                  <h3 className="text-white font-semibold mb-4">Complainant Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Name" value={formData.complainant_name}
                      onChange={(e) => setFormData({ ...formData, complainant_name: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white" />
                    <Input placeholder="S/o / W/o" value={formData.complainant_father}
                      onChange={(e) => setFormData({ ...formData, complainant_father: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white" />
                    <Input placeholder="Age" value={formData.complainant_age}
                      onChange={(e) => setFormData({ ...formData, complainant_age: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white" />
                    <Input placeholder="Caste" value={formData.complainant_caste}
                      onChange={(e) => setFormData({ ...formData, complainant_caste: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white" />
                    <Input placeholder="Occupation" value={formData.complainant_occupation}
                      onChange={(e) => setFormData({ ...formData, complainant_occupation: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white" />
                    <Input placeholder="Phone" value={formData.complainant_phone}
                      onChange={(e) => setFormData({ ...formData, complainant_phone: e.target.value })}
                      className="bg-[#030614] border-white/20 text-white" />
                  </div>
                  <Input placeholder="Address" value={formData.complainant_address}
                    onChange={(e) => setFormData({ ...formData, complainant_address: e.target.value })}
                    className="bg-[#030614] border-white/20 text-white mt-3" />
                </div>

                {/* Brief Facts */}
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
                  <h3 className="text-white font-semibold mb-4">Brief Facts of the Case</h3>
                  <Textarea
                    placeholder="Enter the brief facts of the case..."
                    value={formData.brief_facts}
                    onChange={(e) => setFormData({ ...formData, brief_facts: e.target.value })}
                    className="bg-[#030614] border-white/20 text-white min-h-[120px]"
                  />
                </div>
              </div>

              {/* Right: Accused, Witnesses, Grounds */}
              <div className="space-y-4">
                {/* Accused Persons */}
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-[#FF3B3B]/30">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <AlertTriangle className="text-[#FF3B3B]" size={18} />
                      Accused Persons (Arrested)
                    </h3>
                    <Button onClick={addAccused} size="sm" variant="outline" className="border-[#FF3B3B]/50 text-[#FF3B3B]">
                      + Add Accused
                    </Button>
                  </div>
                  {formData.accused.map((acc, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#030614] border border-white/10 mb-2">
                      <p className="text-[#FF3B3B] text-xs font-bold mb-2">A{idx + 1}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Name" value={acc.name} onChange={(e) => updateAccused(idx, 'name', e.target.value)}
                          className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                        <Input placeholder="S/o" value={acc.father} onChange={(e) => updateAccused(idx, 'father', e.target.value)}
                          className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                        <Input placeholder="Age" value={acc.age} onChange={(e) => updateAccused(idx, 'age', e.target.value)}
                          className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                        <Input placeholder="Caste" value={acc.caste} onChange={(e) => updateAccused(idx, 'caste', e.target.value)}
                          className="bg-[#0B0F1A] border-white/10 text-white text-sm" />
                      </div>
                      <Input placeholder="Address" value={acc.address} onChange={(e) => updateAccused(idx, 'address', e.target.value)}
                        className="bg-[#0B0F1A] border-white/10 text-white text-sm mt-2" />
                    </div>
                  ))}
                </div>

                {/* Grounds of Arrest */}
                <div className="p-4 rounded-xl bg-[#0B0F1A] border border-[#FFB800]/30">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Scale className="text-[#FFB800]" size={18} />
                    Grounds for Arrest (Prayer for Remand)
                  </h3>
                  {formData.grounds_of_arrest.map((ground, idx) => (
                    <div key={idx} className="flex items-start gap-2 mb-2">
                      <span className="text-[#FFB800] text-sm">{idx + 1}.</span>
                      <Textarea
                        value={ground}
                        onChange={(e) => {
                          const newGrounds = [...formData.grounds_of_arrest];
                          newGrounds[idx] = e.target.value;
                          setFormData({ ...formData, grounds_of_arrest: newGrounds });
                        }}
                        className="bg-[#030614] border-white/10 text-white text-sm min-h-[60px]"
                      />
                    </div>
                  ))}
                  <Button 
                    onClick={() => setFormData({ ...formData, grounds_of_arrest: [...formData.grounds_of_arrest, ''] })}
                    size="sm" variant="outline" className="border-[#FFB800]/50 text-[#FFB800] mt-2"
                  >
                    + Add Ground
                  </Button>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={generateRemandReport}
                  disabled={isGenerating}
                  className="w-full bg-gradient-to-r from-[#FF3B3B] to-[#FF6B6B] text-white py-6 text-lg"
                >
                  {isGenerating ? 'Generating...' : 'Generate Remand Report'}
                </Button>
              </div>
            </div>
          ) : (
            /* Rendered Remand Report */
            <div className="p-4 rounded-xl bg-white">
              <div 
                dangerouslySetInnerHTML={{ __html: remandHtml }}
                className="min-h-[600px]"
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RemandReport;
