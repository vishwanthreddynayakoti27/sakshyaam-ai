import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  MapPin, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Shield,
  Flame,
  Users,
  MessageCircle,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  Scale,
  ThermometerSun
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { api } from '../utils/api';

const SenticelDiary = () => {
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [newEntry, setNewEntry] = useState({
    caseNumber: '',
    location: '',
    description: '',
    keywords: ''
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load saved entries from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('senticel_diary_entries');
    if (saved) {
      setDiaryEntries(JSON.parse(saved));
    }
  }, []);

  // Save entries to localStorage
  useEffect(() => {
    localStorage.setItem('senticel_diary_entries', JSON.stringify(diaryEntries));
  }, [diaryEntries]);

  const analyzeEntry = async (entry) => {
    setAnalyzing(true);
    
    try {
      // Call backend sentiment analysis
      const response = await api.post('/senticel/analyze', {
        text: entry.description,
        location: entry.location,
        keywords: entry.keywords.split(',').map(k => k.trim()).filter(k => k)
      });
      
      return response.data;
    } catch (err) {
      // Fallback to client-side analysis
      return analyzeLocally(entry);
    } finally {
      setAnalyzing(false);
    }
  };

  // Client-side fallback sentiment analysis
  const analyzeLocally = (entry) => {
    const text = entry.description.toLowerCase();
    const keywords = entry.keywords.toLowerCase();
    
    // Sentiment scoring based on keywords
    const negativeWords = ['angry', 'protest', 'violence', 'attack', 'threat', 'riot', 'mob', 'death', 'murder', 'assault', 'dangerous', 'tension', 'conflict', 'clash'];
    const positiveWords = ['peaceful', 'calm', 'resolved', 'cooperation', 'safe', 'normal', 'stable'];
    const volatileWords = ['rumor', 'rumour', 'spreading', 'viral', 'crowd', 'gathering', 'march', 'strike', 'bandh'];
    
    let negativeScore = 0;
    let positiveScore = 0;
    let volatileScore = 0;
    
    negativeWords.forEach(word => {
      if (text.includes(word) || keywords.includes(word)) negativeScore += 1;
    });
    
    positiveWords.forEach(word => {
      if (text.includes(word) || keywords.includes(word)) positiveScore += 1;
    });
    
    volatileWords.forEach(word => {
      if (text.includes(word) || keywords.includes(word)) volatileScore += 1;
    });
    
    // Determine risk level
    let riskLevel = 'Safe';
    let riskScore = 0;
    
    if (negativeScore >= 3 || volatileScore >= 2) {
      riskLevel = 'Volatile';
      riskScore = Math.min(0.9, 0.6 + (negativeScore * 0.1));
    } else if (negativeScore >= 1 || volatileScore >= 1) {
      riskLevel = 'Moderate';
      riskScore = 0.3 + (negativeScore * 0.1) + (volatileScore * 0.05);
    } else {
      riskLevel = 'Safe';
      riskScore = Math.max(0.1, 0.3 - (positiveScore * 0.05));
    }
    
    // Social temperature (0-100)
    const socialTemperature = Math.round(riskScore * 100);
    
    // Generate alerts
    const alerts = [];
    if (text.includes('protest') || text.includes('march')) {
      alerts.push({ type: 'Protest Activity', severity: 'high' });
    }
    if (text.includes('rumor') || text.includes('rumour') || text.includes('viral')) {
      alerts.push({ type: 'Rumor Spreading', severity: 'medium' });
    }
    if (text.includes('crowd') || text.includes('gathering')) {
      alerts.push({ type: 'Crowd Formation', severity: 'medium' });
    }
    if (text.includes('tension') || text.includes('clash')) {
      alerts.push({ type: 'Community Tension', severity: 'high' });
    }
    
    // Keyword spikes (simulated)
    const keywordSpikes = [];
    if (negativeScore > 0) {
      keywordSpikes.push({ keyword: 'Anger', trend: 'rising', change: `+${Math.round(negativeScore * 15)}%` });
    }
    if (volatileScore > 0) {
      keywordSpikes.push({ keyword: 'Unrest', trend: 'rising', change: `+${Math.round(volatileScore * 20)}%` });
    }
    if (positiveScore > 0) {
      keywordSpikes.push({ keyword: 'Calm', trend: 'falling', change: `-${Math.round(positiveScore * 10)}%` });
    }
    
    return {
      sentiment: {
        score: riskScore,
        magnitude: negativeScore + volatileScore,
        label: riskScore > 0.5 ? 'Negative' : riskScore > 0.3 ? 'Mixed' : 'Neutral'
      },
      riskLevel,
      socialTemperature,
      alerts,
      keywordSpikes,
      analyzedAt: new Date().toISOString()
    };
  };

  const handleAddEntry = async () => {
    if (!newEntry.caseNumber || !newEntry.location || !newEntry.description) {
      toast.error('Please fill in Case Number, Location, and Description');
      return;
    }

    setAnalyzing(true);
    
    try {
      const analysis = await analyzeEntry(newEntry);
      
      const entry = {
        id: Date.now().toString(),
        ...newEntry,
        ...analysis,
        createdAt: new Date().toISOString()
      };

      setDiaryEntries(prev => [entry, ...prev]);
      setNewEntry({ caseNumber: '', location: '', description: '', keywords: '' });
      setSelectedEntry(entry);
      
      if (analysis.riskLevel === 'Volatile') {
        toast.error(`⚠️ VOLATILE: High public risk detected at ${newEntry.location}`);
      } else if (analysis.riskLevel === 'Moderate') {
        toast.warning(`Moderate risk level at ${newEntry.location}`);
      } else {
        toast.success('Diary entry added - Area appears stable');
      }
    } catch (err) {
      toast.error('Failed to analyze entry');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRefreshAnalysis = async (entry) => {
    setRefreshing(true);
    
    try {
      const analysis = await analyzeEntry(entry);
      
      setDiaryEntries(prev => prev.map(e => 
        e.id === entry.id ? { ...e, ...analysis } : e
      ));
      
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry({ ...entry, ...analysis });
      }
      
      toast.success('Analysis refreshed');
    } catch (err) {
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteEntry = (id) => {
    setDiaryEntries(prev => prev.filter(e => e.id !== id));
    if (selectedEntry?.id === id) {
      setSelectedEntry(null);
    }
    toast.success('Entry deleted');
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'Volatile': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'Moderate': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-green-400 bg-green-500/20 border-green-500/30';
    }
  };

  const getRiskIcon = (level) => {
    switch (level) {
      case 'Volatile': return <Flame className="text-red-400" size={20} />;
      case 'Moderate': return <AlertTriangle className="text-yellow-400" size={20} />;
      default: return <Shield className="text-green-400" size={20} />;
    }
  };

  const getTemperatureColor = (temp) => {
    if (temp >= 70) return 'from-red-500 to-orange-500';
    if (temp >= 40) return 'from-yellow-500 to-orange-400';
    return 'from-green-500 to-teal-400';
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto" data-testid="senticel-diary-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <Activity className="text-accent" size={32} />
            <h1 className="text-4xl font-heading font-bold text-white text-glow" data-testid="page-title">
              SENTICEL Diary
            </h1>
          </div>
          <p className="text-white/60 text-lg">
            Social Pulse Integration & Volatility Alert System for Case Monitoring
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - New Entry Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism rounded-xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-heading font-bold text-white mb-4 flex items-center gap-2">
              <Plus size={20} className="text-accent" />
              New Diary Entry
            </h2>

            <div className="space-y-4">
              <Input
                placeholder="Case Number *"
                value={newEntry.caseNumber}
                onChange={(e) => setNewEntry(prev => ({ ...prev, caseNumber: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
                data-testid="case-number-input"
              />

              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-3 text-white/40" />
                <Input
                  placeholder="Location (Area/PS Jurisdiction) *"
                  value={newEntry.location}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, location: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white pl-10"
                  data-testid="location-input"
                />
              </div>

              <Textarea
                placeholder="Case Description / Situation Report *

Include details about:
- Current situation on ground
- Public mood/sentiment
- Any gatherings or protests
- Rumors circulating"
                value={newEntry.description}
                onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
                className="bg-white/5 border-white/20 text-white min-h-[150px]"
                data-testid="description-input"
              />

              <Input
                placeholder="Keywords (comma separated): protest, tension, rumor..."
                value={newEntry.keywords}
                onChange={(e) => setNewEntry(prev => ({ ...prev, keywords: e.target.value }))}
                className="bg-white/5 border-white/20 text-white"
                data-testid="keywords-input"
              />

              <Button
                onClick={handleAddEntry}
                disabled={analyzing}
                data-testid="add-entry-btn"
                className="w-full bg-accent text-black font-bold hover:bg-accent/80"
              >
                {analyzing ? 'Analyzing...' : 'Add & Analyze Entry'}
              </Button>
            </div>

            {/* Entry List */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="text-sm font-semibold text-white/70 mb-3">Recent Entries ({diaryEntries.length})</h3>
              
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {diaryEntries.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-4">No entries yet</p>
                ) : (
                  diaryEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      data-testid={`entry-${entry.id}`}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedEntry?.id === entry.id
                          ? 'bg-accent/20 border-accent'
                          : 'bg-white/5 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getRiskIcon(entry.riskLevel)}
                          <span className="text-white text-sm font-semibold">{entry.caseNumber}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id); }}
                          className="text-white/40 hover:text-red-400 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-white/60 text-xs mt-1 truncate">{entry.location}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          {/* Middle Panel - Dual Dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {!selectedEntry ? (
              <div className="glassmorphism rounded-xl p-12 border border-white/10 flex items-center justify-center h-full">
                <div className="text-center text-white/40">
                  <Activity size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Select an entry to view analysis</p>
                  <p className="text-sm mt-2">Or create a new diary entry to get started</p>
                </div>
              </div>
            ) : (
              <>
                {/* Top Row - Dual Gauges */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Legal Strength Gauge */}
                  <div className="glassmorphism rounded-xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Scale className="text-accent" size={20} />
                      <h3 className="text-lg font-bold text-white">Legal Strength</h3>
                    </div>
                    
                    <div className="relative h-32 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-5xl font-bold text-accent">{selectedEntry.sentiment?.label === 'Negative' ? 'Weak' : selectedEntry.sentiment?.label === 'Mixed' ? 'Fair' : 'Strong'}</p>
                        <p className="text-white/60 text-sm mt-2">Case Documentation</p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-white/5 rounded-lg">
                      <p className="text-white/60 text-xs">
                        {selectedEntry.sentiment?.label === 'Negative' 
                          ? 'High tension - ensure thorough documentation'
                          : selectedEntry.sentiment?.label === 'Mixed'
                          ? 'Moderate situation - monitor developments'
                          : 'Stable situation - standard procedures apply'}
                      </p>
                    </div>
                  </div>

                  {/* Social Temperature Gauge */}
                  <div className="glassmorphism rounded-xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <ThermometerSun className="text-accent" size={20} />
                      <h3 className="text-lg font-bold text-white">Social Temperature</h3>
                    </div>
                    
                    <div className="relative h-32 flex items-center justify-center">
                      <div className="text-center">
                        <p className={`text-5xl font-bold bg-gradient-to-r ${getTemperatureColor(selectedEntry.socialTemperature)} bg-clip-text text-transparent`}>
                          {selectedEntry.socialTemperature}°
                        </p>
                        <p className="text-white/60 text-sm mt-2">Public Sentiment Index</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${getTemperatureColor(selectedEntry.socialTemperature)} transition-all duration-500`}
                          style={{ width: `${selectedEntry.socialTemperature}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-white/40 mt-1">
                        <span>Cold (Safe)</span>
                        <span>Hot (Volatile)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Level Banner */}
                <div className={`glassmorphism rounded-xl p-4 border ${getRiskColor(selectedEntry.riskLevel)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getRiskIcon(selectedEntry.riskLevel)}
                      <div>
                        <p className="text-white font-bold">Public Risk Level: {selectedEntry.riskLevel}</p>
                        <p className="text-white/60 text-sm">{selectedEntry.location} • Case: {selectedEntry.caseNumber}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRefreshAnalysis(selectedEntry)}
                      disabled={refreshing}
                      className="bg-white/10 text-white hover:bg-white/20"
                    >
                      <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </Button>
                  </div>
                </div>

                {/* Bottom Row - Alerts & Trends */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Volatility Alerts */}
                  <div className="glassmorphism rounded-xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="text-warning" size={20} />
                      <h3 className="text-lg font-bold text-white">Volatility Alerts</h3>
                    </div>

                    {selectedEntry.alerts && selectedEntry.alerts.length > 0 ? (
                      <div className="space-y-3">
                        {selectedEntry.alerts.map((alert, i) => (
                          <div 
                            key={i}
                            className={`p-3 rounded-lg border ${
                              alert.severity === 'high'
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-yellow-500/10 border-yellow-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {alert.severity === 'high' ? (
                                <Flame className="text-red-400" size={16} />
                              ) : (
                                <AlertTriangle className="text-yellow-400" size={16} />
                              )}
                              <span className={`font-semibold text-sm ${
                                alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'
                              }`}>
                                {alert.type}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-24 text-white/40">
                        <div className="text-center">
                          <Shield size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No active alerts</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Keyword Spikes */}
                  <div className="glassmorphism rounded-xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="text-accent" size={20} />
                      <h3 className="text-lg font-bold text-white">Keyword Spikes</h3>
                    </div>

                    {selectedEntry.keywordSpikes && selectedEntry.keywordSpikes.length > 0 ? (
                      <div className="space-y-3">
                        {selectedEntry.keywordSpikes.map((spike, i) => (
                          <div 
                            key={i}
                            className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <MessageCircle className="text-accent" size={16} />
                              <span className="text-white font-semibold text-sm">{spike.keyword}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {spike.trend === 'rising' ? (
                                <TrendingUp className="text-red-400" size={16} />
                              ) : (
                                <TrendingDown className="text-green-400" size={16} />
                              )}
                              <span className={`text-sm font-bold ${
                                spike.trend === 'rising' ? 'text-red-400' : 'text-green-400'
                              }`}>
                                {spike.change}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-24 text-white/40">
                        <div className="text-center">
                          <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No keyword spikes detected</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Entry Details */}
                <div className="glassmorphism rounded-xl p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="text-accent" size={20} />
                      <h3 className="text-lg font-bold text-white">Entry Details</h3>
                    </div>
                    <span className="text-white/40 text-sm">
                      {new Date(selectedEntry.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white/80 text-sm whitespace-pre-wrap">{selectedEntry.description}</p>
                  </div>

                  {selectedEntry.keywords && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedEntry.keywords.split(',').filter(k => k.trim()).map((kw, i) => (
                        <span key={i} className="px-2 py-1 bg-accent/20 text-accent text-xs rounded">
                          {kw.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default SenticelDiary;
