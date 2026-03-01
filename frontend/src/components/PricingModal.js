import React from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { subscription } from '../utils/api';

const PricingModal = ({ onClose }) => {
  const [loading, setLoading] = React.useState(false);

  const plans = [
    {
      name: 'Beat Basic',
      price: '₹999',
      period: '/month',
      features: [
        'Up to 50 OCR scans/month',
        'Basic FIR drafting',
        'BNS section lookup',
        'Email support'
      ]
    },
    {
      name: 'Inspector Pro',
      price: '₹2,499',
      period: '/month',
      popular: true,
      features: [
        'Unlimited OCR scans',
        'Advanced FIR drafting',
        'BNS AI analysis',
        'CDR analyzer (up to 10K records)',
        'Audio transcription (100 mins)',
        'Priority support'
      ]
    },
    {
      name: 'Commissionerate Enterprise',
      price: '₹9,999',
      period: '/month',
      features: [
        'Everything in Inspector Pro',
        'Unlimited CDR analysis',
        'Unlimited audio transcription',
        'Multi-language support',
        'API access',
        'Dedicated account manager',
        'Custom integrations'
      ]
    }
  ];

  const handleSelectPlan = async (planName) => {
    setLoading(true);
    try {
      await subscription.update(planName);
      toast.success(`${planName} plan activated!`);
      onClose();
    } catch (err) {
      toast.error('Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="glassmorphism rounded-xl p-8 max-w-6xl w-full border border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="pricing-modal"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-heading font-bold text-white text-glow">Access Plans</h2>
            <p className="text-white/60 mt-2">Choose the plan that fits your investigation needs</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition"
            data-testid="pricing-modal-close-button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-black/40 backdrop-blur-md rounded-lg p-6 border ${
                plan.popular
                  ? 'border-accent shadow-[0_0_30px_rgba(0,242,255,0.3)]'
                  : 'border-white/10'
              }`}
              data-testid={`pricing-plan-${plan.name.toLowerCase().replace(/ /g, '-')}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-black px-4 py-1 rounded-full text-xs font-bold uppercase">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-heading font-bold text-white mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-accent">{plan.price}</span>
                <span className="text-white/60 text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/80 text-sm">
                    <Check size={16} className="text-success mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleSelectPlan(plan.name)}
                disabled={loading}
                data-testid={`select-plan-${plan.name.toLowerCase().replace(/ /g, '-')}-button`}
                className={`w-full ${
                  plan.popular
                    ? 'bg-accent text-black hover:bg-accent/80 shadow-[0_0_15px_rgba(0,242,255,0.4)]'
                    : 'bg-transparent border border-accent/50 text-accent hover:bg-accent/10'
                } font-bold uppercase tracking-wider transition-all rounded-sm`}
              >
                {loading ? 'Processing...' : 'Select Plan'}
              </Button>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-white/60 text-sm text-center">
            Mock payment system for demonstration. All plans include secure data handling and compliance with police protocols.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PricingModal;
