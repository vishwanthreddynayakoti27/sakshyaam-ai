import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Upload, Search, Filter, BarChart3, MapPin, Clock, Users, Hash, Smartphone, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { api } from '../utils/api';

const CDRAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [caseId, setCaseId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [nameSearchTerm, setNameSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [columnsDetected, setColumnsDetected] = useState([]);
  const [recordsCount, setRecordsCount] = useState(0);
  const [searchResults, setSearchResults] = useState(null);
  const [imeiLinkage, setImeiLinkage] = useState(null);
  const [locationMap, setLocationMap] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showImeiSection, setShowImeiSection] = useState(true);
  const [showLocationSection, setShowLocationSection] = useState(true);
  const [locationFilter, setLocationFilter] = useState({ phone: '', imei: '' });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setAnalysis(null);
      }
    }
  });

  const handleUpload = async () => {
    if (!file || !caseId) {
      toast.error('Please provide both file and case ID');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('case_id', caseId);
      
      const response = await api.post('/cdr/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const data = response.data || response;
      
      if (data.analysis) {
        setAnalysis(data.analysis);
        setColumnsDetected(data.columns_detected || []);
        setRecordsCount(data.records_processed || 0);
        toast.success(`CDR parsed! ${data.records_processed} records analyzed`);
        // Auto-load IMEI linkage + location map for this case
        loadAdvancedAnalytics(caseId);
      } else {
        toast.info(data.message || 'CDR uploaded');
      }
    } catch (err) {
      console.error('CDR upload error:', err);
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const filterByMostCalled = () => {
    if (analysis?.most_called_numbers) {
      toast.info(`Top callers: ${analysis.most_called_numbers.slice(0, 3).map(([num, count]) => `${num} (${count} calls)`).join(', ')}`);
    }
  };

  const filterByDuplicates = () => {
    if (analysis?.duplicate_numbers) {
      toast.info(`Duplicates found: ${analysis.duplicate_numbers.length} numbers appear 3+ times`);
    }
  };

  // Search by phone number
  const handleNumberSearch = () => {
    if (!analysis?.records || !searchTerm.trim()) {
      toast.info('Enter a phone number to search');
      return;
    }
    
    const matches = analysis.records?.filter(r => 
      r.phone_number?.includes(searchTerm) || 
      r.called_number?.includes(searchTerm) ||
      r.calling_number?.includes(searchTerm)
    ) || [];
    
    if (matches.length > 0) {
      setSearchResults({ type: 'number', term: searchTerm, results: matches });
      toast.success(`Found ${matches.length} records for number: ${searchTerm}`);
    } else {
      setSearchResults(null);
      toast.info(`No records found for number: ${searchTerm}`);
    }
  };

  // Search by name
  const handleNameSearch = () => {
    if (!analysis?.records || !nameSearchTerm.trim()) {
      toast.info('Enter a name to search');
      return;
    }
    
    const searchLower = nameSearchTerm.toLowerCase();
    const matches = analysis.records?.filter(r => 
      r.subscriber_name?.toLowerCase().includes(searchLower) ||
      r.contact_name?.toLowerCase().includes(searchLower) ||
      r.name?.toLowerCase().includes(searchLower) ||
      r.party_name?.toLowerCase().includes(searchLower) ||
      r.caller_name?.toLowerCase().includes(searchLower)
    ) || [];
    
    if (matches.length > 0) {
      setSearchResults({ type: 'name', term: nameSearchTerm, results: matches });
      toast.success(`Found ${matches.length} records for name: ${nameSearchTerm}`);
    } else {
      setSearchResults(null);
      toast.info(`No records found for name: ${nameSearchTerm}`);
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
    setSearchTerm('');
    setNameSearchTerm('');
  };

  const loadAdvancedAnalytics = async (cid) => {
    if (!cid) return;
    setAnalyticsLoading(true);
    try {
      const [linkRes, locRes] = await Promise.all([
        api.get(`/cdr/imei-linkage/${cid}`),
        api.get(`/cdr/location-map/${cid}`),
      ]);
      setImeiLinkage(linkRes.data || linkRes);
      setLocationMap(locRes.data || locRes);
    } catch (err) {
      console.error('Advanced analytics failed:', err);
      toast.error('Failed to load IMEI / location analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const refreshLocationMap = async () => {
    if (!caseId) return;
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationFilter.phone) params.append('phone', locationFilter.phone);
      if (locationFilter.imei) params.append('imei', locationFilter.imei);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/cdr/location-map/${caseId}${qs}`);
      setLocationMap(res.data || res);
      toast.success('Location map refreshed');
    } catch (err) {
      toast.error('Filter failed');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="cdr-analyzer-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-heading font-bold text-white text-glow mb-3" data-testid="page-title">
            CDR Analyzer
          </h1>
          <p className="text-white/60 text-lg">
            Parse and analyze call detail records with dynamic column detection
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4" data-testid="upload-section-title">Upload CDR File</h2>

            <div className="mb-4">
              <label className="text-white/90 mb-2 block text-sm">Case ID / FIR Number</label>
              <Input
                data-testid="case-id-input"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder="Enter case ID or FIR number"
                className="bg-black/20 border-white/10 focus:border-accent text-white"
              />
            </div>

            <div
              {...getRootProps()}
              data-testid="cdr-dropzone"
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all mb-4 ${
                isDragActive
                  ? 'border-accent bg-accent/10'
                  : 'border-white/20 hover:border-accent/50 bg-white/5 hover:bg-white/10'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
                  <Phone className="text-accent" size={32} />
                </div>
                {file ? (
                  <div>
                    <p className="text-white font-semibold mb-1" data-testid="uploaded-cdr-filename">{file.name}</p>
                    <p className="text-white/60 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-white font-semibold mb-1">
                      {isDragActive ? 'Drop CDR file here' : 'Drag & drop CDR file or click to upload'}
                    </p>
                    <p className="text-white/60 text-sm">Supports: CSV, XLS, XLSX (any telecom format)</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg mb-4">
              <p className="text-accent text-sm mb-2 font-semibold">Dynamic Column Detection:</p>
              <p className="text-white/70 text-xs">
                System auto-detects columns: Phone numbers (MSISDN, Caller, A_Number), DateTime, Duration, IMEI, Tower ID, Location
              </p>
            </div>

            <Button
              data-testid="upload-cdr-button"
              onClick={handleUpload}
              disabled={!file || !caseId || uploading}
              className="w-full bg-accent text-black font-bold hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)] rounded-sm uppercase tracking-wider py-6"
            >
              {uploading ? 'Processing...' : 'Upload & Parse CDR'}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4">Quick Analysis</h2>

            <div className="space-y-4">
              <div>
                <label className="text-white/90 mb-2 block text-sm">Search by Number</label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input
                      data-testid="cdr-search-input"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleNumberSearch()}
                      placeholder="Phone number"
                      className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                    />
                  </div>
                  <Button
                    onClick={handleNumberSearch}
                    disabled={!analysis}
                    size="sm"
                    className="bg-accent text-black hover:bg-accent/80"
                  >
                    Search
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-white/90 mb-2 block text-sm">Search by Name</label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input
                      data-testid="cdr-name-search-input"
                      value={nameSearchTerm}
                      onChange={(e) => setNameSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleNameSearch()}
                      placeholder="Subscriber/Contact name"
                      className="bg-black/20 border-white/10 focus:border-accent text-white pl-10"
                    />
                  </div>
                  <Button
                    onClick={handleNameSearch}
                    disabled={!analysis}
                    size="sm"
                    className="bg-accent text-black hover:bg-accent/80"
                  >
                    Search
                  </Button>
                </div>
              </div>

              {searchResults && (
                <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-accent text-sm font-semibold">
                      {searchResults.type === 'name' ? 'Name' : 'Number'} Search: "{searchResults.term}"
                    </span>
                    <button onClick={clearSearch} className="text-white/60 hover:text-white text-xs">
                      Clear
                    </button>
                  </div>
                  <p className="text-white text-sm">{searchResults.results.length} matching records found</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-white/90 text-sm mb-2">Quick Filters</p>
                <button
                  data-testid="filter-most-called"
                  onClick={filterByMostCalled}
                  disabled={!analysis}
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm disabled:opacity-50"
                >
                  <Users size={14} className="inline mr-2" />
                  Most Called Numbers
                </button>
                <button
                  data-testid="filter-duplicates"
                  onClick={filterByDuplicates}
                  disabled={!analysis}
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm disabled:opacity-50"
                >
                  <Hash size={14} className="inline mr-2" />
                  Duplicate Numbers
                </button>
                <button
                  data-testid="filter-common-locations"
                  disabled={!analysis}
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm disabled:opacity-50"
                >
                  <MapPin size={14} className="inline mr-2" />
                  Common Locations
                </button>
                <button
                  data-testid="filter-date-range"
                  disabled={!analysis}
                  className="w-full text-left px-4 py-2 bg-black/20 border border-white/10 rounded-md text-white/80 hover:bg-white/5 hover:border-accent/50 transition-all text-sm disabled:opacity-50"
                >
                  <Clock size={14} className="inline mr-2" />
                  Date Range
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="glassmorphism rounded-xl p-4 border border-accent/30">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 size={20} className="text-accent" />
                <span className="text-white/60 text-sm">Total Records</span>
              </div>
              <p className="text-2xl font-bold text-white">{analysis.total_records || recordsCount}</p>
            </div>

            <div className="glassmorphism rounded-xl p-4 border border-success/30">
              <div className="flex items-center gap-3 mb-2">
                <Hash size={20} className="text-success" />
                <span className="text-white/60 text-sm">Columns Detected</span>
              </div>
              <p className="text-2xl font-bold text-white">{columnsDetected.length}</p>
              <p className="text-xs text-white/50 mt-1">{columnsDetected.join(', ')}</p>
            </div>

            <div className="glassmorphism rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center gap-3 mb-2">
                <Clock size={20} className="text-purple-400" />
                <span className="text-white/60 text-sm">Date Range</span>
              </div>
              {analysis.date_range?.start ? (
                <div>
                  <p className="text-sm text-white">{analysis.date_range.start}</p>
                  <p className="text-xs text-white/50">to {analysis.date_range.end}</p>
                </div>
              ) : (
                <p className="text-white/50 text-sm">No dates found</p>
              )}
            </div>

            <div className="glassmorphism rounded-xl p-4 border border-warning/30">
              <div className="flex items-center gap-3 mb-2">
                <Users size={20} className="text-warning" />
                <span className="text-white/60 text-sm">Frequent Numbers</span>
              </div>
              <p className="text-2xl font-bold text-white">{analysis.duplicate_numbers?.length || 0}</p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 glassmorphism rounded-xl p-6 border border-white/10"
        >
          <h3 className="text-xl font-heading font-bold text-white mb-4">Analysis Results</h3>
          
          {analysis ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Users size={16} className="text-accent" />
                  Most Called Numbers
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {analysis.most_called_numbers?.slice(0, 10).map(([number, count], i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                      <span className="text-white font-mono text-sm">{number}</span>
                      <span className="text-accent font-bold">{count} calls</span>
                    </div>
                  ))}
                  {(!analysis.most_called_numbers || analysis.most_called_numbers.length === 0) && (
                    <p className="text-white/50 text-sm">No data available</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-success" />
                  Common Locations
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {analysis.common_locations?.slice(0, 10).map(([location, count], i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                      <span className="text-white text-sm">{location}</span>
                      <span className="text-success font-bold">{count} calls</span>
                    </div>
                  ))}
                  {(!analysis.common_locations || analysis.common_locations.length === 0) && (
                    <p className="text-white/50 text-sm">No location data</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-white/40">
              <div className="text-center">
                <Phone size={48} className="mx-auto mb-4 opacity-20" />
                <p>Upload a CDR file to see analysis results</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* IMEI Identity Linkage */}
        {(imeiLinkage || analyticsLoading) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 glassmorphism rounded-xl p-6 border border-white/10"
            data-testid="imei-linkage-section"
          >
            <button
              onClick={() => setShowImeiSection(!showImeiSection)}
              className="w-full flex items-center justify-between mb-4"
              data-testid="toggle-imei-section"
            >
              <h3 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                <Smartphone size={20} className="text-accent" />
                IMEI Identity Linkage
                {imeiLinkage?.high_risk_devices > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF4655]/15 text-[#FF4655] border border-[#FF4655]/30">
                    <AlertTriangle size={10} /> {imeiLinkage.high_risk_devices} HIGH-risk
                  </span>
                )}
              </h3>
              {showImeiSection ? <ChevronUp size={18} className="text-white/50" /> : <ChevronDown size={18} className="text-white/50" />}
            </button>

            {showImeiSection && (
              <>
                <p className="text-white/50 text-xs mb-4">
                  Detects SIM-swapping: a single IMEI used with multiple phone numbers (3+ SIMs ⇒ HIGH suspicion).
                </p>
                {analyticsLoading && !imeiLinkage && (
                  <p className="text-white/40 text-sm">Analyzing devices…</p>
                )}
                {imeiLinkage?.linkages?.length === 0 && (
                  <p className="text-white/50 text-sm">No IMEI data found in this CDR. Upload data with an IMEI column to enable device linkage.</p>
                )}
                {imeiLinkage?.linkages?.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="imei-linkage-list">
                    {imeiLinkage.linkages.map((dev, i) => {
                      const riskColor = dev.suspicion === 'HIGH' ? 'text-[#FF4655] border-[#FF4655]/40 bg-[#FF4655]/5'
                        : dev.suspicion === 'MEDIUM' ? 'text-[#FFB800] border-[#FFB800]/40 bg-[#FFB800]/5'
                        : 'text-[#00FFB3] border-[#00FFB3]/30 bg-[#00FFB3]/5';
                      return (
                        <div key={i} className={`p-3 rounded-lg border ${riskColor}`} data-testid={`imei-row-${i}`}>
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <span className="font-mono text-sm text-white">{dev.imei}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="px-2 py-0.5 rounded-full font-semibold border border-current">
                                {dev.suspicion}
                              </span>
                              <span className="text-white/60">{dev.distinct_sims} SIM{dev.distinct_sims !== 1 ? 's' : ''}</span>
                              <span className="text-white/50">·</span>
                              <span className="text-white/60">{dev.call_count} calls</span>
                            </div>
                          </div>
                          <div className="text-xs text-white/70 space-y-1">
                            <div>
                              <span className="text-white/40">Phones: </span>
                              <span className="font-mono">{dev.phones.join(', ')}</span>
                            </div>
                            {dev.locations?.length > 0 && (
                              <div>
                                <span className="text-white/40">Seen in: </span>
                                <span>{dev.locations.slice(0, 5).join(', ')}{dev.locations.length > 5 ? '…' : ''}</span>
                              </div>
                            )}
                            {(dev.first_seen || dev.last_seen) && (
                              <div className="text-white/40">
                                {dev.first_seen} → {dev.last_seen}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* Location Mapping */}
        {(locationMap || analyticsLoading) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 glassmorphism rounded-xl p-6 border border-white/10"
            data-testid="location-map-section"
          >
            <button
              onClick={() => setShowLocationSection(!showLocationSection)}
              className="w-full flex items-center justify-between mb-4"
              data-testid="toggle-location-section"
            >
              <h3 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                <MapPin size={20} className="text-success" />
                Location Mapping & Movement Patterns
              </h3>
              {showLocationSection ? <ChevronUp size={18} className="text-white/50" /> : <ChevronDown size={18} className="text-white/50" />}
            </button>

            {showLocationSection && (
              <>
                <p className="text-white/50 text-xs mb-4">
                  Aggregates tower / location frequency and reconstructs movement timelines. Filter by a specific phone or IMEI to track one subject.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <Input
                    placeholder="Filter by phone…"
                    value={locationFilter.phone}
                    onChange={(e) => setLocationFilter({ ...locationFilter, phone: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="location-filter-phone"
                  />
                  <Input
                    placeholder="Filter by IMEI…"
                    value={locationFilter.imei}
                    onChange={(e) => setLocationFilter({ ...locationFilter, imei: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="location-filter-imei"
                  />
                  <Button
                    onClick={refreshLocationMap}
                    className="bg-accent text-black hover:bg-accent/90"
                    data-testid="apply-location-filter"
                  >
                    Apply Filter
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 size={16} className="text-success" />
                      Top Hotspots ({locationMap?.hotspots?.length || 0})
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto" data-testid="hotspots-list">
                      {locationMap?.hotspots?.length > 0 ? locationMap.hotspots.map((h, i) => (
                        <div key={i} className="p-2 bg-white/5 rounded border border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="text-white text-sm">{h.location}</span>
                            <span className="text-success font-bold text-sm">{h.visit_count}×</span>
                          </div>
                          <div className="text-xs text-white/40 mt-1">
                            {h.distinct_phones_count} phone{h.distinct_phones_count !== 1 ? 's' : ''} · {h.distinct_towers_count} tower{h.distinct_towers_count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      )) : (
                        <p className="text-white/50 text-sm">No location data found.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Clock size={16} className="text-accent" />
                      Movement Timeline ({locationMap?.total_points || 0} points)
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto" data-testid="movement-points">
                      {locationMap?.points?.slice(0, 30).map((p, i) => (
                        <div key={i} className="p-2 bg-white/5 rounded border border-white/10 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-white">{p.phone || '—'}</span>
                            <span className="text-accent">{p.visit_count}×</span>
                          </div>
                          <div className="text-white/60">
                            <MapPin size={10} className="inline mr-1" />{p.location}
                            {p.tower_id && <span className="text-white/40"> · Tower {p.tower_id}</span>}
                          </div>
                          {(p.first_seen || p.last_seen) && (
                            <div className="text-white/40 mt-0.5">
                              {p.first_seen} → {p.last_seen}
                            </div>
                          )}
                        </div>
                      ))}
                      {(!locationMap?.points || locationMap.points.length === 0) && (
                        <p className="text-white/50 text-sm">No movement points found.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

export default CDRAnalyzer;
