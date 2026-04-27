import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import { Button } from '../components/ui/button';

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 8;  // ~16s

const CreditsSuccess = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session_id');
  const [state, setState] = useState({ status: 'polling', data: null, attempts: 0 });

  useEffect(() => {
    if (!sessionId) {
      setState({ status: 'error', data: { detail: 'Missing session_id' } });
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const res = await api.get(`/payments/status/${sessionId}`);
        const data = res.data || res;
        if (cancelled) return;
        if (data.status === 'PAID') {
          setState({ status: 'paid', data });
          return;
        }
        if (data.status === 'EXPIRED' || data.status === 'FAILED') {
          setState({ status: 'failed', data });
          return;
        }
        // Still pending — keep polling
        if (attempts >= MAX_ATTEMPTS) {
          setState({ status: 'timeout', data });
          return;
        }
        setState({ status: 'polling', data, attempts });
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setState({ status: 'error', data: { detail: err.response?.data?.detail || 'Status check failed' } });
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto" data-testid="credits-success-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glassmorphism rounded-xl p-10 border border-white/10 text-center mt-12"
        >
          {state.status === 'polling' && (
            <>
              <Loader2 className="w-14 h-14 text-accent animate-spin mx-auto mb-5" />
              <h1 className="text-2xl font-heading font-bold text-white mb-2">
                Confirming your payment…
              </h1>
              <p className="text-white/60 text-sm">
                This usually takes a few seconds. Please don't close this page.
              </p>
            </>
          )}

          {state.status === 'paid' && (
            <>
              <div className="w-16 h-16 rounded-full bg-success/15 border border-success/40 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h1 className="text-3xl font-heading font-bold text-white mb-3" data-testid="payment-success-title">
                Payment Successful
              </h1>
              <div className="my-6 inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-accent/10 border border-accent/30">
                <Zap size={22} className="text-accent" />
                <span className="text-2xl font-bold text-accent" data-testid="credits-added">
                  +{state.data?.credits} credits
                </span>
                <span className="text-white/60">added to your account</span>
              </div>
              <p className="text-white/60 text-sm mb-6">
                Receipt: <span className="font-mono text-white/40 text-xs">{sessionId?.slice(0, 24)}…</span>
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={() => navigate('/')}
                  className="bg-accent text-black hover:bg-accent/90"
                  data-testid="success-go-dashboard"
                >
                  Go to Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/credits')}
                  className="border-white/20 text-white hover:bg-white/10"
                  data-testid="success-buy-more"
                >
                  Buy more
                </Button>
              </div>
            </>
          )}

          {(state.status === 'failed' || state.status === 'error' || state.status === 'timeout') && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#FF4655]/15 border border-[#FF4655]/40 flex items-center justify-center mx-auto mb-5">
                <XCircle className="w-8 h-8 text-[#FF4655]" />
              </div>
              <h1 className="text-2xl font-heading font-bold text-white mb-2">
                {state.status === 'timeout' ? 'Confirmation taking longer than expected' : 'Payment not completed'}
              </h1>
              <p className="text-white/60 text-sm mb-6">
                {state.status === 'timeout'
                  ? "We're still checking with the payment provider. Refresh in a minute or visit the Credits page to see your balance."
                  : (state.data?.detail || 'The payment session was not completed. No charge was made if your card was not authorised.')}
              </p>
              <Button
                onClick={() => navigate('/credits')}
                className="bg-accent text-black hover:bg-accent/90"
                data-testid="failed-retry"
              >
                Back to Credits
              </Button>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
};

export default CreditsSuccess;
