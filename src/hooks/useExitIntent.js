import { useState, useEffect, useRef } from 'react';

/**
 * useExitIntent Hook
 * 
 * Detects when user is about to leave the page and triggers exit intent popup
 * Uses multiple signals: mouse movement toward top of page, tab visibility changes
 */
export const useExitIntent = (options = {}) => {
  const {
    sensitivity = 20,           // How close to top edge triggers exit intent
    delay = 1000,              // Minimum time on page before showing popup
    showOnce = true,           // Only show popup once per session
    enabled = true             // Enable/disable the hook
  } = options;

  const [showExitIntent, setShowExitIntent] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const timeOnPage = useRef(0);
  const isMouseOut = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Check if we've already shown the popup in this session
    const hasShownInSession = sessionStorage.getItem('exitIntentShown');
    if (showOnce && hasShownInSession) {
      console.log('[exit-intent] already shown this session — skipping. Run sessionStorage.removeItem("exitIntentShown") in the console and reload to retest.');
      setHasShown(true);
      return;
    }
    console.log('[exit-intent] armed — listening for mouse-to-top, tab switch, and unload');

    // Track time on page
    const startTime = Date.now();

    const handleMouseMove = (e) => {
      timeOnPage.current = Date.now() - startTime;

      // Only trigger if user has been on page for minimum delay
      if (timeOnPage.current < delay) return;

      // Only trigger if we haven't shown popup yet
      if (hasShown) return;

      // Detect mouse movement toward top of screen (exit intent)
      if (e.clientY <= sensitivity && e.clientY >= 0) {
        console.log('[exit-intent] mousemove trigger, clientY=', e.clientY);
        setShowExitIntent(true);
        setHasShown(true);
        if (showOnce) {
          sessionStorage.setItem('exitIntentShown', 'true');
        }
      }
    };

    const handleMouseLeave = (e) => {
      timeOnPage.current = Date.now() - startTime;
      console.log('[exit-intent] mouseleave event, clientY=', e.clientY, 'timeOnPage=', timeOnPage.current, 'delay=', delay, 'hasShown=', hasShown);

      // Only trigger if user has been on page for minimum delay
      if (timeOnPage.current < delay) return;

      // Only trigger if we haven't shown popup yet
      if (hasShown) return;

      // Check if mouse left the viewport through the top
      if (e.clientY <= 0) {
        isMouseOut.current = true;
        setTimeout(() => {
          if (isMouseOut.current) {
            console.log('[exit-intent] mouseleave trigger confirmed');
            setShowExitIntent(true);
            setHasShown(true);
            if (showOnce) {
              sessionStorage.setItem('exitIntentShown', 'true');
            }
          }
        }, 100);
      }
    };

    const handleMouseEnter = () => {
      isMouseOut.current = false;
    };

    // Handle tab visibility change (user switching tabs)
    const handleVisibilityChange = () => {
      timeOnPage.current = Date.now() - startTime;
      
      if (document.hidden && 
          timeOnPage.current >= delay && 
          !hasShown) {
        // User switched tabs - could be exit intent
        setTimeout(() => {
          if (document.hidden) {
            setShowExitIntent(true);
            setHasShown(true);
            if (showOnce) {
              sessionStorage.setItem('exitIntentShown', 'true');
            }
          }
        }, 500);
      }
    };

    // Handle beforeunload (user actually leaving)
    const handleBeforeUnload = () => {
      timeOnPage.current = Date.now() - startTime;
      
      if (timeOnPage.current >= delay && !hasShown) {
        setShowExitIntent(true);
        setHasShown(true);
        if (showOnce) {
          sessionStorage.setItem('exitIntentShown', 'true');
        }
      }
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, sensitivity, delay, showOnce, hasShown]);

  const hideExitIntent = () => {
    setShowExitIntent(false);
  };

  const resetExitIntent = () => {
    setHasShown(false);
    setShowExitIntent(false);
    sessionStorage.removeItem('exitIntentShown');
  };

  return {
    showExitIntent,
    hideExitIntent,
    resetExitIntent,
    hasShown,
    timeOnPage: timeOnPage.current
  };
};