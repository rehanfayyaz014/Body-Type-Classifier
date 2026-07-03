                                                                                    (function () {
  const I18N = window.FitAIStrings;
  if (!I18N) return;

  const STORAGE_LANG = "fitai-lang";
  const STORAGE_THEME = "fitai-theme";
  const STORAGE_PROFILE = "fitai-profile";
  const SESSION_PREFILL_HANDOFF = "fitai-prefill-plan";

  const CLASSIFIER_STEPS = 7;
  const PLAN_STEPS = 5;
  const QUIZ_STEPS = CLASSIFIER_STEPS;

  const state = {
    module: null,
    view: "landing",
    previousView: null,
    step: 0,
    planStep: 0,
    answers: {
      gender: null,
      shape: null,
      weightGain: null,
      muscleEffect: null,
      bellyFat: null,
      height: 170,
      weight: 70,
    },
    bodyTypeKey: null,
    bmi: null,
    detailGoal: null,
    activityLevel: null,
    workoutPreference: null,
    lang: "en",
    theme: "dark",
    apiBusy: false,
  };

  function getApiBase() {
    if (typeof window === "undefined") return "http://127.0.0.1:5000";
    var b = window.FITAI_API_BASE;
    if (b === "" || b === null) return "";
    if (b !== undefined) return String(b).replace(/\/$/, "");
    var o = window.location.origin || "";
    if (o && o !== "null" && o.indexOf("file") !== 0) return "";
    return "http://127.0.0.1:5000";
  }

  function predictUrl() {
    var base = getApiBase();
    return base === "" ? "/predict" : base + "/predict";
  }

  function normalizeBodyType(raw) {
    var k = String(raw || "")
      .toLowerCase()
      .trim();
    if (k === "ectomorph" || k === "mesomorph" || k === "endomorph") return k;
    return "mesomorph";
  }

  function getQueryModule() {
    return new URLSearchParams(window.location.search).get("module");
  }

  function saveProfile() {
    var profileData = {
      bodyTypeKey: state.bodyTypeKey,
      bmi: state.bmi,
      gender: state.answers.gender,
      height_cm: state.answers.height,
      weight_kg: state.answers.weight,
      goal: state.detailGoal,
      activityLevel: state.activityLevel,
      workoutPreference: state.workoutPreference,
    };

    localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profileData));

    // Agar user logged in hai, Supabase mein bhi save karo
    if (window.FitAIAuth) {
      window.FitAIAuth.getCurrentUser().then(function (user) {
        if (!user || !window.FitAISupabase) return;

        window.FitAISupabase
          .from("body_type_history")
          .insert({
            user_id: user.id,
            body_type: profileData.bodyTypeKey,
            bmi: profileData.bmi || 0,
            height_cm: profileData.height_cm || 0,
            weight_kg: profileData.weight_kg || 0,
            goal: profileData.goal || null,
            activity_level: profileData.activityLevel || null,
            workout_preference: profileData.workoutPreference || null,
          })
          .then(function (res) {
            if (res.error) console.error("Supabase save failed:", res.error);
          });

        // Profile table mein latest height/weight/gender bhi update kar do
        window.FitAISupabase
          .from("profiles")
          .update({
            gender: profileData.gender || null,
            height_cm: profileData.height_cm || null,
            weight_kg: profileData.weight_kg || null,
          })
          .eq("id", user.id)
          .then(function () {});
      });
    }
  }

  function clearAssessmentStorage() {
    localStorage.removeItem(STORAGE_PROFILE);
  }

  function clearProfile() {
    clearAssessmentStorage();
    if (window.FitAITrackingState && window.FitAITrackingState.clearAllTrackingData) {
      window.FitAITrackingState.clearAllTrackingData();
    }
  }

  function loadProfile() {
    try {
      var raw = localStorage.getItem(STORAGE_PROFILE);
      if (!raw) return;
      var p = JSON.parse(raw);
      if (p.bodyTypeKey) state.bodyTypeKey = normalizeBodyType(p.bodyTypeKey);
      if (typeof p.bmi === "number" && !isNaN(p.bmi)) state.bmi = p.bmi;
      if (p.gender === "male" || p.gender === "female") state.answers.gender = p.gender;
    } catch (e) {
      /* ignore */
    }
  }

  function goDashboard() {
    if (window.AnimationManager) {
      window.AnimationManager.navigateTo("/dashboard");
    } else {
      window.location.href = "/dashboard";
    }
  }

  function clearAllCardSelections() {
    document.querySelectorAll(".opt-card").forEach(function (card) {
      card.classList.remove("is-selected", "selected");
      card.style.animation = "";
      card.style.transform = "";
      card.style.opacity = "";
    });
  }

  function $(id) {
    return document.getElementById(id);
  }

  function getStrings() {
    return I18N[state.lang] || I18N.en;
  }

  function getPlansBundle() {
    const s = getStrings();
    if (s.plans && s.plans.ectomorph) return s.plans;
    return I18N.en.plans;
  }

  function setLang(lang) {
    if (!I18N[lang]) lang = "en";
    state.lang = lang;
    localStorage.setItem(STORAGE_LANG, lang);
    document.documentElement.lang = lang === "ur" ? "ur" : "en";
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
    document.body.dir = document.documentElement.dir;
    applyI18n();
    refreshDynamicCopy();
  }

  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem(STORAGE_THEME, theme);
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme === "dark");
    const sun = $("btn-theme")?.querySelector(".icon-sun");
    const moon = $("btn-theme")?.querySelector(".icon-moon");
    if (sun && moon) {
      sun.classList.toggle("hidden", theme === "light");
      moon.classList.toggle("hidden", theme === "dark");
    }
    // Add smooth theme transition
    if (window.AnimationManager) {
      window.AnimationManager.toggleTheme(theme === "dark");
    }
  }

  function applyI18n() {
    const s = getStrings();
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      const key = node.getAttribute("data-i18n");
      if (!key || !s[key]) return;
      if (/<\s*br/i.test(s[key])) node.innerHTML = s[key];
      else node.textContent = s[key];
    });
    const brand = $("brand-title");
    if (brand && s.brand) brand.textContent = s.brand;
    document.title = (s.brand || "FitAI") + " — Body & Training Plan";
  }

  function refreshDynamicCopy() {
    if (state.view === "quiz") renderQuiz();
    if (state.view === "plan") renderPlanWizard();
    if (state.view === "result" && state.bodyTypeKey) renderResultBody();
    if (state.view === "detail") {
      renderDetailSelectors();
      if (
        state.detailGoal &&
        state.activityLevel &&
        state.workoutPreference &&
        $("detail-plan-phase") &&
        !$("detail-plan-phase").classList.contains("hidden")
      ) {
        renderPlanPhase();
      }
    }
    updateLangMenuSelection();
  }

  function updateLangMenuSelection() {
    document.querySelectorAll(".dropdown__opt").forEach(function (btn) {
      const l = btn.getAttribute("data-lang");
      btn.classList.toggle("is-selected", l === state.lang);
    });
  }

  function calcBmi(hCm, wKg) {
    const m = hCm / 100;
    if (m <= 0) return 0;
    return wKg / (m * m);
  }

  /**
   * Backend stores only A/B/C per question. Labels are i18n-only.
   * Scoring: A → ectomorph, B → mesomorph, C → endomorph bias (weighted) + BMI nudge.
   */
  function classifyBodyType(bmiVal, a) {
    var E = 0,
      M = 0,
      N = 0;
    function tri(letter, w) {
      if (letter === "A") E += w;
      else if (letter === "B") M += w;
      else if (letter === "C") N += w;
    }
    tri(a.shape, 3);
    tri(a.weightGain, 2);
    tri(a.muscleEffect, 2);
    tri(a.bellyFat, 2);
    if (bmiVal < 18.5) E += 3;
    else if (bmiVal < 20) E += 1;
    else if (bmiVal >= 33) N += 4;
    else if (bmiVal >= 28) N += 3;
    else if (bmiVal >= 25) N += 1;
    else if (bmiVal >= 22 && bmiVal <= 24) M += 1;

    var rank = [
      { key: "ectomorph", s: E },
      { key: "mesomorph", s: M },
      { key: "endomorph", s: N },
    ];
    rank.sort(function (x, y) {
      return y.s - x.s;
    });
    if (rank[0].s === rank[1].s) {
      var pref = { A: "ectomorph", B: "mesomorph", C: "endomorph" };
      return pref[a.shape] || "mesomorph";
    }
    return rank[0].key;
  }

  var VIEW_IDS = {
    landing: "view-landing",
    quiz: "view-quiz",
    plan: "view-plan",
    result: "view-result",
    detail: "view-detail",
  };

  function getViewEl(name) {
    var id = VIEW_IDS[name];
    return id ? $(id) : null;
  }

  function setViewVisibility(name) {
    Object.keys(VIEW_IDS).forEach(function (viewName) {
      var el = getViewEl(viewName);
      if (el) el.classList.toggle("hidden", viewName !== name);
    });
  }

  function finishBooting() {
    document.documentElement.classList.remove("fitai-booting");
  }

  function bootModuleView(name) {
    state.previousView = "landing";
    state.view = name;
    setViewVisibility(name);
    updateHeaderNav();
    finishBooting();
    var toEl = getViewEl(name);
    if (window.AnimationManager && toEl) {
      return window.AnimationManager.enterView(toEl);
    }
    return Promise.resolve();
  }

  function showView(name) {
    if (state.view === name) {
      setViewVisibility(name);
      updateHeaderNav();
      return;
    }

    var previous = state.view;
    var fromEl = getViewEl(previous);
    var toEl = getViewEl(name);
    state.previousView = previous;
    state.view = name;

    function finish() {
      updateHeaderNav();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (document.documentElement.classList.contains("fitai-booting")) {
      setViewVisibility(name);
      finishBooting();
      if (window.AnimationManager && toEl) {
        window.AnimationManager.enterView(toEl).then(finish);
      } else {
        finish();
      }
      return;
    }

    if (window.AnimationManager && fromEl && toEl) {
      window.AnimationManager.swapViews(fromEl, toEl).then(finish);
      return;
    }

    setViewVisibility(name);
    finish();
  }

  function updateHeaderNav() {
    var inFlow = state.view !== "landing";
    var back = $("btn-back");
    var dash = $("btn-dashboard");
    if (back) back.classList.toggle("hidden", !inFlow);
    if (dash) dash.classList.toggle("hidden", !inFlow);
    if (dash) dash.setAttribute("aria-label", getStrings().dashAriaLabel || "Dashboard");
  }

  function goLanding() {
    $("view-result")?.classList.remove("view-result-animate");
    showView("landing");
    state.step = 0;
    state.detailGoal = null;
    resetGoalPhase();
    resetAllAssessmentData();
  }

  function isPageReload() {
    var nav = performance.getEntriesByType("navigation")[0];
    return !!(nav && nav.type === "reload");
  }

  function consumePrefillHandoff() {
    var flagged = sessionStorage.getItem(SESSION_PREFILL_HANDOFF) === "1";
    sessionStorage.removeItem(SESSION_PREFILL_HANDOFF);
    var urlPrefill = new URLSearchParams(window.location.search).get("prefill") === "1";
    return flagged && urlPrefill && getQueryModule() === "plan";
  }

  function resetAssessmentUiInputs() {
    var ih = $("input-height");
    var iw = $("input-weight");
    if (ih) ih.value = "170";
    if (iw) iw.value = "70";
    if ($("height-val")) $("height-val").textContent = "170";
    if ($("weight-val")) $("weight-val").textContent = "70";
    var hit = $("height-input-text");
    var wit = $("weight-input-text");
    if (hit) {
      hit.value = "";
      hit.placeholder = "Enter height";
    }
    if (wit) {
      wit.value = "";
      wit.placeholder = "Enter weight";
    }
    if ($("height-unit-select")) $("height-unit-select").value = "cm";
    if ($("weight-unit-select")) $("weight-unit-select").value = "kg";
    if ($("progress-fill")) $("progress-fill").style.width = "0%";
    if ($("plan-progress-fill")) $("plan-progress-fill").style.width = "0%";
  }

  function resetAllAssessmentData() {
    state.answers = {
      gender: null,
      shape: null,
      weightGain: null,
      muscleEffect: null,
      bellyFat: null,
      height: 170,
      weight: 70,
    };
    state.bodyTypeKey = null;
    state.bmi = null;
    state.detailGoal = null;
    state.activityLevel = null;
    state.workoutPreference = null;
    state.step = 0;
    state.planStep = 0;
  }

  function resetSessionOnPageLoad() {
    if (consumePrefillHandoff() && !isPageReload()) {
      return;
    }
    clearAssessmentStorage();
    resetAllAssessmentData();
    clearAllCardSelections();
    resetAssessmentUiInputs();
    state.module = null;
    state.view = "landing";
    state.apiBusy = false;
    clearPredictError();
    setPredictLoading(false);
    $("view-result")?.classList.remove("view-result-animate");
    $("detail-goal-phase")?.classList.add("hidden");
    $("detail-plan-phase")?.classList.add("hidden");
  }

  function goQuiz(opts) {
    opts = opts || {};
    try {
      clearAllCardSelections();
      state.module = "classifier";
      resetClassifierAnswers();
      state.step = 0;
      state.apiBusy = false;
      clearPredictError();
      setPredictLoading(false);
      if (opts.boot) {
        bootModuleView("quiz").then(function () {
          renderQuiz();
        });
      } else {
        showView("quiz");
        renderQuiz();
      }
    } catch (err) {
      console.error("Error in goQuiz():", err);
    }
  }

  function resetClassifierAnswers() {
    clearProfile();
    state.bodyTypeKey = null;
    state.bmi = null;
    state.answers = {
      gender: null,
      shape: null,
      weightGain: null,
      muscleEffect: null,
      bellyFat: null,
      height: 170,
      weight: 70,
    };
  }

  function clearPredictError() {
    var el = $("predict-error");
    if (el) {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  function showPredictError(detail) {
    var el = $("predict-error");
    if (!el) return;
    var base = getStrings().predictError || "";
    el.textContent = detail ? base + " " + detail : base;
    el.classList.remove("hidden");
  }

  function setPredictLoading(on) {
    state.apiBusy = !!on;
    var ov = $("predict-overlay");
    if (ov) {
      ov.classList.toggle("hidden", !on);
      ov.setAttribute("aria-hidden", on ? "false" : "true");
      // Use animation manager for smooth loading overlay
      if (window.AnimationManager) {
        window.AnimationManager.showLoading(on);
      }
    }
    updateContinueState();
  }

  function goResult() {
    saveProfile();
    showView("result");
    var vr = $("view-result");
    if (vr) {
      vr.classList.remove("view-result-animate");
      void vr.offsetWidth;
      requestAnimationFrame(function () {
        vr.classList.add("view-result-animate");
      });
    }
    renderResultBody();
  }

  function goPlanWithPrefill() {
    saveProfile();
    sessionStorage.setItem(SESSION_PREFILL_HANDOFF, "1");
    window.location.href = "/?module=plan&prefill=1";
  }

  function startPlanModule(opts) {
    opts = opts || {};
    clearAllCardSelections();
    state.module = "plan";
    state.detailGoal = null;
    state.activityLevel = null;
    state.workoutPreference = null;
    if (opts.prefillBodyType) {
      loadProfile();
      if (state.bodyTypeKey) {
        state.planStep = state.answers.gender ? 2 : 1;
      } else {
        state.bodyTypeKey = null;
        state.planStep = 0;
      }
    } else {
      state.bodyTypeKey = null;
      state.answers.gender = null;
      state.planStep = 0;
    }
    $("detail-goal-phase")?.classList.remove("hidden");
    $("detail-plan-phase")?.classList.add("hidden");
    if (opts.boot) {
      bootModuleView("plan").then(function () {
        renderPlanWizard();
      });
    } else {
      showView("plan");
      renderPlanWizard();
    }
  }

  function finishPlanWizard() {
    saveProfile();
    $("detail-goal-phase")?.classList.add("hidden");
    $("detail-plan-phase")?.classList.remove("hidden");
    showView("detail");
    renderPlanPhase();
  }

  function renderPlanTypeLabels() {
    var s = getStrings();
    ["ectomorph", "mesomorph", "endomorph"].forEach(function (key) {
      var t = s.types && s.types[key];
      var label = $("plan-type-label-" + key);
      var desc = $("plan-type-desc-" + key);
      if (label && t) label.textContent = t.name;
      if (desc && t) desc.textContent = t.summary;
    });
  }

  function renderPlanWizard() {
    renderPlanTypeLabels();
    $("plan-step-total").textContent = String(PLAN_STEPS);
    var pct = ((state.planStep + 1) / PLAN_STEPS) * 100;
    var fill = $("plan-progress-fill");
    if (fill) fill.style.width = pct + "%";

    if (window.AnimationManager) {
      window.AnimationManager.updatePlanProgress(state.planStep, PLAN_STEPS);
      window.AnimationManager.announceProgress(state.planStep + 1, PLAN_STEPS);
    } else {
      $("plan-step-num").textContent = String(state.planStep + 1);
      var percentDisplay = $("plan-progress-percent");
      if (percentDisplay) percentDisplay.textContent = Math.round(pct) + "%";
    }

    var nextPanel = document.querySelector('.plan-panel[data-plan-step="' + state.planStep + '"]');
    var currentPanel = document.querySelector(".plan-panel:not(.hidden)");

    if (window.AnimationManager && currentPanel && nextPanel && currentPanel !== nextPanel) {
      window.AnimationManager.swapPanels(currentPanel, nextPanel);
    } else {
      document.querySelectorAll(".plan-panel").forEach(function (panel) {
        var st = parseInt(panel.getAttribute("data-plan-step"), 10);
        panel.classList.toggle("hidden", st !== state.planStep);
      });
    }

    var toneBtn = $("plan-goal-tone");
    if (toneBtn) toneBtn.classList.toggle("hidden", state.answers.gender !== "female");

    var cur = document.querySelector('.plan-panel[data-plan-step="' + state.planStep + '"]');
    if (cur) {
      cur.querySelectorAll(".opt-card[data-plan-key]").forEach(function (btn) {
        var k = btn.getAttribute("data-plan-key");
        var v = btn.getAttribute("data-value");
        var selected = false;
        if (k === "bodyType") selected = !!state.bodyTypeKey && state.bodyTypeKey === v;
        else if (k === "gender") selected = state.answers.gender === v;
        else if (k === "goal") selected = state.detailGoal === v;
        else if (k === "activity") selected = state.activityLevel === v;
        else if (k === "pref") selected = state.workoutPreference === v;
        btn.classList.toggle("is-selected", selected);
      });
      if (window.AnimationManager) {
        window.AnimationManager.staggerElements('.plan-panel[data-plan-step="' + state.planStep + '"] .opt-card', 50);
      }
    }
  }

  function advancePlanStep() {
    if (state.planStep < PLAN_STEPS - 1) {
      state.planStep += 1;
      renderPlanWizard();
      return;
    }
    finishPlanWizard();
  }

  function goDetail() {
    showView("detail");
    resetGoalPhase();
  }

  function resetGoalPhase() {
    const gp = $("detail-goal-phase");
    const pp = $("detail-plan-phase");
    if (gp) gp.classList.remove("hidden");
    if (pp) pp.classList.add("hidden");
    state.detailGoal = null;
    state.activityLevel = null;
    state.workoutPreference = null;
    renderDetailSelectors();
  }

  function showPlanPhase() {
    var fromEl = $("detail-goal-phase");
    var toEl = $("detail-plan-phase");
    if (window.AnimationManager && fromEl && toEl) {
      window.AnimationManager.swapPanels(fromEl, toEl).then(renderPlanPhase);
      return;
    }
    fromEl?.classList.add("hidden");
    toEl?.classList.remove("hidden");
    renderPlanPhase();
  }

  function renderDetailSelectors() {
    const female = state.answers.gender === "female";
    const toneBtn = $("goal-tone");
    if (toneBtn) toneBtn.classList.toggle("hidden", !female);
    const root = $("detail-goal-phase");
    if (root) {
      root.querySelectorAll("[data-goal]").forEach(function (btn) {
        var gv = btn.getAttribute("data-goal");
        btn.classList.toggle("is-selected", state.detailGoal === gv);
      });
      root.querySelectorAll("[data-activity]").forEach(function (btn) {
        var av = btn.getAttribute("data-activity");
        btn.classList.toggle("is-selected", state.activityLevel === av);
      });
      root.querySelectorAll("[data-workout-pref]").forEach(function (btn) {
        var pv = btn.getAttribute("data-workout-pref");
        btn.classList.toggle("is-selected", state.workoutPreference === pv);
      });
    }
    updateShowPlanButton();
  }

  function updateShowPlanButton() {
    var btn = $("btn-show-plan");
    if (!btn) return;
    var goalOk = state.detailGoal && (state.detailGoal !== "tone" || state.answers.gender === "female");
    var ok = !!(goalOk && state.activityLevel && state.workoutPreference);
    btn.disabled = !ok;
  }

  function renderQuiz() {
    $("step-num").textContent = String(state.step + 1);
    $("step-total").textContent = String(QUIZ_STEPS);
    var pct = ((state.step + 1) / QUIZ_STEPS) * 100;
    var fill = $("progress-fill");
    var bar = $("quiz-progress");
    var percentDisplay = $("progress-percent");
    if (fill) {
      fill.style.width = pct + '%';
    }
    if (bar) bar.setAttribute("aria-valuenow", String(Math.round(pct)));
    if (percentDisplay) percentDisplay.textContent = Math.round(pct) + "%";

    // Update progress with animation manager
    if (window.AnimationManager) {
      window.AnimationManager.updateProgress(state.step, QUIZ_STEPS);
      window.AnimationManager.announceProgress(state.step + 1, QUIZ_STEPS);
    }

    var nextPanel = document.querySelector('.quiz-panel[data-step="' + state.step + '"]');
    var currentPanel = document.querySelector(".quiz-panel:not(.hidden)");

    if (window.AnimationManager && currentPanel && nextPanel && currentPanel !== nextPanel) {
      window.AnimationManager.swapPanels(currentPanel, nextPanel);
    } else {
      document.querySelectorAll(".quiz-panel").forEach(function (panel) {
        var st = parseInt(panel.getAttribute("data-step"), 10);
        panel.classList.toggle("hidden", st !== state.step);
      });
    }

    var cur = document.querySelector('.quiz-panel[data-step="' + state.step + '"]');
    if (cur) {
      cur.querySelectorAll(".opt-card[data-answer-key]").forEach(function (btn) {
        var k = btn.getAttribute("data-answer-key");
        var v = btn.getAttribute("data-value");
        btn.classList.toggle("is-selected", state.answers[k] === v);
      });
      // Add stagger animation to option cards
      if (window.AnimationManager) {
        window.AnimationManager.staggerElements('.quiz-panel[data-step="' + state.step + '"] .opt-card', 50);
      }
    }

    if (state.step === 5) {
      var ih = $("input-height");
      if (ih) {
        ih.value = state.answers.height;
        $("height-val").textContent = String(state.answers.height);
        var heightInput = $("height-input-text");
        if (heightInput) {
          heightInput.value = "";
          heightInput.placeholder = "Enter height";
        }
        var heightSelect = $("height-unit-select");
        if (heightSelect) {
          heightSelect.value = "cm";
        }
      }
    }
    if (state.step === 6) {
      var iw = $("input-weight");
      if (iw) {
        iw.value = state.answers.weight;
        $("weight-val").textContent = String(state.answers.weight);
        var weightInput = $("weight-input-text");
        if (weightInput) {
          weightInput.value = "";
          weightInput.placeholder = "Enter weight";
        }
      }
    }

    updateContinueState();
  }

  function updateContinueState() {
    var btn = $("btn-continue");
    if (!btn) return;
    
    // Hide Continue button for first 5 questions (steps 0-4), show for height/weight (steps 5-6)
    var shouldHideButton = state.step < 5;
    btn.classList.toggle("hidden", shouldHideButton);
    
    if (state.apiBusy) {
      btn.disabled = true;
      return;
    }
    var ok = false;
    if (state.step === 0) ok = !!state.answers.gender;
    else if (state.step === 1) ok = !!state.answers.shape;
    else if (state.step === 2) ok = !!state.answers.weightGain;
    else if (state.step === 3) ok = !!state.answers.muscleEffect;
    else if (state.step === 4) ok = !!state.answers.bellyFat;
    else if (state.step === 5 || state.step === 6) ok = true;
    btn.disabled = !ok;
  }

  function renderResultBody() {
    const s = getStrings();
    const key = state.bodyTypeKey;
    const t = s.types && s.types[key] ? s.types[key] : null;
    $("result-body-type").textContent = t ? t.name : key;
    $("result-bmi").textContent = (state.bmi || 0).toFixed(1);
    $("result-summary").textContent = t ? t.summary : "";
  }

  function goalLabel(goalKey) {
    const s = getStrings();
    var map = {
      weightLoss: s.goalWL,
      muscleGain: s.goalMG,
      maintain: s.goalMaint,
      tone: s.goalTone,
    };
    return map[goalKey] || goalKey;
  }

  function genderTagLabel() {
    const s = getStrings();
    return state.answers.gender === "female" ? s.optFemale : s.optMale;
  }

  function activityTagLabel() {
    const s = getStrings();
    var m = {
      sedentary: s.actSedentary,
      light: s.actLight,
      moderate: s.actModerate,
      active: s.actActive,
      veryActive: s.actVeryActive,
    };
    return m[state.activityLevel] || state.activityLevel || "";
  }

  function prefTagLabel() {
    const s = getStrings();
    var m = {
      gym: s.prefGym,
      home: s.prefHome,
      mixed: s.prefMixed,
      outdoor: s.prefOutdoor,
      bodyweight: s.prefBodyweight,
    };
    return m[state.workoutPreference] || state.workoutPreference || "";
  }

  function renderPlanPhase() {
    const s = getStrings();
    const plans = getPlansBundle();
    const bt = state.bodyTypeKey;
    const g = state.detailGoal;
    if (!g || !state.activityLevel || !state.workoutPreference || !plans[bt] || !plans[bt][g]) return;

    var out =
      typeof window.buildPersonalizedPlan === "function"
        ? window.buildPersonalizedPlan({
            lang: state.lang,
            bodyTypeKey: bt,
            goal: g,
            gender: state.answers.gender,
            activityLevel: state.activityLevel,
            workoutPreference: state.workoutPreference,
            plans: plans,
          })
        : null;
    if (!out || !out.diet || !out.weekly) {
      var bundle = plans[bt][g];
      if (!bundle) return;
      out = { diet: bundle.diet.slice(), weekly: bundle.weekly.slice(), tips: bundle.tips.slice() };
    }

    const typeName = s.types[bt] ? s.types[bt].name : bt;

    $("plan-headline").textContent = typeName + " · " + goalLabel(g);
    $("tag-body").textContent = typeName;
    $("tag-gender").textContent = genderTagLabel();
    $("tag-goal").textContent = goalLabel(g);
    $("tag-activity").textContent = activityTagLabel();
    $("tag-pref").textContent = prefTagLabel();

    const dietEl = $("plan-diet");
    dietEl.innerHTML = "";
    out.diet.forEach(function (line) {
      var li = document.createElement("li");
      li.textContent = line;
      dietEl.appendChild(li);
    });

    const weekEl = $("plan-week");
    weekEl.innerHTML = "";
    const wd = s.weekdays || I18N.en.weekdays;
    out.weekly.forEach(function (row) {
      var li = document.createElement("li");
      var day = document.createElement("span");
      day.className = "week-day";
      day.textContent = wd[row.day] || row.day;
      var text = document.createElement("span");
      text.textContent = row.text;
      li.appendChild(day);
      li.appendChild(text);
      weekEl.appendChild(li);
    });

    const tipsEl = $("plan-tips");
    tipsEl.innerHTML = "";
    out.tips.forEach(function (line) {
      var li = document.createElement("li");
      li.textContent = line;
      tipsEl.appendChild(li);
    });
  }

  function buildPredictPayload() {
    return {
      gender: state.answers.gender,
      body_shape: state.answers.shape,
      weight_gain: state.answers.weightGain,
      muscle_effect: state.answers.muscleEffect,
      belly_fat: state.answers.bellyFat,
      height_cm: state.answers.height,
      weight_kg: state.answers.weight,
    };
  }

  async function fetchPredict() {
    var res = await fetch(predictUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildPredictPayload()),
    });
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      var errMsg = data.error || res.statusText || String(res.status);
      throw new Error(errMsg);
    }
    if (!data.body_type) {
      throw new Error("Invalid response: missing body_type");
    }
    return data;
  }

  async function onContinueQuiz() {
    if (state.step < QUIZ_STEPS - 1) {
      // Show transition overlay
      var overlay = $("quiz-overlay");
      if (overlay) {
        overlay.classList.remove("hidden");
        setTimeout(function () {
          overlay.classList.add("hidden");
        }, 300);
      }
      
      state.step += 1;
      renderQuiz();
      
      // Auto-scroll quiz content to top
      const quizPanels = $("view-quiz")?.querySelector(".quiz-panels");
      if (quizPanels) {
        setTimeout(() => {
          quizPanels.scrollTop = 0;
        }, 0);
      }
      return;
    }
    
    // Last step - fetch prediction
    clearPredictError();
    var localBmi = calcBmi(state.answers.height, state.answers.weight);
    setPredictLoading(true);
    try {
      var data = await fetchPredict();
      state.bmi = typeof data.bmi === "number" ? data.bmi : localBmi;
      state.bodyTypeKey = normalizeBodyType(data.body_type);
      setPredictLoading(false);
      goResult();
    } catch (err) {
      setPredictLoading(false);
      showPredictError(err && err.message ? "(" + err.message + ")" : "");
    }
  }

  function onBack() {
    if (state.view === "quiz") {
      if (state.step === 0) {
        goDashboard();
      } else {
        state.step -= 1;
        renderQuiz();
      }
      return;
    }
    if (state.view === "plan") {
      if (state.planStep === 0) {
        goDashboard();
      } else {
        state.planStep -= 1;
        renderPlanWizard();
      }
      return;
    }
    if (state.view === "result") {
      state.step = CLASSIFIER_STEPS - 1;
      showView("quiz");
      renderQuiz();
      return;
    }
    if (state.view === "detail") {
      var planOpen = $("detail-plan-phase") && !$("detail-plan-phase").classList.contains("hidden");
      if (state.module === "plan" && planOpen) {
        $("detail-plan-phase")?.classList.add("hidden");
        state.planStep = PLAN_STEPS - 1;
        showView("plan");
        renderPlanWizard();
        return;
      }
      if (planOpen) resetGoalPhase();
      else if (state.module === "classifier") goResult();
      else {
        state.planStep = PLAN_STEPS - 1;
        showView("plan");
        renderPlanWizard();
      }
    }
  }

  function goHome() {
    clearAssessmentStorage();
    resetAllAssessmentData();
    clearAllCardSelections();
    resetAssessmentUiInputs();
    state.module = null;
    state.apiBusy = false;
    clearPredictError();
    setPredictLoading(false);
    $("view-result")?.classList.remove("view-result-animate");
    showView("landing");
  }

  function closeLangMenu() {
    var menu = $("lang-menu");
    var btn = $("btn-lang");
    if (menu) menu.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function init() {
    try {
      state.lang = localStorage.getItem(STORAGE_LANG) || "en";
      state.theme = localStorage.getItem(STORAGE_THEME) || "dark";
      setLang(state.lang);
      setTheme(state.theme);
      resetSessionOnPageLoad();

      var btnStart = $("btn-start");
      if (btnStart) {
        btnStart.addEventListener("click", async function () {
          if (window.FitAIAuth) {
            var user = await window.FitAIAuth.getCurrentUser();
            if (user) {
              goDashboard();
            } else {
              // Trigger login modal from auth-ui.js logic
              $("btn-account")?.click(); 
            }
          } else {
            goDashboard();
          }
        });
      }

      
      $("btn-continue")?.addEventListener("click", onContinueQuiz);
      $("btn-back")?.addEventListener("click", onBack);
      $("btn-dashboard")?.addEventListener("click", goDashboard);
      $("btn-view-detail")?.addEventListener("click", goPlanWithPrefill);
      $("btn-retake")?.addEventListener("click", goQuiz);

    $("input-height")?.addEventListener("input", function (e) {
      state.answers.height = parseInt(e.target.value, 10);
      $("height-val").textContent = String(state.answers.height);
      updateContinueState();
    });
    
    $("height-input-text")?.addEventListener("input", function (e) {
      var input = e.target.value;
      var unit = $("height-unit-select")?.value || "cm";
      
      // Only allow numbers and single decimal point
      var cleaned = input.replace(/[^0-9.]/g, "");
      var parts = cleaned.split(".");
      if (parts.length > 2) {
        cleaned = parts[0] + "." + parts.slice(1).join("");
      }
      e.target.value = cleaned;
      
      if (!cleaned) return;
      
      var cm = null;
      var value = parseFloat(cleaned);
      
      if (unit === "feet") {
        // Convert feet to CM (1 foot = 30.48 cm)
        cm = Math.round(value * 30.48);
      } else {
        // Already in CM
        cm = Math.round(value);
      }
      
      if (cm && cm >= 140 && cm <= 220) {
        state.answers.height = cm;
        $("input-height").value = cm;
        $("height-val").textContent = String(cm);
      }
    });
    
    $("height-unit-select")?.addEventListener("change", function (e) {
      var inputField = $("height-input-text");
      if (inputField) {
        inputField.value = "";
        if (e.target.value === "feet") {
          inputField.placeholder = "e.g., 5.58";
        } else {
          inputField.placeholder = "Enter height";
        }
      }
    });

    $("input-weight")?.addEventListener("input", function (e) {
      state.answers.weight = parseInt(e.target.value, 10);
      $("weight-val").textContent = String(state.answers.weight);
      updateContinueState();
    });
    
    $("weight-input-text")?.addEventListener("input", function (e) {
      var input = e.target.value;
      
      // Only allow numbers and single decimal point
      var cleaned = input.replace(/[^0-9.]/g, "");
      var parts = cleaned.split(".");
      if (parts.length > 2) {
        cleaned = parts[0] + "." + parts.slice(1).join("");
      }
      e.target.value = cleaned;
      
      if (!cleaned) return;
      
      var kg = Math.round(parseFloat(cleaned));
      
      if (kg >= 40 && kg <= 150) {
        state.answers.weight = kg;
        $("input-weight").value = kg;
        $("weight-val").textContent = String(kg);
      }
    });

    $("view-plan")?.addEventListener("click", function (e) {
      var btn = e.target.closest(".opt-card[data-plan-key]");
      if (!btn) return;
      var key = btn.getAttribute("data-plan-key");
      var val = btn.getAttribute("data-value");
      if (!key || !val) return;
      if (key === "bodyType") {
        state.bodyTypeKey = normalizeBodyType(val);
        saveProfile();
      } else if (key === "gender") {
        state.answers.gender = val;
        saveProfile();
      } else if (key === "goal") {
        if (val === "tone" && state.answers.gender !== "female") return;
        state.detailGoal = val;
      } else if (key === "activity") {
        state.activityLevel = val;
      } else if (key === "pref") {
        state.workoutPreference = val;
      }

      document.querySelectorAll('.plan-panel[data-plan-step="' + state.planStep + '"] .opt-card[data-plan-key="' + key + '"]').forEach(function (card) {
        card.classList.add("is-selected");
      });
      renderPlanWizard();
      if (window.AnimationManager) window.AnimationManager.animateOptionSelect(btn);

      setTimeout(function () {
        advancePlanStep();
      }, 600);
    });

    $("view-quiz")?.addEventListener("click", function (e) {
      var btn = e.target.closest(".opt-card[data-answer-key]");
      if (!btn) return;
      var key = btn.getAttribute("data-answer-key");
      var val = btn.getAttribute("data-value");
      if (!key || !val) return;
      
      // Update state immediately
      state.answers[key] = val;
      if (key === "gender") saveProfile();
      document.querySelectorAll('.quiz-panel[data-step="' + state.step + '"] .opt-card[data-answer-key="' + key + '"]').forEach(function(card) {
        card.classList.add("is-selected");
      });
      
      // Render quiz to update all state
      renderQuiz();
      
      // Animate card selection after visual state is set
      if (window.AnimationManager) {
        window.AnimationManager.animateOptionSelect(btn);
      }
      
      // Auto-advance for first 5 questions (steps 0-4) after 0.8 seconds
      if (state.step < 5) {
        setTimeout(function () {
          onContinueQuiz();
        }, 600);
      }
    });

    $("btn-theme")?.addEventListener("click", function () {
      setTheme(state.theme === "dark" ? "light" : "dark");
    });

    $("btn-lang")?.addEventListener("click", function (e) {
      e.stopPropagation();
      var menu = $("lang-menu");
      var open = menu && menu.classList.contains("hidden");
      if (open) {
        menu.classList.remove("hidden");
        $("btn-lang").setAttribute("aria-expanded", "true");
      } else closeLangMenu();
    });
    document.querySelectorAll(".dropdown__opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLang(btn.getAttribute("data-lang"));
        closeLangMenu();
      });
    });
    document.addEventListener("click", function () {
      closeLangMenu();
    });
    $("lang-wrap")?.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    $("lang-menu")?.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    $("detail-goal-phase")?.addEventListener("click", function (e) {
      var goalCard = e.target.closest("[data-goal]");
      if (goalCard) {
        var gv = goalCard.getAttribute("data-goal");
        if (gv === "tone" && state.answers.gender !== "female") return;
        state.detailGoal = gv;
        // Animate card selection
        if (window.AnimationManager) {
          window.AnimationManager.animateOptionSelect(goalCard);
        }
        renderDetailSelectors();
        return;
      }
      var actCard = e.target.closest("[data-activity]");
      if (actCard) {
        state.activityLevel = actCard.getAttribute("data-activity");
        // Animate card selection
        if (window.AnimationManager) {
          window.AnimationManager.animateOptionSelect(actCard);
        }
        renderDetailSelectors();
        return;
      }
      var prefCard = e.target.closest("[data-workout-pref]");
      if (prefCard) {
        state.workoutPreference = prefCard.getAttribute("data-workout-pref");
        // Animate card selection
        if (window.AnimationManager) {
          window.AnimationManager.animateOptionSelect(prefCard);
        }
        renderDetailSelectors();
      }
    });

    $("btn-show-plan")?.addEventListener("click", function () {
      if ($("btn-show-plan")?.disabled) return;
      showPlanPhase();
    });

    $("btn-change-goal")?.addEventListener("click", function () {
      if (state.module === "plan") {
        $("detail-plan-phase")?.classList.add("hidden");
        state.planStep = 2;
        showView("plan");
        renderPlanWizard();
      } else {
        resetGoalPhase();
      }
    });

    var urlModule = getQueryModule();
    if (urlModule === "classifier") {
      goQuiz({ boot: true });
    } else if (urlModule === "plan") {
      var prefill = new URLSearchParams(window.location.search).get("prefill") === "1";
      startPlanModule({ prefillBodyType: prefill, boot: true });
    } else if (urlModule === "tracking") {
      if (window.FitAITracking && window.FitAITracking.init) {
        window.FitAITracking.init();
      } else if (window.FitAITracking && window.FitAITracking.bindNutritionView) {
        window.FitAITracking.bindNutritionView();
      }
    } else {
      showView("landing");
      if (window.AnimationManager) {
        window.AnimationManager.pageEnter($("view-landing"));
      }
    }
    } catch (err) {
      console.error("Error in init():", err);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
