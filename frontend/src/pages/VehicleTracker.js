import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Camera, Crosshair, MapPin, Clock, Upload, X, Loader2, Plus, Hash,
  CheckCircle2, AlertCircle, Calendar, Image as ImageIcon
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../utils/api';

const MAX_CAMERAS = 8;

const VehicleTracker = () => {
  const [plateText, setPlateText] = useState('');
  const [cameras, setCameras] = useState([emptyCamera(), emptyCamera()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  function emptyCamera() {
    return { id: Math.random().toString(36).slice(2, 9), file: null, camera_name: '', location: '', recording_start: '' };
  }

  const addCamera = () => {
    if (cameras.length >= MAX_CAMERAS) {
      toast.warning(`Max ${MAX_CAMERAS} cameras supported per request`);
      return;
    }
    setCameras([...cameras, emptyCamera()]);
  };

  const removeCamera = (id) => {
    if (cameras.length <= 1) return;
    setCameras(cameras.filter((c) => c.id !== id));
  };

  const updateCamera = (id, patch) => {
    setCameras(cameras.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const submit = async () => {
    const plate = plateText.replace(/\s|-/g, '').toUpperCase().trim();
    if (!plate) {
      toast.error('Enter the plate number to track');
      return;
    }
    const camsWithFiles = cameras.filter((c) => c.file);
    if (camsWithFiles.length === 0) {
      toast.error('Upload at least one CCTV clip');
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('plate_text', plate);
      fd.append('sample_interval', '1.5');
      fd.append('fuzzy', 'true');
      const meta = camsWithFiles.map((c) => ({
        camera_name: c.camera_name || c.file.name,
        location: c.location || '',
        recording_start: c.recording_start ? new Date(c.recording_start).toISOString() : null,
      }));
      fd.append('camera_metadata', JSON.stringify(meta));
      camsWithFiles.forEach((c) => fd.append('files', c.file));

      toast.info(`Tracking ${plate} across ${camsWithFiles.length} camera${camsWithFiles.length > 1 ? 's' : ''}… per-frame AI analysis can take 30-90s.`);
      const res = await api.post('/cctv/track-vehicle', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000,
      });
      const data = res.data || res;
      setResult(data);
      if (data.total_sightings === 0) {
        toast.warning('No sightings of that plate in any uploaded camera. Try a coarser sample interval or check the plate spelling.');
      } else {
        toast.success(`${data.total_sightings} sighting${data.total_sightings > 1 ? 's' : ''} across ${data.cameras_with_match} camera${data.cameras_with_match > 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail || err?.message || 'Tracking failed';
      toast.error(`Tracking failed: ${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-2" data-testid="vehicle-tracker-page">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#FF3B3B]/20 to-[#FFB800]/20 border border-[#FF3B3B]/30">
            <Crosshair className="text-[#FF3B3B]" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="page-title">Vehicle Movement Tracker</h1>
            <p className="text-white/60 text-sm">Track a registration plate across multiple CCTV cameras and reconstruct its chronological route.</p>
          </div>
        </motion.div>

        {/* Plate input */}
        <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10 mb-4" data-testid="plate-section">
          <label className="text-white/70 text-xs flex items-center gap-1 mb-1">
            <Hash size={12} /> Target plate
          </label>
          <Input
            value={plateText}
            onChange={(e) => setPlateText(e.target.value)}
            placeholder="e.g. TS09EA1234"
            className="bg-[#030614] border-white/20 text-white text-lg font-mono uppercase"
            data-testid="track-plate-input"
            disabled={submitting}
          />
          <p className="text-white/40 text-[11px] mt-1">Spaces / dashes are normalised. Fuzzy 1-character OCR tolerance is enabled (handles O↔0, I↔1 etc.).</p>
        </div>

        {/* Cameras */}
        <div className="space-y-3 mb-4" data-testid="cameras-list">
          {cameras.map((cam, idx) => (
            <motion.div
              key={cam.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10"
              data-testid={`camera-card-${idx}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Camera size={16} className="text-[#00C2FF]" /> Camera #{idx + 1}
                </h3>
                {cameras.length > 1 && (
                  <button onClick={() => removeCamera(cam.id)} disabled={submitting}
                          className="text-white/40 hover:text-[#FF4655]" data-testid={`remove-camera-${idx}`}>
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <label className="text-white/60 text-xs block mb-1">Video clip</label>
                  <div className="border-2 border-dashed border-white/15 rounded-lg p-3">
                    {cam.file ? (
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm truncate">{cam.file.name} <span className="text-white/40">({(cam.file.size / 1024 / 1024).toFixed(1)} MB)</span></span>
                        <button onClick={() => updateCamera(cam.id, { file: null })} disabled={submitting}
                                className="text-white/40 hover:text-[#FF4655]" data-testid={`clear-file-${idx}`}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex items-center justify-center gap-2 text-white/60 hover:text-white text-sm py-2">
                        <Upload size={14} /> Choose video file
                        <input type="file" accept="video/*" className="hidden"
                               onChange={(e) => updateCamera(cam.id, { file: e.target.files?.[0] || null })}
                               data-testid={`file-input-${idx}`} disabled={submitting} />
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-xs flex items-center gap-1"><Camera size={11} /> Camera name</label>
                  <Input value={cam.camera_name} onChange={(e) => updateCamera(cam.id, { camera_name: e.target.value })}
                         placeholder="e.g. MG Road Cam"
                         className="bg-[#030614] border-white/20 text-white text-sm mt-0.5"
                         data-testid={`camera-name-${idx}`} disabled={submitting} />
                </div>
                <div>
                  <label className="text-white/60 text-xs flex items-center gap-1"><MapPin size={11} /> Location</label>
                  <Input value={cam.location} onChange={(e) => updateCamera(cam.id, { location: e.target.value })}
                         placeholder="e.g. Tank Bund Bridge"
                         className="bg-[#030614] border-white/20 text-white text-sm mt-0.5"
                         data-testid={`camera-location-${idx}`} disabled={submitting} />
                </div>
                <div>
                  <label className="text-white/60 text-xs flex items-center gap-1"><Calendar size={11} /> Recording start</label>
                  <Input type="datetime-local" value={cam.recording_start}
                         onChange={(e) => updateCamera(cam.id, { recording_start: e.target.value })}
                         className="bg-[#030614] border-white/20 text-white text-sm mt-0.5"
                         data-testid={`camera-time-${idx}`} disabled={submitting} />
                  <p className="text-white/30 text-[10px] mt-0.5">Optional, but enables absolute movement timeline</p>
                </div>
              </div>
            </motion.div>
          ))}

          <div className="flex gap-3">
            <Button onClick={addCamera} variant="outline" disabled={submitting || cameras.length >= MAX_CAMERAS}
                    className="border-white/20 text-white hover:bg-white/10" data-testid="add-camera-btn">
              <Plus size={14} className="mr-1" /> Add camera ({cameras.length}/{MAX_CAMERAS})
            </Button>
            <Button onClick={submit} disabled={submitting} className="bg-[#00FFB3] text-black hover:bg-[#00FFB3]/90 flex-1 sm:flex-none"
                    data-testid="track-submit-btn">
              {submitting ? (<><Loader2 className="animate-spin mr-2" size={16} /> Analysing across cameras…</>)
                          : (<><Crosshair size={16} className="mr-2" /> Track this vehicle</>)}
            </Button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="space-y-4" data-testid="track-results">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="summary-cards">
              <SummaryCard icon={Hash} label="Target Plate" value={result.target_plate} />
              <SummaryCard icon={CheckCircle2} label="Total Sightings" value={result.total_sightings}
                           accent={result.total_sightings > 0 ? '#00FFB3' : '#FF4655'} />
              <SummaryCard icon={Camera} label="Cameras Matched"
                           value={`${result.cameras_with_match} / ${result.cameras.length}`} />
            </div>

            {/* Per-camera */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="per-camera-cards">
              {result.cameras.map((c, i) => (
                <div key={i} className={`p-3 rounded-lg border ${c.sightings_count > 0 ? 'bg-[#00FFB3]/5 border-[#00FFB3]/30' : 'bg-[#0B0F1A] border-white/10'}`}
                     data-testid={`per-camera-${i}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-white text-sm font-semibold flex items-center gap-1">
                      <Camera size={12} /> {c.camera_name}
                    </h4>
                    <span className={`text-xs font-bold ${c.sightings_count > 0 ? 'text-[#00FFB3]' : 'text-white/40'}`}>
                      {c.sightings_count} hit{c.sightings_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {c.location && <p className="text-white/50 text-xs flex items-center gap-1"><MapPin size={10} /> {c.location}</p>}
                  <p className="text-white/30 text-[10px] mt-1">
                    {c.frames_sampled} frames sampled · {(c.video_duration_ms / 1000).toFixed(1)}s
                  </p>
                  {c.error && <p className="text-[#FF4655] text-xs mt-1">⚠ {c.error}</p>}
                </div>
              ))}
            </div>

            {/* Timeline */}
            {result.timeline.length > 0 ? (
              <div className="p-4 rounded-xl bg-[#0B0F1A] border border-white/10" data-testid="movement-timeline">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Clock className="text-[#FFB800]" size={18} /> Movement Timeline ({result.timeline.length})
                </h3>
                <div className="relative pl-4 border-l border-white/10 space-y-3">
                  {result.timeline.map((t, i) => (
                    <div key={i} className="relative" data-testid={`timeline-row-${i}`}>
                      <span className="absolute -left-[21px] top-3 w-3 h-3 rounded-full bg-[#00FFB3] border-2 border-[#0B0F1A]" />
                      <div className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-[#030614] border border-white/10">
                        {t.thumbnail_base64 ? (
                          <img src={`data:image/jpeg;base64,${t.thumbnail_base64}`}
                               alt={`Sighting ${i + 1}`}
                               className="w-full sm:w-44 h-28 object-cover rounded-md flex-shrink-0"
                               data-testid={`timeline-thumb-${i}`} />
                        ) : (
                          <div className="w-full sm:w-44 h-28 rounded-md bg-white/5 flex items-center justify-center text-white/30">
                            <ImageIcon size={20} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-semibold text-sm flex items-center gap-1">
                              <Camera size={12} className="text-[#00C2FF]" /> {t.camera_name}
                            </span>
                            {t.location && <span className="text-white/50 text-xs flex items-center gap-1"><MapPin size={10} /> {t.location}</span>}
                          </div>
                          {t.sighting_at_iso && (
                            <p className="text-[#FFB800] text-xs mt-1 flex items-center gap-1">
                              <Clock size={10} /> {new Date(t.sighting_at_iso).toLocaleString()}
                            </p>
                          )}
                          <p className="text-white/50 text-xs mt-1">
                            in-video: <span className="text-white/70 font-mono">{t.timestamp_formatted}</span>
                          </p>
                          <p className="text-white/70 text-xs mt-1">
                            Plate read: <span className="text-[#00FFB3] font-mono font-semibold">{t.plate_text}</span>
                            <span className="text-white/30 ml-2">conf {Math.round((t.confidence || 0) * 100)}%</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#0B0F1A] border border-white/10 text-center text-white/50">
                <AlertCircle className="mx-auto mb-2 text-[#FFB800]" size={28} />
                No sightings of <span className="font-mono text-white">{result.target_plate}</span> in any uploaded camera.
              </div>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
};

const SummaryCard = ({ icon: Icon, label, value, accent = '#00C2FF' }) => (
  <div className="p-3 rounded-lg bg-[#0B0F1A] border border-white/10">
    <div className="flex items-center gap-2 mb-1 text-white/50 text-xs">
      <Icon size={12} /> {label}
    </div>
    <div className="text-2xl font-bold font-mono" style={{ color: accent }}>{value}</div>
  </div>
);

export default VehicleTracker;
