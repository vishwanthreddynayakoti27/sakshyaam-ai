import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Camera, 
  Search, 
  Upload, 
  Play,
  Pause,
  SkipForward,
  Clock,
  Car,
  User,
  Shirt,
  AlertTriangle,
  Loader2,
  ImageIcon
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const CCTVSearch = () => {
  const [videoFile, setVideoFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  
  // Search attributes
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [personClothing, setPersonClothing] = useState('');

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      toast.success(`Video loaded: ${file.name}`);
    }
  };

  const analyzeVideo = async () => {
    if (!videoFile) {
      toast.error('Please upload a video first');
      return;
    }

    if (!vehicleType && !vehicleColor && !personClothing) {
      toast.error('Please specify at least one search attribute');
      return;
    }

    setIsAnalyzing(true);
    setSearchResults([]);

    // Simulate analysis (in production, this would call an AI service)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Mock results
    const mockResults = [
      { timestamp: '00:01:23', type: 'Vehicle', description: `${vehicleColor || 'Dark'} ${vehicleType || 'Car'}`, confidence: 94 },
      { timestamp: '00:02:45', type: 'Vehicle', description: `${vehicleColor || 'Dark'} ${vehicleType || 'Car'}`, confidence: 87 },
      { timestamp: '00:05:12', type: 'Vehicle', description: `${vehicleColor || 'Dark'} ${vehicleType || 'Car'}`, confidence: 91 },
    ];

    setSearchResults(mockResults);
    setIsAnalyzing(false);
    toast.success(`Found ${mockResults.length} matches!`);
  };

  const vehicleTypes = ['Car', 'Motorcycle', 'Auto-rickshaw', 'Bus', 'Truck', 'Van', 'Bicycle'];
  const colors = ['White', 'Black', 'Silver', 'Red', 'Blue', 'Green', 'Yellow', 'Brown'];

  return (
    <Layout>
    <div className="min-h-screen bg-[#030614] p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#FF3B3B]/20 to-[#FFB800]/20 border border-[#FF3B3B]/30">
            <Camera className="text-[#FF3B3B]" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">CCTV Attribute Search</h1>
            <p className="text-white/60 text-sm">AI-powered video analysis to find vehicles and persons by attributes</p>
          </div>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Search Controls */}
        <div className="space-y-4">
          {/* Video Upload */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Upload className="text-[#00C2FF]" size={18} />
              Upload CCTV Footage
            </h3>
            
            <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center">
              {videoFile ? (
                <div>
                  <Play className="text-[#00FFB3] mx-auto mb-2" size={32} />
                  <p className="text-white font-medium">{videoFile.name}</p>
                  <p className="text-white/50 text-sm">
                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  <Button
                    onClick={() => setVideoFile(null)}
                    variant="outline"
                    size="sm"
                    className="mt-3 border-white/20 text-white/60"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Camera className="text-white/30 mx-auto mb-2" size={32} />
                  <p className="text-white/50 text-sm mb-2">
                    Drop video file or click to browse
                  </p>
                  <p className="text-white/30 text-xs">
                    Supports MP4, AVI, MOV
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    accept="video/*"
                    onChange={handleVideoUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Search Attributes */}
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Search className="text-[#FFB800]" size={18} />
              Search Attributes
            </h3>
            
            <div className="space-y-4">
              {/* Vehicle Search */}
              <div className="p-3 rounded-lg bg-[#030614] border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Car className="text-[#4F7EFF]" size={16} />
                  <span className="text-white text-sm font-medium">Vehicle</span>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-white/50 text-xs">Type</label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full p-2 rounded bg-[#0B0F1A] border border-white/20 text-white text-sm"
                    >
                      <option value="">Any Type</option>
                      {vehicleTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-white/50 text-xs">Color</label>
                    <select
                      value={vehicleColor}
                      onChange={(e) => setVehicleColor(e.target.value)}
                      className="w-full p-2 rounded bg-[#0B0F1A] border border-white/20 text-white text-sm"
                    >
                      <option value="">Any Color</option>
                      {colors.map(color => (
                        <option key={color} value={color}>{color}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-white/50 text-xs">Number/Model (Optional)</label>
                    <Input
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder="e.g., TS 09 XX 1234"
                      className="bg-[#0B0F1A] border-white/20 text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Person Search */}
              <div className="p-3 rounded-lg bg-[#030614] border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Shirt className="text-[#00FFB3]" size={16} />
                  <span className="text-white text-sm font-medium">Person</span>
                </div>
                
                <div>
                  <label className="text-white/50 text-xs">Clothing Description</label>
                  <Input
                    value={personClothing}
                    onChange={(e) => setPersonClothing(e.target.value)}
                    placeholder="e.g., Red shirt, blue jeans"
                    className="bg-[#0B0F1A] border-white/20 text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Analyze Button */}
          <Button
            onClick={analyzeVideo}
            disabled={!videoFile || isAnalyzing}
            className="w-full bg-gradient-to-r from-[#FF3B3B] to-[#FFB800] hover:opacity-90"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Analyzing Video...
              </>
            ) : (
              <>
                <Search size={18} className="mr-2" />
                Search in Video
              </>
            )}
          </Button>

          {/* Coming Soon Notice */}
          <div className="p-4 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-[#FFB800]" size={18} />
              <span className="text-[#FFB800] font-semibold text-sm">Beta Feature</span>
            </div>
            <p className="text-white/60 text-xs">
              Full AI-powered video analysis coming soon. Currently showing demo results.
            </p>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="lg:col-span-2">
          <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <ImageIcon className="text-[#00FFB3]" size={18} />
                Search Results
              </h3>
              {searchResults.length > 0 && (
                <span className="px-2 py-1 rounded bg-[#00FFB3]/20 text-[#00FFB3] text-xs">
                  {searchResults.length} matches found
                </span>
              )}
            </div>

            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="p-4 rounded-full bg-[#FF3B3B]/20 border border-[#FF3B3B]/30 mb-4"
                >
                  <Camera className="text-[#FF3B3B]" size={32} />
                </motion.div>
                <p className="text-white font-medium mb-2">Analyzing video frames...</p>
                <p className="text-white/50 text-sm">This may take a few minutes</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map((result, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 rounded-lg bg-[#030614] border border-white/10 hover:border-[#00C2FF]/30 transition-colors"
                  >
                    {/* Placeholder for screenshot */}
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-[#0B0F1A] to-[#030614] border border-white/10 flex items-center justify-center mb-3">
                      <Camera className="text-white/20" size={48} />
                    </div>
                    
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="text-[#00C2FF]" size={14} />
                        <span className="text-white font-mono text-sm">{result.timestamp}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        result.confidence >= 90 
                          ? 'bg-[#00FFB3]/20 text-[#00FFB3]'
                          : 'bg-[#FFB800]/20 text-[#FFB800]'
                      }`}>
                        {result.confidence}% match
                      </span>
                    </div>
                    
                    <p className="text-white/80 text-sm">{result.description}</p>
                    
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-white/20 text-white/60 hover:text-white text-xs"
                      >
                        <SkipForward size={12} className="mr-1" />
                        Jump to
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-[#00C2FF]/20 text-[#00C2FF] hover:bg-[#00C2FF]/30 text-xs"
                      >
                        Add to Case
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <Camera className="text-white/20 mb-4" size={64} />
                <p className="text-white/40 mb-2">No search results yet</p>
                <p className="text-white/30 text-sm text-center max-w-md">
                  Upload a CCTV video, specify search attributes, and click "Search in Video" to find matches
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
};

export default CCTVSearch;
