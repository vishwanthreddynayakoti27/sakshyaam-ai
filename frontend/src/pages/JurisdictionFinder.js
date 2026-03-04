import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, FileText, Download, Search, Building2, Phone, Mail, Loader } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { api } from '../utils/api';
import jsPDF from 'jspdf';

const JurisdictionFinder = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [nearestStation, setNearestStation] = useState(null);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [allStations, setAllStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showZeroFIR, setShowZeroFIR] = useState(false);
  const [officerStation, setOfficerStation] = useState('');
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
  const stationMarkersRef = useRef([]);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const response = await api.get('/jurisdiction/stations');
        if (response.stations) {
          setAllStations(response.stations);
        }
      } catch (err) {
        console.error('Failed to load stations:', err);
      }
    };
    loadStations();
  }, []);

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
      try {
        const map = window.L.map(mapRef.current).setView([17.5, 78.5], 8);
        
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        if (allStations.length > 0) {
          addStationMarkers(map, allStations);
        }

        map.on('click', (e) => {
          onMapClick(e.latlng.lat, e.latlng.lng, map);
        });

        mapInstanceRef.current = map;
      } catch (err) {
        console.error('Map init error:', err);
      }
    };

    const onMapClick = async (lat, lng, map) => {
      setSelectedLocation({ lat, lng });
      setLoading(true);

      if (markerRef.current && map) {
        try {
          map.removeLayer(markerRef.current);
        } catch (e) {}
      }

      markerRef.current = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
          className: 'selected-marker',
          html: `<div style="background: #ff4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 10px rgba(255,68,68,0.5);"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).addTo(map);

      try {
        const response = await api.post('/jurisdiction/find', {
          latitude: lat,
          longitude: lng
        });

        if (response.nearest_station) {
          setNearestStation(response.nearest_station);
          setNearbyStations(response.all_nearby || []);
          toast.success(`Nearest: ${response.nearest_station.name} (${response.nearest_station.distance_km} km)`);
        }
      } catch (err) {
        toast.error('Failed to find jurisdiction');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && allStations.length > 0) {
      addStationMarkers(mapInstanceRef.current, allStations);
    }
  }, [allStations]);

  const addStationMarkers = (map, stations) => {
    stationMarkersRef.current.forEach(marker => {
      try { map.removeLayer(marker); } catch (e) {}
    });
    stationMarkersRef.current = [];

    stations.forEach(station => {
      const marker = window.L.marker([station.latitude, station.longitude], {
        icon: window.L.divIcon({
          className: 'station-marker',
          html: `<div style="background: #00f2ff; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #fff; opacity: 0.8;"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      }).addTo(map);
      
      marker.bindPopup(`<b>${station.name}</b><br>${station.district}<br>${station.phone || ''}`);
      stationMarkersRef.current.push(marker);
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a location to search');
      return;
    }

    const matchedStation = allStations.find(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.district.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matchedStation) {
      setNearestStation(matchedStation);
      setNearbyStations([matchedStation]);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([matchedStation.latitude, matchedStation.longitude], 14);
      }
      toast.success(`Found: ${matchedStation.name}`);
    } else {
      toast.warning('Station not found. Try clicking on the map.');
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
    doc.text('ZERO FIR TRANSFER LETTER', 105, 20, { align: 'center' });
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
    doc.text(nearestStation?.name || '[Jurisdictional Police Station]', 20, y);
    y += 6;
    doc.text(`District: ${nearestStation?.district || '[District]'}`, 20, y);
    y += 15;
    
    doc.text('Subject: Transfer of Zero FIR for Registration and Investigation', 20, y);
    y += 10;
    
    doc.text('Respected Sir/Madam,', 20, y);
    y += 10;
    
    const intro = `A complaint was received at this station from ${zeroFIRData.complainantName}, residing at ${zeroFIRData.complainantAddress || '[Address]'}, contact: ${zeroFIRData.complainantPhone || '[Phone]'}, regarding an incident that occurred within your jurisdiction.`;
    const introLines = doc.splitTextToSize(intro, 170);
    doc.text(introLines, 20, y);
    y += introLines.length * 6 + 5;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Incident Details:', 20, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Date of Incident: ${zeroFIRData.incidentDate || '[Date]'}`, 25, y);
    y += 6;
    doc.text(`Location: ${zeroFIRData.incidentLocation || '[Location - Within Your Jurisdiction]'}`, 25, y);
    y += 10;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Brief Facts:', 20, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    
    const factsLines = doc.splitTextToSize(zeroFIRData.briefFacts, 165);
    doc.text(factsLines, 25, y);
    y += factsLines.length * 6 + 10;
    
    const closing = 'The complaint is hereby forwarded for registration of FIR and investigation as per the provisions of BNSS. The complainant has been informed about this transfer.';
    const closingLines = doc.splitTextToSize(closing, 170);
    doc.text(closingLines, 20, y);
    y += closingLines.length * 6 + 15;
    
    doc.text('Station House Officer', 20, y);
    y += 6;
    doc.text(officerStation || '[Your Police Station]', 20, y);
    y += 6;
    doc.text(`Date: ${today}`, 20, y);
    
    doc.save('Zero_FIR_Transfer_Letter.pdf');
    toast.success('Zero FIR Transfer Letter generated!');
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
            Find police station jurisdiction using Haversine formula ({allStations.length} stations loaded)
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
                placeholder="Search station or district (e.g., Madhapur, Warangal)"
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
              Click anywhere on the map to find the nearest police station (Haversine distance)
            </p>

            {nearbyStations.length > 1 && (
              <div className="mt-4">
                <h3 className="text-white font-semibold mb-2">Nearby Stations:</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                  {nearbyStations.slice(1, 7).map((station, i) => (
                    <div key={i} className="p-2 bg-white/5 rounded border border-white/10 text-xs">
                      <p className="text-white/90 font-semibold truncate">{station.name}</p>
                      <p className="text-accent">{station.distance_km} km</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              {loading && <Loader size={16} className="animate-spin text-accent" />}
            </h2>

            {nearestStation ? (
              <div className="space-y-4" data-testid="station-details">
                <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                  <h3 className="text-white font-bold text-lg mb-2">{nearestStation.name}</h3>
                  <p className="text-accent font-semibold">{nearestStation.district} District</p>
                  {nearestStation.distance_km && (
                    <p className="text-success text-sm mt-1">Distance: {nearestStation.distance_km} km</p>
                  )}
                  
                  <div className="space-y-2 mt-3">
                    {nearestStation.phone && (
                      <div className="flex items-center gap-2 text-white/80 text-sm">
                        <Phone size={14} className="text-accent" />
                        <span>{nearestStation.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-white/60 text-xs">
                      <MapPin size={12} />
                      <span>Lat: {nearestStation.latitude?.toFixed(4)}, Lng: {nearestStation.longitude?.toFixed(4)}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setShowZeroFIR(!showZeroFIR)}
                  data-testid="zero-fir-toggle-btn"
                  className="w-full bg-success text-black font-bold hover:bg-success/80"
                >
                  <FileText size={18} className="mr-2" />
                  Generate Zero FIR Transfer Letter
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
              Zero FIR Transfer Letter Generator
            </h2>

            <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <p className="text-warning text-sm">
                This generates a Zero FIR transfer letter when the incident occurred in a different jurisdiction.
                The FIR will be registered at your station and transferred to the jurisdictional station for investigation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Your Police Station Name"
                value={officerStation}
                onChange={(e) => setOfficerStation(e.target.value)}
                className="bg-white/5 border-white/20 text-white"
              />
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
                className="bg-white/5 border-white/20 text-white"
              />
              <Input
                placeholder="Incident Date"
                value={zeroFIRData.incidentDate}
                onChange={(e) => setZeroFIRData(prev => ({ ...prev, incidentDate: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
              />
              <Input
                placeholder="Incident Location (in jurisdictional area)"
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
              Download Zero FIR Transfer Letter PDF
            </Button>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default JurisdictionFinder;
