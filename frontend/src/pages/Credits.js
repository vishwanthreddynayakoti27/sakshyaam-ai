import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, Zap, Check, Loader2, Sparkles, Building2, Star } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const PACK_ICONS = {
  starter: Sparkles,
  pro: Star,
  agency: Building2,
};

const PACK_HINTS = {
  starter: 'Best for individual officers running their first cases',
  pro: 'Most popular — covers a full investigation with all AI tools',
  agency: 'For police stations & agencies running 10+ cases / month',
};

const Credits = () => {
  const navigate = useNavigate();
  const [packs, setPacks] = useState([]);
  const [custom, setCustom] = useState({ price_per_credit: 5, currency: 'inr', min_credits: 50, max_credits: 10000 });
  const [customCredits, setCustomCredits] = useState('200');
  const [me, setMe] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingPack, setLoadingPack] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [packsRes, profileRes, historyRes] = await Promise.all([
          api.get('/credits/packs'),
          api.get('/auth/profile'),
          api.get('/payments/history?limit=10'),
        ]);
        if (!mounted) return;
        setPacks((packsRes.data || packsRes).packs || []);
        setCustom((packsRes.data || packsRes).custom || custom);
        setMe(profileRes.data || profileRes);
        setHistory((historyRes.data || historyRes).transactions || []);
      } catch (err) {
        console.error('Credits page load failed:', err);
        toast.error('Failed to load credit information');
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCheckout = async (body, key) => {
    setLoadingPack(key);
    try {
      const origin = window.location.origin;
      const res = await api.post('/payments/checkout', { ...body, origin_url: origin });
      const data = res.data || res;
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to start checkout');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(err.response?.data?.detail || 'Checkout failed');
      setLoadingPack(null);
    }
  };

  const buyPack = (pack) => startCheckout({ pack_id: pack.id }, `pack-${pack.id}`);

  const buyCustom = () => {
    const c = parseInt(customCredits, 10);
    if (!c || c < custom.min_credits || c > custom.max_credits) {
      toast.error(`Custom credits must be between ${custom.min_credits} and ${custom.max_credits}`);
      return;
    }
    startCheckout({ custom_credits: c }, 'custom');
  };

  const customAmount = (() => {
    const c = parseInt(customCredits, 10);
    if (!c) return 0;
    return Math.round(c * custom.price_per_credit);
  })();

  return (
    <Layout>
      <div className="max-w-6xl mx-auto" data-testid="credits-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between flex-wrap gap-4"
        >
          <div>
            <h1 className="text-4xl font-heading font-bold text-white text-glow mb-2" data-testid="credits-page-title">
              Buy Credits
            </h1>
            <p className="text-white/60">
              Credits power document generation, OCR, fusion and translation.
            </p>
          </div>
          <div className="glassmorphism rounded-xl px-6 py-3 border border-accent/30" data-testid="current-balance-card">
            <div className="text-xs text-white/50 uppercase tracking-wider">Current balance</div>
            <div className="flex items-center gap-2 mt-1">
              <Zap size={20} className="text-accent" />
              <span className="text-3xl font-heading font-bold text-accent" data-testid="current-balance">
                {me?.credits ?? '—'}
              </span>
              <span className="text-white/50 text-sm">credits</span>
            </div>
          </div>
        </motion.div>

        {/* Packs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" data-testid="credit-packs-grid">
          {packs.map((pack, i) => {
            const Icon = PACK_ICONS[pack.id] || Sparkles;
            const featured = pack.id === 'pro';
            return (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
                className={`glassmorphism rounded-xl p-6 border ${featured ? 'border-accent/40 ring-1 ring-accent/20' : 'border-white/10'} relative`}
                data-testid={`pack-card-${pack.id}`}
              >
                {featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-accent text-black uppercase tracking-wider">
                    Most popular
                  </span>
                )}
                <Icon size={24} className={featured ? 'text-accent' : 'text-white/70'} />
                <h3 className="text-2xl font-heading font-bold text-white mt-3">{pack.label}</h3>
                <div className="mt-4 mb-1">
                  <span className="text-4xl font-bold text-white">₹{pack.amount.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-accent font-semibold text-sm">{pack.credits.toLocaleString('en-IN')} credits</p>
                <p className="text-white/40 text-xs mt-1">
                  ≈ ₹{(pack.amount / pack.credits).toFixed(2)} / credit
                </p>
                <p className="text-white/60 text-sm mt-4 min-h-[40px]">{PACK_HINTS[pack.id] || ''}</p>
                <Button
                  className={`w-full mt-5 ${featured ? 'bg-accent text-black hover:bg-accent/90' : 'bg-white/10 hover:bg-white/15 border border-white/20 text-white'}`}
                  onClick={() => buyPack(pack)}
                  disabled={!!loadingPack}
                  data-testid={`pack-buy-${pack.id}`}
                >
                  {loadingPack === `pack-${pack.id}` ? (
                    <><Loader2 size={16} className="animate-spin mr-2" /> Redirecting…</>
                  ) : (
                    <>Buy {pack.label}</>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Custom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glassmorphism rounded-xl p-6 border border-white/10 mb-8"
          data-testid="custom-credits-card"
        >
          <h3 className="text-xl font-heading font-bold text-white mb-1 flex items-center gap-2">
            <CreditCard size={20} className="text-accent" /> Custom Amount
          </h3>
          <p className="text-white/50 text-sm mb-4">
            ₹{custom.price_per_credit}/credit · min {custom.min_credits}, max {custom.max_credits.toLocaleString('en-IN')}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="text-white/70 text-xs mb-1 block">Number of credits</label>
              <Input
                type="number"
                min={custom.min_credits}
                max={custom.max_credits}
                value={customCredits}
                onChange={(e) => setCustomCredits(e.target.value)}
                className="bg-black/20 border-white/10 text-white"
                data-testid="custom-credits-input"
              />
            </div>
            <div className="text-white">
              <div className="text-xs text-white/50">You'll pay</div>
              <div className="text-2xl font-bold text-accent" data-testid="custom-amount">
                ₹{customAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <Button
              className="bg-accent text-black hover:bg-accent/90"
              onClick={buyCustom}
              disabled={loadingPack === 'custom'}
              data-testid="custom-buy-button"
            >
              {loadingPack === 'custom' ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> Redirecting…</>
              ) : (
                <>Buy custom</>
              )}
            </Button>
          </div>
        </motion.div>

        {/* History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glassmorphism rounded-xl p-6 border border-white/10"
          data-testid="payment-history-card"
        >
          <h3 className="text-xl font-heading font-bold text-white mb-4">Payment history</h3>
          {history.length === 0 ? (
            <p className="text-white/50 text-sm">No purchases yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((t, i) => {
                const color = t.status === 'PAID' ? 'text-success border-success/30 bg-success/5'
                  : t.status === 'EXPIRED' || t.status === 'FAILED' ? 'text-[#FF4655] border-[#FF4655]/30 bg-[#FF4655]/5'
                  : 'text-[#FFB800] border-[#FFB800]/30 bg-[#FFB800]/5';
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${color}`} data-testid={`history-row-${i}`}>
                    <div>
                      <div className="text-white font-semibold text-sm">
                        {t.pack_label || t.pack_id || 'Custom'} · {t.credits} credits
                      </div>
                      <div className="text-white/40 text-xs">
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white">₹{Number(t.amount || 0).toLocaleString('en-IN')}</div>
                      <div className="text-xs uppercase tracking-wider">{t.status}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default Credits;
