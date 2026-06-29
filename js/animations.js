/**
 * Animation and UI Enhancement Utilities for FitAI
 */

(function () {
  if (typeof window === 'undefined') return;

  const TRANSITION_MS = 420;
  const BLUR_OUT = '6px';
  const BLUR_IN = '8px';
  const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function clearTransitionStyles(el) {
    if (!el) return;
    el.style.transition = '';
    el.style.opacity = '';
    el.style.transform = '';
    el.style.filter = '';
    el.style.pointerEvents = '';
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function applyInstantSwap(fromEl, toEl) {
    if (fromEl) {
      fromEl.classList.add('hidden');
      clearTransitionStyles(fromEl);
    }
    if (toEl) {
      toEl.classList.remove('hidden');
      clearTransitionStyles(toEl);
    }
  }

  function blurSwap(fromEl, toEl) {
    return new Promise(function (resolve) {
      if (!toEl) {
        resolve();
        return;
      }

      if (prefersReducedMotion() || !fromEl || fromEl === toEl || fromEl.classList.contains('hidden')) {
        applyInstantSwap(fromEl, toEl);
        resolve();
        return;
      }

      fromEl.style.pointerEvents = 'none';
      fromEl.style.transition = 'opacity ' + TRANSITION_MS + 'ms ' + EASING + ', transform ' + TRANSITION_MS + 'ms ' + EASING + ', filter ' + TRANSITION_MS + 'ms ' + EASING;

      requestAnimationFrame(function () {
        fromEl.style.opacity = '0';
        fromEl.style.transform = 'translateY(8px)';
        fromEl.style.filter = 'blur(' + BLUR_OUT + ')';
      });

      wait(TRANSITION_MS).then(function () {
        fromEl.classList.add('hidden');
        clearTransitionStyles(fromEl);

        toEl.classList.remove('hidden');
        toEl.style.opacity = '0';
        toEl.style.transform = 'translateY(10px)';
        toEl.style.filter = 'blur(' + BLUR_IN + ')';
        toEl.style.transition = 'none';

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            toEl.style.transition = 'opacity ' + TRANSITION_MS + 'ms ' + EASING + ', transform ' + TRANSITION_MS + 'ms ' + EASING + ', filter ' + TRANSITION_MS + 'ms ' + EASING;
            toEl.style.opacity = '1';
            toEl.style.transform = 'translateY(0)';
            toEl.style.filter = 'blur(0)';

            wait(TRANSITION_MS).then(function () {
              clearTransitionStyles(toEl);
              resolve();
            });
          });
        });
      });
    });
  }

  const AnimationManager = {
    TRANSITION_MS: TRANSITION_MS,

    /**
     * Soft blur transition between two full views
     */
    swapViews(fromEl, toEl) {
      return blurSwap(fromEl, toEl);
    },

    /**
     * Soft blur transition between panels inside a view
     */
    swapPanels(fromEl, toEl) {
      return blurSwap(fromEl, toEl);
    },

    /**
     * Enter animation for a newly shown view
     */
    enterView(el) {
      return new Promise(function (resolve) {
        if (!el || prefersReducedMotion()) {
          resolve();
          return;
        }

        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.style.filter = 'blur(' + BLUR_IN + ')';
        el.style.transition = 'none';

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            el.style.transition = 'opacity ' + TRANSITION_MS + 'ms ' + EASING + ', transform ' + TRANSITION_MS + 'ms ' + EASING + ', filter ' + TRANSITION_MS + 'ms ' + EASING;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            el.style.filter = 'blur(0)';

            wait(TRANSITION_MS).then(function () {
              clearTransitionStyles(el);
              resolve();
            });
          });
        });
      });
    },

    /**
     * Page enter for full-page shells (dashboard, landing)
     */
    pageEnter(rootEl) {
      if (!rootEl || prefersReducedMotion()) return;
      rootEl.classList.add('page-enter');
    },

    /**
     * Navigate away with a soft blur fade
     */
    navigateTo(url) {
      if (!url) return;
      if (prefersReducedMotion()) {
        window.location.href = url;
        return;
      }

      var root = document.getElementById('app') || document.body;
      root.classList.add('page-exit');

      wait(TRANSITION_MS).then(function () {
        window.location.href = url;
      });
    },

    /**
     * Legacy helper — delegates to swapViews
     */
    transitionView(fromView, toView) {
      return blurSwap(fromView, toView);
    },

    /**
     * Update progress bar and step indicator
     * @param {number} currentStep - Current step (0-6)
     * @param {number} totalSteps - Total steps (7)
     */
    updateProgress(currentStep, totalSteps) {
      const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);
      const fillWidth = ((currentStep + 1) / totalSteps) * 100;

      // Update progress bar fill with smooth animation
      const progressFill = document.getElementById('progress-fill');
      if (progressFill) {
        progressFill.style.width = fillWidth + '%';
      }

      // Update percentage display
      const progressPercentEl = document.getElementById('progress-percent');
      if (progressPercentEl) {
        progressPercentEl.textContent = progressPercent + '%';
      }

      // Update step number with pulse animation
      const stepNum = document.getElementById('step-num');
      if (stepNum) {
        stepNum.textContent = currentStep + 1;
        this.addPulseEffect(stepNum);
      }

      // Update step markers
      for (let i = 1; i < totalSteps; i++) {
        const marker = document.getElementById(`marker-${i}`);
        if (marker) {
          if (i <= currentStep) {
            marker.className = 'h-1 flex-1 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 opacity-100 shadow-md transition-all duration-500';
          } else {
            marker.className = 'h-1 flex-1 rounded-full bg-white/15 transition-all duration-500';
          }
        }
      }

      // Update progress bar role and aria attributes
      const quizProgress = document.getElementById('quiz-progress');
      if (quizProgress) {
        quizProgress.setAttribute('aria-valuenow', progressPercent);
      }
    },

    /**
     * Update plan module progress bar (matches classifier styling)
     */
    updatePlanProgress(currentStep, totalSteps) {
      const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);
      const fillWidth = ((currentStep + 1) / totalSteps) * 100;

      const progressFill = document.getElementById('plan-progress-fill');
      if (progressFill) {
        progressFill.style.width = fillWidth + '%';
      }

      const progressPercentEl = document.getElementById('plan-progress-percent');
      if (progressPercentEl) {
        progressPercentEl.textContent = progressPercent + '%';
      }

      const stepNum = document.getElementById('plan-step-num');
      if (stepNum) {
        stepNum.textContent = currentStep + 1;
        this.addPulseEffect(stepNum);
      }

      for (let i = 1; i < totalSteps; i++) {
        const marker = document.getElementById(`plan-marker-${i}`);
        if (marker) {
          if (i <= currentStep) {
            marker.className = 'h-1 flex-1 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 opacity-100 shadow-md transition-all duration-500';
          } else {
            marker.className = 'h-1 flex-1 rounded-full bg-white/15 transition-all duration-500';
          }
        }
      }
    },

    /**
     * Add subtle pulse animation to an element
     */
    addPulseEffect(element) {
      if (!element) return;
      element.style.animation = 'pulse 0.6s ease-out';
      setTimeout(() => {
        element.style.animation = '';
      }, 600);
    },

    /**
     * Ripple effect on button click
     */
    createRipple(event) {
      const button = event.currentTarget;
      const diameter = Math.max(button.clientWidth, button.clientHeight);
      const radius = diameter / 2;

      const circle = document.createElement('span');
      circle.style.width = circle.style.height = diameter + 'px';
      circle.style.left = event.clientX - button.offsetLeft - radius + 'px';
      circle.style.top = event.clientY - button.offsetTop - radius + 'px';
      circle.classList.add('ripple');

      const ripple = button.querySelector('.ripple');
      if (ripple) {
        ripple.remove();
      }

      button.appendChild(circle);
    },

    /**
     * Smooth scroll to view
     */
    scrollToView(element, smooth = true) {
      if (!element) return;
      element.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    },

    /**
     * Add stagger animation to cards/list items
     */
    staggerElements(selector, delay = 50) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el, index) => {
        el.style.animationDelay = (index * delay) + 'ms';
        el.classList.add('animate-slideUp');
      });
    },

    /**
     * Handle dark/light mode toggle with smooth transition
     */
    toggleTheme(isDark) {
      const html = document.documentElement;
      const body = document.body;
      const themeIcon = document.getElementById('btn-theme');
      const sunIcon = themeIcon?.querySelector('.icon-sun');
      const moonIcon = themeIcon?.querySelector('.icon-moon');

      if (isDark) {
        body.classList.remove('theme-light');
        body.classList.add('theme-dark');
        if (sunIcon) sunIcon.classList.remove('hidden');
        if (moonIcon) moonIcon.classList.add('hidden');
      } else {
        body.classList.remove('theme-dark');
        body.classList.add('theme-light');
        if (sunIcon) sunIcon.classList.add('hidden');
        if (moonIcon) moonIcon.classList.remove('hidden');
      }

      // Add transition class
      body.style.transition = 'background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), color 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      setTimeout(() => {
        body.style.transition = '';
      }, 400);
    },

    /**
     * Show/hide loading overlay with animation
     */
    showLoading(show = true) {
      const overlay = document.getElementById('predict-overlay');
      if (!overlay) return;

      if (show) {
        overlay.classList.remove('hidden');
        setTimeout(() => {
          overlay.style.opacity = '1';
        }, 10);
      } else {
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.classList.add('hidden');
        }, 300);
      }
    },

    /**
     * Animate option card selection
     */
    animateOptionSelect(card) {
      if (!card) return;

      // Add selected class and animation
      card.classList.add('selected');
      card.style.animation = 'none';
      setTimeout(() => {
        card.style.animation = 'slideUp 0.3s ease-out';
      }, 10);

      // Deselect sibling cards with fade animation
      const siblings = card.parentElement?.querySelectorAll('.opt-card');
      if (siblings) {
        siblings.forEach(sibling => {
          if (sibling !== card && sibling.classList.contains('selected')) {
            sibling.classList.remove('selected');
            sibling.style.animation = 'fadeOut 0.2s ease-out';
            setTimeout(() => {
              sibling.style.animation = '';
            }, 200);
          }
        });
      }
    },

    /**
     * Add hover scale effect to interactive elements
     */
    initHoverEffects() {
      const interactiveElements = document.querySelectorAll('.opt-card, .btn, .chip');
      interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', (e) => {
          if (e.target.matches('.opt-card, .btn, .chip')) {
            e.target.style.transform = 'translateY(-4px) scale(1.02)';
          }
        });
        el.addEventListener('mouseleave', (e) => {
          if (e.target.matches('.opt-card, .btn, .chip')) {
            e.target.style.transform = '';
          }
        });
      });
    },

    /**
     * Accessibility: Announce progress to screen readers
     */
    announceProgress(step, total) {
      const message = `Step ${step} of ${total}. ${Math.round((step / total) * 100)}% complete.`;
      this.announceToScreenReader(message);
    },

    /**
     * Helper: Announce to screen readers
     */
    announceToScreenReader(message) {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      document.body.appendChild(announcement);

      setTimeout(() => {
        announcement.remove();
      }, 1000);
    },
  };

  // Expose to window
  window.AnimationManager = AnimationManager;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      AnimationManager.initHoverEffects();
    });
  } else {
    AnimationManager.initHoverEffects();
  }
})();
