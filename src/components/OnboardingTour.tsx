import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, X, Sparkles, Target } from 'lucide-react';

interface TourStep {
  targetId?: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const OnboardingTour: React.FC = () => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const steps: TourStep[] = [
    {
      title: "Welcome to FinLev!",
      content: "Your powerful personal finance dashboard. Let's take a quick 1-minute tour to get you started.",
      position: 'center'
    },
    {
      targetId: 'nav-overview',
      title: "Dashboard Overview",
      content: "This is where you'll see your high-level metrics, cash flow trends, and predictive forecasts.",
      position: 'bottom'
    },
    {
      targetId: 'nav-import',
      title: "Import Your Data",
      content: "Already have transactions in a CSV or from Ivy Wallet? Import them here to get started instantly.",
      position: 'bottom'
    },
    {
      targetId: 'nav-accounts',
      title: "Manage Accounts",
      content: "Track multiple bank accounts, cash, and credit cards in any currency. We handle the conversions for you.",
      position: 'bottom'
    },
    {
      targetId: 'nav-reports',
      title: "Deep Insights",
      content: "Visualize your spending habits over time with powerful charts and exportable PDF reports.",
      position: 'bottom'
    },
    {
      targetId: 'ai-chat-trigger',
      title: "AI Financial Advisor",
      content: "Have questions about your spending? Ask our AI assistant for personalized advice and analysis.",
      position: 'left'
    }
  ];

  useEffect(() => {
    const hasCompletedTour = localStorage.getItem('finlev_onboarding_completed');
    if (!hasCompletedTour) {
      // Delay slightly to ensure layout is ready
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (isVisible && steps[currentStep]?.targetId) {
      const updateRect = () => {
        const el = document.getElementById(steps[currentStep].targetId!);
        if (el) {
          setTargetRect(el.getBoundingClientRect());
        } else {
          setTargetRect(null);
        }
      };

      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect);
      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect);
      };
    } else {
      setTargetRect(null);
    }
  }, [isVisible, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeTour = () => {
    localStorage.setItem('finlev_onboarding_completed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Overlay with hole */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-500" 
           style={{ 
             maskImage: targetRect 
               ? `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent ${Math.max(targetRect.width, targetRect.height) / 2 + 10}px, black ${Math.max(targetRect.width, targetRect.height) / 2 + 15}px)`
               : 'none',
             WebkitMaskImage: targetRect 
               ? `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent ${Math.max(targetRect.width, targetRect.height) / 2 + 10}px, black ${Math.max(targetRect.width, targetRect.height) / 2 + 15}px)`
               : 'none'
           }}
      />

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            y: 0,
            left: targetRect 
              ? (step.position === 'left' ? targetRect.left - 340 : targetRect.left + targetRect.width / 2 - 160)
              : '50%',
            top: targetRect
              ? (step.position === 'bottom' ? targetRect.bottom + 20 : targetRect.top - 200)
              : '50%',
            translateX: targetRect ? 0 : '-50%',
            translateY: targetRect ? 0 : '-50%',
          }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="absolute w-[320px] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 pointer-events-auto z-[201]"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
              {step.targetId ? <Target className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <button 
              onClick={completeTour}
              className="p-1 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {step.content}
          </p>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 rounded-full transition-all ${i === currentStep ? 'w-4 bg-emerald-500' : 'w-1.5 bg-slate-800'}`} 
                />
              ))}
            </div>

            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
