(function (global) {
  var BOOTED = false;
  var STORAGE_PROFILE = "fitai-profile";
  var STORAGE_NUTRITION = "fitai-tracking-nutrition";
  var STORAGE_HISTORY = "fitai-tracking-history";

  function $(id) {
    return document.getElementById(id);
  }

  function getStrings() {
    return (global.FitAIStrings && global.FitAIStrings[localStorage.getItem("fitai-lang") || "en"]) || global.FitAIStrings && global.FitAIStrings.en || {};
  }

  function apiBase() {
    if (typeof window === "undefined") return "http://127.0.0.1:5000";
    var b = window.FITAI_API_BASE;
    if (b === "" || b === null) return "";
    if (b !== undefined) return String(b).replace(/\/$/, "");
    var o = window.location.origin || "";
    if (o && o !== "null" && o.indexOf("file") !== 0) return "";
    return "http://127.0.0.1:5000";
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function loadProfile() {
    return readJson(STORAGE_PROFILE, {});
  }

  function loadNutrition() {
    return readJson(STORAGE_NUTRITION, { date: null, items: [], summary: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, item_count: 0 } });
  }

  function loadHistory() {
    return readJson(STORAGE_HISTORY, []);
  }

  function calcTargets(profile) {
    profile = profile || {};
    var weight = Number(profile.weight_kg) || 70;
    var height = Number(profile.height_cm) || 170;
    var gender = profile.gender || "male";
    var goal = profile.goal || profile.detailGoal || "maintain";
    var bodyType = (profile.bodyTypeKey || "mesomorph").toLowerCase();
    var age = Number(profile.age) || 30;
    var activity = profile.activityLevel || "moderate";

    var activityMap = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };
    var bmr = gender === "female" ? 10 * weight + 6.25 * height - 5 * age - 161 : 10 * weight + 6.25 * height - 5 * age + 5;
    var tdee = bmr * (activityMap[activity] || 1.45);

    if (bodyType === "ectomorph") {
      tdee *= goal === "muscleGain" ? 1.20 : goal === "weightLoss" ? 0.90 : 1.05;
    } else if (bodyType === "endomorph") {
      tdee *= goal === "muscleGain" ? 1.08 : goal === "weightLoss" ? 0.80 : 0.95;
    } else {
      tdee *= goal === "muscleGain" ? 1.15 : goal === "weightLoss" ? 0.85 : 1.0;
    }

    var proteinPerKg = 1.6;
    if (bodyType === "ectomorph") proteinPerKg = goal === "muscleGain" ? 2.2 : 1.8;
    else if (bodyType === "endomorph") proteinPerKg = goal === "weightLoss" ? 2.0 : 1.7;
    else proteinPerKg = goal === "muscleGain" ? 2.0 : 1.6;

    return {
      calories: Math.round(tdee),
      protein_g: Math.round(weight * proteinPerKg),
      carbs_g: Math.round((tdee * 0.4) / 4),
      fat_g: Math.round((tdee * 0.25) / 9),
    };
  }

  function int(n) {
    n = Number(n);
    return isNaN(n) ? 0 : Math.round(n);
  }

  function ringStatus(pct) {
    if (pct < 80) return "low";
    if (pct <= 110) return "normal";
    return "high";
  }

  function statusLabel(status) {
    if (status === "normal") return "Normal";
    if (status === "high") return "High";
    return "Low";
  }

  function statusHint(label, current, target, status) {
    var diff = Math.abs(target - current);
    if (label === "protein") {
      if (status === "low") return diff + "g more protein needed";
      if (status === "high") return diff + "g above your protein target";
      return "Protein target nearly achieved";
    }
    if (status === "low") return diff + " kcal below your target";
    if (status === "high") return diff + " kcal above your target";
    return "Calories are on track";
  }

  function setRingFill(id, pct) {
    var el = $(id);
    if (!el) return;
    var radius = 82;
    var circumference = 2 * Math.PI * radius;
    var arcLen = circumference * 0.75;
    var filled = arcLen * Math.min(100, Math.max(0, pct)) / 100;
    el.style.strokeDasharray = filled + " " + circumference;
    el.style.strokeDashoffset = "0";
  }

  function bindBackButton() {
    var btn = $("btn-back");
    if (!btn || btn.getAttribute("data-reco-back-bound") === "1") return;
    btn.setAttribute("data-reco-back-bound", "1");
    btn.addEventListener(
      "click",
      function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.history.back();
      },
      true
    );
  }

  function makeCardIcon(symbol, tint) {
    return '<div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-2xl shadow-[0_0_18px_' + tint + ']">' + symbol + '</div>';
  }

  function renderProgress(summary, targets) {
    var cal = int(summary.calories);
    var pro = int(summary.protein_g);
    var calTarget = Math.max(1, int(targets.calories));
    var proTarget = Math.max(1, int(targets.protein_g));
    var calPct = Math.round((cal / calTarget) * 100);
    var proPct = Math.round((pro / proTarget) * 100);
    var calStatus = ringStatus(calPct);
    var proStatus = ringStatus(proPct);

    setRingFill("reco-cal-ring-fill", calPct);
    setRingFill("reco-pro-ring-fill", proPct);

    var calValue = $("reco-cal-value");
    var calTargetEl = $("reco-cal-target");
    var calPctEl = $("reco-cal-pct");
    var calBadge = $("reco-cal-badge");
    var calHint = $("reco-cal-hint");
    if (calValue) calValue.textContent = String(cal);
    if (calTargetEl) calTargetEl.textContent = "/ " + calTarget + " kcal";
    if (calPctEl) calPctEl.textContent = calPct + "%";
    if (calBadge) calBadge.textContent = statusLabel(calStatus);
    if (calHint) calHint.textContent = statusHint("calories", cal, calTarget, calStatus);

    var proValue = $("reco-pro-value");
    var proTargetEl = $("reco-pro-target");
    var proPctEl = $("reco-pro-pct");
    var proBadge = $("reco-pro-badge");
    var proHint = $("reco-pro-hint");
    if (proValue) proValue.textContent = String(pro) + "g";
    if (proTargetEl) proTargetEl.textContent = "/ " + proTarget + "g";
    if (proPctEl) proPctEl.textContent = proPct + "%";
    if (proBadge) proBadge.textContent = statusLabel(proStatus);
    if (proHint) proHint.textContent = statusHint("protein", pro, proTarget, proStatus);
  }

  function renderCardGrid(containerId, items) {
    var wrap = $(containerId);
    if (!wrap) return;
    wrap.innerHTML = "";
    (items || []).forEach(function (item) {
      var priorityClass = item.priority === "high" ? "text-pink-200" : item.priority === "medium" ? "text-amber-200" : "text-emerald-200";
      var badgeClass = item.priority === "high" ? "bg-pink-500/15 text-pink-100 border-pink-400/20" : item.priority === "medium" ? "bg-amber-500/15 text-amber-100 border-amber-400/20" : "bg-emerald-500/15 text-emerald-100 border-emerald-400/20";
      var tint = item.icon === "protein" || item.icon === "dumbbell" ? "rgba(56,189,248,0.18)" : item.icon === "leaf" ? "rgba(45,212,191,0.18)" : item.icon === "wheat" ? "rgba(251,191,36,0.18)" : item.icon === "running" ? "rgba(96,165,250,0.18)" : item.icon === "flame" ? "rgba(249,115,22,0.18)" : item.icon === "timer" ? "rgba(244,114,182,0.18)" : "rgba(255,255,255,0.16)";
      var glyph = item.icon === "protein" ? "💪" : item.icon === "leaf" ? "🌿" : item.icon === "drop" ? "💧" : item.icon === "wheat" ? "🌾" : item.icon === "running" ? "🏃" : item.icon === "dumbbell" ? "🏋" : item.icon === "flame" ? "🔥" : item.icon === "timer" ? "⏱" : "✨";
      var el = document.createElement("div");
      el.className = "group rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_26px_rgba(2,8,23,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]";
      el.innerHTML =
        '<div class="flex items-start gap-3">' +
          makeCardIcon(glyph, tint) +
          '<div class="min-w-0 flex-1">' +
            '<div class="flex items-start justify-between gap-2">' +
              '<h3 class="text-sm font-semibold text-white">' + item.title + '</h3>' +
              '<span class="shrink-0 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] ' + badgeClass + '">' + item.priority + '</span>' +
            '</div>' +
            '<p class="mt-2 text-sm leading-6 text-white/70">' + item.description + '</p>' +
          '</div>' +
        '</div>';
      wrap.appendChild(el);
    });
  }

  function renderInsights(list) {
    var wrap = $("reco-insights-list");
    if (!wrap) return;
    wrap.innerHTML = "";
    (list || []).forEach(function (line) {
      var el = document.createElement("div");
      el.className = "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 shadow-[0_0_18px_rgba(2,8,23,0.25)]";
      el.innerHTML = '<span class="text-emerald-300">✓</span><span>' + line + '</span>';
      wrap.appendChild(el);
    });
  }

  function renderTip(tip) {
    var el = $("reco-tip");
    if (el) el.textContent = tip || "Consistency matters more than intensity.";
  }

  async function fetchRecommendations(payload) {
    var base = apiBase();
    var url = base === "" ? "/recommendations" : base + "/recommendations";
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.error || "Unable to build recommendations right now");
    }
    return data;
  }

  function buildPayload() {
    var profile = loadProfile();
    var nutrition = loadNutrition();
    return {
      lang: localStorage.getItem("fitai-lang") || "en",
      profile: profile,
      nutrition: nutrition.summary || {},
      history: loadHistory(),
      age: Number(profile.age) || 30,
    };
  }

  function buildFallback(payload) {
    var profile = payload.profile || {};
    var nutrition = payload.nutrition || {};
    var targets = calcTargets(profile);
    var cal = Number(nutrition.calories || 0);
    var protein = Number(nutrition.protein_g || nutrition.protein || 0);
    var calDiff = cal - targets.calories;
    var proteinDiff = protein - targets.protein_g;
    return {
      success: true,
      has_profile: !!profile.bodyTypeKey,
      current: {
        calories: cal,
        protein_g: protein,
        targets: targets,
        calorie_diff: calDiff,
        protein_diff: proteinDiff,
      },
      recommendations: {
        diet: [
          { title: "Focus on Protein", icon: "protein", priority: proteinDiff < -20 ? "high" : "medium", description: "Include eggs, chicken, fish and lentils" },
          { title: "Eat More Greens", icon: "leaf", priority: calDiff > 0 ? "medium" : "low", description: "Increase vegetables and salads" },
          { title: "Stay Hydrated", icon: "drop", priority: "medium", description: "Drink 2.5–3 liters water throughout the day" },
          { title: "Healthy Carbs", icon: "wheat", priority: "low", description: "Choose oats, brown rice and whole grains" },
        ],
        exercise: [
          { title: "Cardio", icon: "running", priority: "medium", description: "20–30 min moderate intensity" },
          { title: "Strength Training", icon: "dumbbell", priority: "high", description: "Upper body / lower body / full body" },
          { title: "Calories Burn Goal", icon: "flame", priority: "medium", description: "250–350 kcal" },
          { title: "Recovery Time", icon: "timer", priority: "low", description: "60–90 sec" },
        ],
      },
      insights: [
        calDiff < 0 ? "Calories slightly low today" : "Recommended increase tomorrow",
        proteinDiff < 0 ? "Protein intake moderate" : "Protein intake on track",
      ],
      tip: "Consistent nutrition beats extreme dieting.",
    };
  }

  function render(data, payload) {
    var strings = getStrings();
    document.title = (strings.brand || "FitForge") + " — " + (strings.recommendationPageTitle || "Tomorrow's Smart Plan");
    var current = data.current || {};
    var summary = payload && payload.nutrition ? payload.nutrition : {};
    var targets = current.targets || calcTargets(payload.profile || {});

    renderProgress(summary, targets);
    renderCardGrid("reco-diet-grid", data.recommendations && data.recommendations.diet);
    renderCardGrid("reco-exercise-grid", data.recommendations && data.recommendations.exercise);
    renderInsights(data.insights || []);
    renderTip(data.tip);

    var note = $("recommendation-generic-note");
    if (note) {
      note.textContent = data.has_profile ? "" : (strings.recommendationNoProfileNote || "Personalized insights will appear after your body type and profile are saved.");
      note.classList.toggle("hidden", data.has_profile);
    }
  }

  async function init() {
    if (BOOTED) return;
    if (new URLSearchParams(window.location.search).get("module") !== "recommendation") return;
    BOOTED = true;

    var payload = buildPayload();
    bindBackButton();
    var headerNote = $("recommendation-page-note");
    var strings = getStrings();
    if (headerNote) {
      headerNote.textContent = payload.profile && payload.profile.bodyTypeKey ? "" : (strings.recommendationGenericNote || "Generic guidance is shown until your profile is available.");
      headerNote.classList.toggle("hidden", !!(payload.profile && payload.profile.bodyTypeKey));
    }

    var refreshBtn = $("recommendation-refresh-btn");
    if (refreshBtn && refreshBtn.getAttribute("data-bound") !== "1") {
      refreshBtn.setAttribute("data-bound", "1");
      refreshBtn.addEventListener("click", function () {
        init();
      });
    }

    try {
      var data = await fetchRecommendations(payload);
      render(data, payload);
    } catch (e) {
      render(buildFallback(payload), payload);
    }
  }

  global.FitAIRecommendationPage = {
    init: init,
    render: render,
    buildFallback: buildFallback,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
