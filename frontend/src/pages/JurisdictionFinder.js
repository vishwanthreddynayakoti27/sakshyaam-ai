import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, FileText, Download, Search, Building2, Phone, Mail } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const SAMPLE_STATIONS = [
  {
    id: 1,
    name: 'Cyberabad PS - Gachibowli',
    address: 'Gachibowli, Hyderabad, Telangana 500032',
    phone: '040-2785-5500',
    email: 'sho-gachibowli@tspolice.gov.in',
    lat: 17.4401,
    lng: 78.3489,
    jurisdiction: ['Gachibowli', 'Nanakramguda', 'Financial District', 'DLF Cyber City']
  },
  {
    id: 2,
    name: 'Madhapur PS',
    address: 'Madhapur, Hyderabad, Telangana 500081',
    phone: '040-2311-2345',
    email: 'sho-madhapur@tspolice.gov.in',
    lat: 17.4486,
    lng: 78.3908,
    jurisdiction: ['Madhapur', 'HITEC City', 'Kondapur', 'Kavuri Hills']
  },
  {
    id: 3,
    name: 'Banjara Hills PS',
    address: 'Road No. 12, Banjara Hills, Hyderabad 500034',
    phone: '040-2339-8765',
    email: 'sho-banjarahills@tspolice.gov.in',
    lat: 17.4156,
    lng: 78.4347,
    jurisdiction: ['Banjara Hills', 'Jubilee Hills', 'Film Nagar', 'Yousufguda']
  },
  {
    id: 4,
    name: 'Begumpet PS',
    address: 'Begumpet, Hyderabad, Telangana 500016',
    phone: '040-2776-5432',
    email: 'sho-begumpet@tspolice.gov.in',
    lat: 17.4432,
    lng: 78.4675,
    jurisdiction: ['Begumpet', 'Somajiguda', 'Raj Bhavan Road', 'Greenlands']
  },
  {
    id: 5,
    name: 'Kukatpally PS',
    address: 'KPHB Colony, Kukatpally, Hyderabad 500072',
    phone: '040-2305-6789',
    email: 'sho-kukatpally@tspolice.gov.in',
    lat: 17.4849,
    lng: 78.4138,
    jurisdiction: ['Kukatpally', 'KPHB', 'Moosapet', 'Allwyn Colony']
  }
];

const JurisdictionFinder = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [nearestStation, setNearestStation] = useState(null);
  const [showZeroFIR, setShowZeroFIR] = useState(false);
  const [zeroFIRData, setZeroFIRData] = useState({
    complainantName: '',
    complainantAddress: '',
    complainantPhone: '',
    incidentDate: '',
    incidentLocation: '',
    briefFacts: ''
  });
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const loadLeaflet = async () => {
      if (typeof window !== 'undefined' && !window.L) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => initMap();
        document.head.appendChild(script);
      } else if (window.L) {
        initMap();
      }
    };

    const initMap = () => {
      const map = window.L.map(mapRef.current).setView([17.4401, 78.4000], 12);
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      SAMPLE_STATIONS.forEach(station => {
        const marker = window.L.marker([station.lat, station.lng], {
          icon: window.L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: #00f2ff; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(map);
        
        marker.bindPopup(`<b>${station.name}</b><br>${station.address}`);
      });

      map.on('click', (e) => {
        handleMapClick(e.latlng.lat, e.latlng.lng, map);
      });

      mapInstanceRef.current = map;
    };

    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleMapClick = (lat, lng, map) => {
    setSelectedLocation({ lat, lng });

    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }

    markerRef.current = window.L.marker([lat, lng], {
      icon: window.L.divIcon({
        className: 'selected-marker',
        html: `<div style="background: #ff4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 10px rgba(255,68,68,0.5);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(map);

    findNearestStation(lat, lng);
  };

  const findNearestStation = (lat, lng) => {
    let nearest = null;
    let minDistance = Infinity;

    SAMPLE_STATIONS.forEach(station => {
      const distance = Math.sqrt(
        Math.pow(station.lat - lat, 2) + Math.pow(station.lng - lng, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = station;
      }
    });

    setNearestStation(nearest);
    toast.success(`Nearest station: ${nearest?.name}`);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a location to search');
      return;
    }

    const matchedStation = SAMPLE_STATIONS.find(s => 
      s.jurisdiction.some(j => j.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matchedStation) {
      setNearestStation(matchedStation);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([matchedStation.lat, matchedStation.lng], 14);
      }
      toast.success(`Found: ${matchedStation.name}`);
    } else {
      toast.warning('Location not found in database. Try clicking on the map.');
    }
  };

  const generateZeroFIRLetter = () => {
    if (!zeroFIRData.complainantName || !zeroFIRData.briefFacts) {
      toast.error('Please fill complainant name and brief facts');
      return;
    }

    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('en-IN');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ZERO FIR APPLICATION', 105, 20, { align: 'center' });
    doc.text('(Under Section 173 BNSS)', 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let y = 45;
    doc.text(`Date: ${today}`, 20, y);
    y += 10;
    
    doc.text('To,', 20, y);
    y += 6;
    doc.text('The Station House Officer', 20, y);
    y += 6;
    doc.text(nearestStation?.name || '[Police Station Name]', 20, y);
    y += 6;
    doc.text(nearestStation?.address || '[Address]', 20, y);
    y += 15;
    
    doc.text('Subject: Request for Registration of Zero FIR', 20, y);
    y += 10;
    
    doc.text('Respected Sir/Madam,', 20, y);
    y += 10;
    
    const intro = `I, ${zeroFIRData.complainantName}, residing at ${zeroFIRData.complainantAddress || '[Address]'}, contact number ${zeroFIRData.complainantPhone || '[Phone]'}, hereby request the registration of a Zero FIR for the following incident:`;
    const introLines = doc.splitTextToSize(intro, 170);
    doc.text(introLines, 20, y);
    y += introLines.length * 6 + 5;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Incident Details:', 20, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Date of Incident: ${zeroFIRData.incidentDate || '[Date]'}`, 25, y);
    y += 6;
    doc.text(`Location: ${zeroFIRData.incidentLocation || '[Location]'}`, 25, y);
    y += 10;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Brief Facts:', 20, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    
    const factsLines = doc.splitTextToSize(zeroFIRData.briefFacts, 165);
    doc.text(factsLines, 25, y);
    y += factsLines.length * 6 + 10;
    
    const closing = 'I understand that this Zero FIR will be transferred to the jurisdictional police station for further investigation. I request you to kindly register the same and take necessary action.';
    const closingLines = doc.splitTextToSize(closing, 170);
    doc.text(closingLines, 20, y);
    y += closingLines.length * 6 + 15;
    
    doc.text('Thanking you,', 20, y);
    y += 10;
    doc.text('Yours faithfully,', 20, y);
    y += 15;
    doc.text(`${zeroFIRData.complainantName}`, 20, y);
    y += 6;
    doc.text(`Contact: ${zeroFIRData.complainantPhone || '[Phone]'}`, 20, y);
    
    doc.save('Zero_FIR_Application.pdf');
    toast.success('Zero FIR application generated!');
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="jurisdiction-finder-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              Jurisdiction Finder
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            Find police station jurisdiction and generate Zero FIR applications
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <div className="flex gap-4 mb-4">
              <Input
                placeholder="Search location (e.g., Madhapur, HITEC City)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-white/5 border-white/20 text-white"
                data-testid="location-search-input"
              />
              <Button
                onClick={handleSearch}
                data-testid="search-btn"
                className="bg-accent text-black font-bold hover:bg-accent/80"
              >
                <Search size={18} />
              </Button>
            </div>

            <div
              ref={mapRef}
              data-testid="jurisdiction-map"
              className="h-[400px] rounded-lg overflow-hidden border border-white/20"
              style={{ background: '#1a1a2e' }}
            />

            <p className="text-white/50 text-sm mt-3 text-center">
              Click on the map to drop a pin and find the nearest police station
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
              <Building2 size={20} className="text-accent" />
              Nearest Station
            </h2>

            {nearestStation ? (
              <div className="space-y-4" data-testid="station-details">
                <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                  <h3 className="text-white font-bold text-lg mb-2">{nearestStation.name}</h3>
                  <p className="text-white/70 text-sm mb-3">{nearestStation.address}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <Phone size={14} className="text-accent" />
                      <span>{nearestStation.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <Mail size={14} className="text-accent" />
                      <span className="truncate">{nearestStation.email}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-white/60 text-sm mb-2">Jurisdiction Areas:</p>
                  <div className="flex flex-wrap gap-2">
                    {nearestStation.jurisdiction.map((area, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-white/10 border border-white/20 rounded text-white/80 text-xs"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => setShowZeroFIR(!showZeroFIR)}
                  data-testid="zero-fir-toggle-btn"
                  className="w-full bg-success text-black font-bold hover:bg-success/80"
                >
                  <FileText size={18} className="mr-2" />
                  Generate Zero FIR Application
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-white/40">
                <div className="text-center">
                  <Navigation size={40} className="mx-auto mb-3 opacity-20" />
                  <p>Click on the map or search</p>
                  <p className="text-sm mt-1">to find jurisdiction</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {showZeroFIR && nearestStation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-success" />
              Zero FIR Application Generator
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Complainant Name *"
                value={zeroFIRData.complainantName}
                onChange={(e) => setZeroFIRData(prev => ({ ...prev, complainantName: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
                data-testid="complainant-name-input"
              />
              <Input
                placeholder="Contact Phone"
                value={zeroFIRData.complainantPhone}
                onChange={(e) => setZeroFIRData(prev => ({ ...prev, complainantPhone: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
              />
              <Input
                placeholder="Complainant Address"
                value={zeroFIRData.complainantAddress}
                onChange={(e) => setZeroFIRData(prev => ({ ...prev, complainantAddress: e.target.value }))}
                className="bg-white/5 border-white/20 text-white md:col-span-2"
              />
              <Input
                placeholder="Incident Date"
                value={zeroFIRData.incidentDate}
                onChange={(e) => setZeroFIRData(prev => ({ ...prev, incidentDate: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
              />
              <Input
                placeholder="Incident Location"
                value={zeroFIRData.incidentLocation}
                onChange={(e) => setZeroFIRData(prev => ({ ...prev, incidentLocation: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
              />
              <Textarea
                placeholder="Brief Facts of the Incident *"
                value={zeroFIRData.briefFacts}
                onChange={(e) => setZeroFIRData(prev => ({ ...prev, briefFacts: e.target.value }))}
                className="bg-white/5 border-white/20 text-white md:col-span-2 min-h-[120px]"
                data-testid="brief-facts-textarea"
              />
            </div>

            <Button
              onClick={generateZeroFIRLetter}
              data-testid="generate-zero-fir-btn"
              className="mt-4 bg-success text-black font-bold hover:bg-success/80"
            >
              <Download size={18} className="mr-2" />
              Download Zero FIR Application PDF
            </Button>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default JurisdictionFinder;
