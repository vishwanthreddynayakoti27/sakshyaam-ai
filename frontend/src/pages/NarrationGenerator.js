import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  X,
  Wand2,
  Copy,
  CheckCircle2,
  PenTool,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import api from '../utils/api';

const NarrationGenerator = () => {
  const [categories, setCategories] = useState([]);
  const [byCategory, setByCategory] = useState({});
  const [totalKw, setTotalKw] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [selected, setSelected] = useState([]);
  const [composing, setComposing] = useState(false);
  const [narration, setNarration] = useState('');
  const [collapsed, setCollapsed] = useState({});

  // Case meta
  const [meta, setMeta] = useState({
    fir_number: '',
    police_station: '',
    io_name: '',
    complainant_name: '',
    accused_names: '',
    occurrence_dtp: '',
    sections: '',
    custom_intro: '',
  });

  // Load categories on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/narration/categories');
        setCategories(r.data.categories || []);
        setByCategory(r.data.keywords_by_category || {});
        setTotalKw(r.data.total_keywords || 0);
      } catch (e) {
        toast.error('Failed to load keyword bank');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load keywords whenever filter changes
  useEffect(() => {
    const t = setTimeout(async () => {
      const params = {};
      if (activeCategory) params.category = activeCategory;
      if (query.trim()) params.q = query.trim();
      try {
        const r = await api.get('/narration/keywords', { params });
        setKeywords(r.data || []);
      } catch (e) {
        // silent
      }
    }, 200);
    return () => clearTimeout(t);
  }, [activeCategory, query]);

  const grouped = useMemo(() => {
    const out = {};
    for (const k of keywords) {
      if (!out[k.category]) out[k.category] = [];
      out[k.category].push(k);
    }
    return out;
  }, [keywords]);

  const togglePhrase = (phrase) => {
    setSelected((prev) =>
      prev.includes(phrase) ? prev.filter((p) => p !== phrase) : [...prev, phrase]
    );
  };

  const removePhrase = (idx) => {
    setSelected((prev) => prev.filter((_, i) => i !== idx));
  };

  const movePhrase = (idx, dir) => {
    setSelected((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const compose = async () => {
    if (selected.length === 0) {
      toast.error('Pick at least one phrase first');
      return;
    }
    setComposing(true);
    try {
      const body = {
        selected_phrases: selected,
        ...meta,
        accused_names: meta.accused_names
          ? meta.accused_names.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };
      const r = await api.post('/narration/compose', body);
      setNarration(r.data.narration || '');
      toast.success(`Narration composed (${r.data.word_count} words)`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Compose failed');
    } finally {
      setComposing(false);
    }
  };

  const copyNarration = () => {
    if (!narration) return;
    navigator.clipboard.writeText(narration);
    toast.success('Copied to clipboard');
  };

  const toggleCollapse = (cat) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <Layout>
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-[#FFB800]/15 border border-[#FFB800]/30 flex items-center justify-center">
              <PenTool size={22} className="text-[#FFB800]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Narration Generator</h1>
              <p className="text-white/50 text-sm">
                Compose case narratives by picking from {totalKw}+ curated station-style phrases · 0 credits
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: Categories + search */}
          <div className="lg:col-span-3 space-y-3">
            <div className="rounded-xl bg-[#0A0F2C]/60 border border-white/10 p-4" data-testid="narration-search-panel">
              <label className="text-white/60 text-xs uppercase tracking-wider mb-2 block">Search Keywords</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <Input
                  data-testid="narration-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. arrest, scene, MLC..."
                  className="pl-9 bg-[#030614] border-white/10 text-white text-sm h-9"
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#0A0F2C]/60 border border-white/10 p-4" data-testid="narration-categories">
              <p className="text-white/60 text-xs uppercase tracking-wider mb-3">Categories</p>
              <button
                onClick={() => setActiveCategory(null)}
                className={`w-full text-left text-sm px-3 py-1.5 rounded transition mb-1 ${
                  activeCategory === null
                    ? 'bg-[#FFB800]/20 text-[#FFB800]'
                    : 'text-white/70 hover:bg-white/5'
                }`}
                data-testid="cat-all"
              >
                All <span className="text-white/30 ml-1">({totalKw})</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full text-left text-sm px-3 py-1.5 rounded transition mb-1 ${
                    activeCategory === cat
                      ? 'bg-[#FFB800]/20 text-[#FFB800]'
                      : 'text-white/70 hover:bg-white/5'
                  }`}
                  data-testid={`cat-${cat.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                >
                  {cat} <span className="text-white/30 ml-1">({byCategory[cat] || 0})</span>
                </button>
              ))}
            </div>
          </div>

          {/* MIDDLE: Phrase library */}
          <div className="lg:col-span-5 rounded-xl bg-[#0A0F2C]/60 border border-white/10 p-4 max-h-[78vh] overflow-y-auto" data-testid="narration-library">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-white/40" />
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <p className="text-white/40 text-center py-12 text-sm">No phrases match your search.</p>
            ) : (
              Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="mb-5">
                  <button
                    onClick={() => toggleCollapse(cat)}
                    className="w-full flex items-center justify-between text-[#FFB800] font-bold text-sm uppercase tracking-wider mb-2 pb-1 border-b border-[#FFB800]/20"
                  >
                    <span>{cat}</span>
                    <span className="flex items-center gap-2 text-white/40 font-normal text-xs">
                      {items.length}
                      {collapsed[cat] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </span>
                  </button>
                  {!collapsed[cat] && (
                    <div className="space-y-1.5">
                      {items.map((it, i) => {
                        const sel = selected.includes(it.phrase);
                        return (
                          <button
                            key={`${cat}-${i}`}
                            onClick={() => togglePhrase(it.phrase)}
                            className={`w-full text-left p-2.5 rounded-md border transition ${
                              sel
                                ? 'border-[#00FFB3]/50 bg-[#00FFB3]/10'
                                : 'border-white/10 bg-[#030614] hover:border-[#FFB800]/30 hover:bg-[#FFB800]/5'
                            }`}
                            data-testid={`phrase-${cat.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${i}`}
                          >
                            <div className="flex items-start gap-2">
                              {sel ? (
                                <CheckCircle2 size={14} className="text-[#00FFB3] shrink-0 mt-0.5" />
                              ) : (
                                <Plus size={14} className="text-white/40 shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold ${sel ? 'text-[#00FFB3]' : 'text-white/80'}`}>
                                  {it.keyword}
                                </p>
                                <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{it.phrase}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* RIGHT: Selected phrases + compose */}
          <div className="lg:col-span-4 space-y-3">
            {/* Case meta */}
            <details className="rounded-xl bg-[#0A0F2C]/60 border border-white/10 p-4" open>
              <summary className="text-white/60 text-xs uppercase tracking-wider cursor-pointer mb-2">
                Case Meta (optional, used in intro/outro)
              </summary>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {[
                  ['fir_number', 'FIR No.'],
                  ['police_station', 'Police Station'],
                  ['io_name', 'IO Name'],
                  ['complainant_name', 'Complainant'],
                  ['accused_names', 'Accused (comma-sep)'],
                  ['occurrence_dtp', 'Occurrence DT/Place'],
                  ['sections', 'Sections'],
                ].map(([k, label]) => (
                  <div key={k}>
                    <label className="text-white/40 text-[10px] uppercase">{label}</label>
                    <Input
                      value={meta[k]}
                      onChange={(e) => setMeta({ ...meta, [k]: e.target.value })}
                      className="bg-[#030614] border-white/10 text-white text-xs h-8"
                      data-testid={`meta-${k}`}
                    />
                  </div>
                ))}
              </div>
            </details>

            {/* Selected phrases */}
            <div className="rounded-xl bg-[#0A0F2C]/60 border border-white/10 p-4" data-testid="narration-selected">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/60 text-xs uppercase tracking-wider">
                  Selected ({selected.length})
                </p>
                {selected.length > 0 && (
                  <button
                    onClick={() => setSelected([])}
                    className="text-white/40 hover:text-white text-xs"
                    data-testid="clear-selected"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {selected.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-4 italic">
                  Click phrases on the left to add them here.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {selected.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 bg-[#030614] border border-white/10 rounded text-xs"
                    >
                      <span className="text-[#FFB800] font-bold shrink-0">{i + 1}.</span>
                      <p className="flex-1 text-white/80 leading-relaxed">{p}</p>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button onClick={() => movePhrase(i, -1)} className="text-white/40 hover:text-white text-[10px]" title="Move up">▲</button>
                        <button onClick={() => movePhrase(i, 1)} className="text-white/40 hover:text-white text-[10px]" title="Move down">▼</button>
                      </div>
                      <button
                        onClick={() => removePhrase(i)}
                        className="text-white/40 hover:text-red-400 shrink-0"
                        data-testid={`remove-selected-${i}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                onClick={compose}
                disabled={composing || selected.length === 0}
                className="w-full mt-3 bg-gradient-to-r from-[#FFB800] to-[#FF8800] text-black font-bold hover:opacity-90 disabled:opacity-40"
                data-testid="compose-narration-btn"
              >
                {composing ? (
                  <><Loader2 className="animate-spin mr-2" size={14} /> Composing…</>
                ) : (
                  <><Wand2 className="mr-2" size={14} /> Compose Narration</>
                )}
              </Button>
            </div>

            {/* Output */}
            {narration && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-[#0A0F2C]/60 border border-[#00FFB3]/30 p-4"
                data-testid="narration-output"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[#00FFB3] text-xs uppercase tracking-wider font-semibold">Composed Narration</p>
                  <Button
                    variant="ghost"
                    onClick={copyNarration}
                    className="h-7 px-2 text-xs text-white/70 hover:text-white"
                    data-testid="copy-narration-btn"
                  >
                    <Copy size={12} className="mr-1" /> Copy
                  </Button>
                </div>
                <Textarea
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="bg-[#030614] border-white/10 text-white text-sm min-h-[300px] leading-relaxed"
                  data-testid="narration-textarea"
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NarrationGenerator;
