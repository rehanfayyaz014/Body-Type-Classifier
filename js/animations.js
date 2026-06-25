/**
 * Animation and UI Enhancement Utilities for FitAI
 */

(function () {
  if (typeof window === 'undefined') return;

  const AnimationManager = {
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
     * Animate view transitions with fade and slide effects
     */
    transitionView(fromView, toView) {
      if (!fromView || !toView) return;

      // Fade out current view
      fromView.style.opacity = '0';
      fromView.style.transform = 'translateY(10px)';
      fromView.style.transition = 'all 0.3s ease-out';

      setTimeout(() => {
        fromView.classList.add('hidden');
        toView.classList.remove('hidden');

        // Fade in new view
        toView.style.opacity = '0';
        toView.style.transform = 'translateY(10px)';
        toView.style.transition = 'all 0s';

        setTimeout(() => {
          toView.style.transition = 'all 0.4s ease-out';
          toView.style.opacity = '1';
          toView.style.transform = 'translateY(0)';

          setTimeout(() => {
            toView.style.transition = '';
          }, 400);
        }, 10);
      }, 300);
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
