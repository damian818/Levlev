import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, X, Sparkles, Target, Compass, Layers } from 'lucide-react';

export interface OnboardingTourProps {
  hasExistingData?: boolean;
  onCompleteTour?: () => void;
}

interface TourStep {
  targetId?: string;
  titleKey: string;
  defaultTitle: string;
  contentKey: string;
  defaultContent: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  hasExistingData = false,
  onCompleteTour,
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  const steps: TourStep[] = [
    {
      titleKey: 'onboarding.welcome_title',
      defaultTitle: 'Welcome to LevLev!',
      contentKey: 'onboarding.welcome_desc',
      defaultContent: "Your personal finance companion for multi-currency & inflation intelligence. Let's take a quick tour to get you started.",
      position: 'center'
    },
    {
      targetId: 'nav-overview',
      titleKey: 'onboarding.overview_title',
      defaultTitle: 'Dashboard Overview',
      contentKey: 'onboarding.overview_desc',
      defaultContent: 'Track your real-time net worth, cash flow trends, monthly analytics, and inflation metrics all in one place.',
      position: 'bottom'
    },
    {
      targetId: 'nav-import',
      titleKey: 'onboarding.import_title',
      defaultTitle: 'Import Your Data',
      contentKey: 'onboarding.import_desc',
      defaultContent: 'Import transactions easily from CSV files or previous apps to start visualizing your history immediately.',
      position: 'bottom'
    },
    {
      targetId: 'nav-accounts',
      titleKey: 'onboarding.accounts_title',
      defaultTitle: 'Manage Accounts & Cards',
      contentKey: 'onboarding.accounts_desc',
      defaultContent: 'Organize bank accounts, cash, and credit cards across currencies (ARS/USD). Reorder, hide, or classify them anytime.',
      position: 'bottom'
    },
    {
      targetId: 'nav-reports',
      titleKey: 'onboarding.reports_title',
      defaultTitle: 'Deep Financial Reports',
      contentKey: 'onboarding.reports_desc',
      defaultContent: 'Explore interactive cash flow charts, category breakdown donuts, and exportable PDF summaries.',
      position: 'bottom'
    },
    {
      targetId: 'ai-chat-trigger',
      titleKey: 'onboarding.ai_title',
      defaultTitle: 'AI Financial Advisor',
      contentKey: 'onboarding.ai_desc',
      defaultContent: 'Ask our Gemini-powered AI advisor questions about your spending patterns, savings rate, and financial health.',
      position: 'left'
    }
  ];

  const completeTour = useCallback(() => {
    try {
      localStorage.setItem('levlev_onboarding_completed', 'true');
      localStorage.setItem('finlev_onboarding_completed', 'true');
      localStorage.setItem('finance_app_onboarding_completed', 'true');
    } catch (e) {}
    setIsVisible(false);
    if (onCompleteTour) {
      onCompleteTour();
    }
  }, [onCompleteTour]);

  // Check tour completion status on mount
  useEffect(() => {
    try {
      const isLevLevDone = localStorage.getItem('levlev_onboarding_completed') === 'true';
      const isFinLevDone = localStorage.getItem('finlev_onboarding_completed') === 'true';
      const isOldDone = localStorage.getItem('finance_app_onboarding_completed') === 'true';

      if (isLevLevDone || isFinLevDone || isOldDone || hasExistingData) {
        // Already completed or has existing user data -> mark completed & never show
        localStorage.setItem('levlev_onboarding_completed', 'true');
        localStorage.setItem('finlev_onboarding_completed', 'true');
        setIsVisible(false);
        return;
      }

      // First time user with empty data -> display tour smoothly after layout settles
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    } catch (e) {
      setIsVisible(false);
    }
  }, [hasExistingData]);

  // Track window resizing
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update target element bounding rect
  useEffect(() => {
    if (isVisible && steps[currentStep]?.targetId) {
      const updateRect = () => {
        const targetId = steps[currentStep].targetId!;
        const el = document.getElementById(targetId);
        if (el && el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setTargetRect(rect);
            return;
          }
        }
        setTargetRect(null);
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

  if (!isVisible) return null;

  const step = steps[currentStep];
  const isMobile = windowDimensions.width < 768;
  const modalWidth = Math.min(360, windowDimensions.width - 32);

  // Safe calculated position on desktop
  const getDesktopCoordinates = () => {
    if (!targetRect) {
      return {
        left: '50%',
        top: '50%',
        translateX: '-50%',
        translateY: '-50%',
      };
    }

    const margin = 16;
    const estimatedHeight = 260;

    let targetLeft = targetRect.left + (targetRect.width - modalWidth) / 2;
    let targetTop = targetRect.bottom + 16;

    if (step.position === 'left') {
      targetLeft = targetRect.left - modalWidth - 16;
      targetTop = targetRect.top + (targetRect.height - estimatedHeight) / 2;
    } else if (step.position === 'top') {
      targetTop = targetRect.top - estimatedHeight - 16;
    }

    // Clamp inside viewport
    const clampedLeft = Math.max(margin, Math.min(windowDimensions.width - modalWidth - margin, targetLeft));
    const clampedTop = Math.max(margin, Math.min(windowDimensions.height - estimatedHeight - margin, targetTop));

    return {
      left: `${clampedLeft}px`,
      top: `${clampedTop}px`,
      translateX: '0%',
      translateY: '0%',
    };
  };

  const desktopPos = getDesktopCoordinates();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
      {/* Dimmed backdrop with spotlight hole if target is visible */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto transition-opacity duration-300"
        style={{
          maskImage: (!isMobile && targetRect)
            ? `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent ${Math.max(targetRect.width, targetRect.height) / 2 + 8}px, black ${Math.max(targetRect.width, targetRect.height) / 2 + 14}px)`
            : 'none',
          WebkitMaskImage: (!isMobile && targetRect)
            ? `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent ${Math.max(targetRect.width, targetRect.height) / 2 + 8}px, black ${Math.max(targetRect.width, targetRect.height) / 2 + 14}px)`
            : 'none'
        }}
        onClick={completeTour}
      />

      {/* Target Element Highlight Ring on Mobile/Desktop */}
      {targetRect && (
        <div 
          className="absolute border-2 border-emerald-400/80 rounded-2xl pointer-events-none shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all duration-300 z-[200]"
          style={{
            left: `${Math.max(4, targetRect.left - 6)}px`,
            top: `${Math.max(4, targetRect.top - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        />
      )}

      {/* Step Card Dialog */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.95, y: isMobile ? 40 : 15 }}
          animate={
            isMobile
              ? { opacity: 1, scale: 1, y: 0 }
              : {
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  left: desktopPos.left,
                  top: desktopPos.top,
                  transform: `translate(${desktopPos.translateX}, ${desktopPos.translateY})`,
                }
          }
          exit={{ opacity: 0, scale: 0.95, y: isMobile ? 30 : 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={
            isMobile
              ? "fixed bottom-20 left-4 right-4 max-w-sm mx-auto bg-slate-900/98 border border-slate-700/90 rounded-3xl shadow-2xl p-5 pointer-events-auto z-[201] backdrop-blur-xl"
              : "absolute w-[360px] bg-slate-900/98 border border-slate-700/90 rounded-3xl shadow-2xl p-6 pointer-events-auto z-[201] backdrop-blur-xl"
          }
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-sm">
                {step.targetId ? <Target className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400/90">
                {t('onboarding.step_badge', { defaultValue: `Step ${currentStep + 1} of ${steps.length}`, step: currentStep + 1, total: steps.length })}
              </span>
            </div>
            <button 
              onClick={completeTour}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title={t('onboarding.skip', { defaultValue: 'Skip Tour' })}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title and Content */}
          <h3 className="text-base sm:text-lg font-extrabold text-white mb-1.5 tracking-tight">
            {t(step.titleKey, { defaultValue: step.defaultTitle })}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed">
            {t(step.contentKey, { defaultValue: step.defaultContent })}
          </p>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-3.5 border-t border-slate-800/80">
            {/* Step Dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    i === currentStep ? 'w-5 bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'w-1.5 bg-slate-700 hover:bg-slate-600'
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              {currentStep > 0 ? (
                <button
                  onClick={handlePrev}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{t('onboarding.back', { defaultValue: 'Back' })}</span>
                </button>
              ) : (
                <button
                  onClick={completeTour}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                >
                  {t('onboarding.skip', { defaultValue: 'Skip' })}
                </button>
              )}

              <button
                onClick={handleNext}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                <span>
                  {currentStep === steps.length - 1
                    ? t('onboarding.get_started', { defaultValue: 'Get Started' })
                    : t('onboarding.next', { defaultValue: 'Next' })}
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

