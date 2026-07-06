(function (global) {
  var charts = [];

  function $(id) {
    return document.getElementById(id);
  }

  function getStr(key, fallback) {
    try {
      var lang = localStorage.getItem("fitai-lang") || "en";
      var strings = (global.FitAIStrings || {})[lang] || (global.FitAIStrings || {}).en || {};
      return strings[key] || fallback || key;
    } catch (e) {
      return fallback || key;
    }
  }

  function destroyCharts() {
    charts.forEach(function (c) {
      if (c) c.destroy();
    });
    charts = [];
  }

  function renderMacroCharts(summary, targets) {
    destroyCharts();
    var pairs = [
      { id: "track-chart-cal",     key: "calories",  target: targets.calories,  color: "#2dd4bf" },
      { id: "track-chart-protein", key: "protein_g", target: targets.protein_g, color: "#38bdf8" },
      { id: "track-chart-carbs",   key: "carbs_g",   target: targets.carbs_g,   color: "#fbbf24" },
      { id: "track-chart-fat",     key: "fat_g",     target: targets.fat_g,     color: "#f472b6" },
    ];
    pairs.forEach(function (p) {
      var canvas = $(p.id);
      if (!canvas) return;
      var val = summary[p.key] || 0;
      var valEl = $("track-val-" + p.key.replace("_g", ""));
      if (valEl) valEl.textContent = Math.round(val);
      if (!global.Chart) return;
      var tgt = p.target || 1;
      var pct = Math.min(100, Math.round((val / tgt) * 100));
      try {
        var chart = new Chart(canvas, {
          type: "doughnut",
          data: {
            datasets: [{
              data: [pct, Math.max(0, 100 - pct)],
              backgroundColor: [p.color, "rgba(255,255,255,0.08)"],
              borderWidth: 0,
            }],
          },
          options: {
            cutout: "72%",
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { animateRotate: true, duration: 800 },
          },
        });
        charts.push(chart);
      } catch (e) { /* chart render is optional */ }
    });
  }

  function getIntakeStatus(pct) {
    if (pct < 80) return "low";
    if (pct <= 110) return "normal";
    return "high";
  }

  function getStatusBadgeLabel(status) {
    if (status === "normal") return "\u2713 Normal";
    if (status === "high") return "\u2191 High";
    return "\u2713 Low";
  }

  function formatCalorieHint(current, target, status) {
    var diff = Math.round(Math.abs(target - current));
    if (status === "low") return "You are " + diff + " kcal below your daily target";
    if (status === "high") return "You are " + diff + " kcal above your daily target";
    return "You are on track with your calorie target";
  }

  function formatProteinHint(current, target, status) {
    var diff = Math.round(target - current);
    if (status === "low") return "You need " + Math.max(0, diff) + "g more protein";
    if (status === "high") return "You are " + Math.abs(diff) + "g over your protein target";
    return "You are on track with your protein target";
  }

  var INTAKE_RING_RADIUS = 72;
  var INTAKE_RING_ARC = 0.75;

  function setIntakeRingFill(el, pct) {
    if (!el) return;
    var circumference = 2 * Math.PI * INTAKE_RING_RADIUS;
    var arcLen = circumference * INTAKE_RING_ARC;
    var filled = arcLen * Math.min(100, Math.max(0, pct)) / 100;
    el.style.strokeDasharray = filled + " " + circumference;
    el.style.strokeDashoffset = "0";
  }

  function applyIntakeCardStatus(cardEl, status) {
    if (!cardEl) return;
    cardEl.classList.remove(
      "tracking-intake-card--status-low",
      "tracking-intake-card--status-normal",
      "tracking-intake-card--status-high"
    );
    cardEl.classList.add("tracking-intake-card--status-" + status);
  }

  function renderIntakeRings(summary, targets) {
    var calCurrent = Math.round(summary.calories || 0);
    var proCurrent = Math.round(summary.protein_g || 0);
    var calTarget = Math.round(targets.calories || 1);
    var proTarget = Math.round(targets.protein_g || 1);
    var calPct = Math.round((calCurrent / calTarget) * 100);
    var proPct = Math.round((proCurrent / proTarget) * 100);
    var calStatus = getIntakeStatus(calPct);
    var proStatus = getIntakeStatus(proPct);

    applyIntakeCardStatus($("track-cal-intake-card"), calStatus);
    applyIntakeCardStatus($("track-pro-intake-card"), proStatus);

    setIntakeRingFill($("track-cal-ring-fill"), calPct);
    setIntakeRingFill($("track-pro-ring-fill"), proPct);

    var calValue = $("track-cal-intake-value");
    var calTargetEl = $("track-cal-intake-target");
    var calPctEl = $("track-cal-intake-pct");
    var calBadge = $("track-cal-intake-badge");
    var calHint = $("track-cal-intake-hint");
    if (calValue) calValue.textContent = String(calCurrent);
    if (calTargetEl) calTargetEl.textContent = "/ " + calTarget + " kcal (Previous Record)";
    if (calPctEl) calPctEl.textContent = calPct + "%";
    if (calBadge) calBadge.textContent = getStatusBadgeLabel(calStatus);
    if (calHint) calHint.textContent = formatCalorieHint(calCurrent, calTarget, calStatus);

    var proValue = $("track-pro-intake-value");
    var proTargetEl = $("track-pro-intake-target");
    var proPctEl = $("track-pro-intake-pct");
    var proBadge = $("track-pro-intake-badge");
    var proHint = $("track-pro-intake-hint");
    if (proValue) proValue.textContent = proCurrent + "g";
    if (proTargetEl) proTargetEl.textContent = "/ " + proTarget + "g (Previous Record)";
    if (proPctEl) proPctEl.textContent = proPct + "%";
    if (proBadge) proBadge.textContent = getStatusBadgeLabel(proStatus);
    if (proHint) proHint.textContent = formatProteinHint(proCurrent, proTarget, proStatus);

    var labelMap = {
      "track-label-calories": "trackCalories",
      "track-label-protein":  "trackProtein",
      "track-label-carbs":    "trackCarbs",
      "track-label-fat":      "trackFat",
    };
    Object.keys(labelMap).forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = getStr(labelMap[id]);
    });
  }

  function ensureBreakdownHelper() {
    var breakdown = $("track-food-breakdown");
    if (!breakdown) return null;
    var helper = $("track-food-breakdown-helper");
    if (!helper) {
      helper = document.createElement("p");
      helper.id = "track-food-breakdown-helper";
      helper.className = "tracking-breakdown-helper";
      helper.style.marginTop = "0.75rem";
      helper.style.color = "rgba(255,255,255,0.68)";
      helper.style.fontSize = "0.86rem";
      breakdown.insertAdjacentElement("afterend", helper);
    }
    return helper;
  }

  function renderFoodBreakdown(items, latestSummary) {
    var wrap = $("track-food-breakdown");
    if (!wrap) return;
    wrap.innerHTML = "";
    var title = $("track-food-breakdown-title");
    if (title) title.textContent = getStr("trackFoodBreakdown", "Food breakdown");
    (items || [])
      .filter(function (i) { return i && (i.status === "matched" || i.matched_food); })
      .forEach(function (item) {
        var card = document.createElement("div");
        card.className = "tracking-food-item glass-card animate-in";
        card.innerHTML =
          '<div class="tracking-food-item__name">' + (item.matched_food || item.raw_input) + "</div>" +
          '<div class="tracking-food-item__meta">' +
            getStr("trackCalories", "Calories") + ": " + (item.calories || 0) +
            " kcal · " + getStr("trackProtein", "Protein") + ": " + (item.protein_g || 0) +
            "g · " + getStr("trackCarbs", "Carbs") + ": " + (item.carbs_g || 0) +
            "g · " + getStr("trackFat", "Fat") + ": " + (item.fat_g || 0) + "g</div>" +
          (item.portion ? '<div class="tracking-food-item__meta">' + item.portion + "</div>" : "") +
          (item.source === "usda" ? '<div class="tracking-food-item__meta">Source: USDA estimate</div>' : "");
        wrap.appendChild(card);
      });

    var helper = ensureBreakdownHelper();
    if (helper) {
      helper.textContent = getStr(
        "trackLatestOnlyNote",
        "Showing nutrition for your latest entry only. View full food history in Profile."
      );
    }
  }

  function renderRecommendations(reco) {
    var section = $("track-recommendations");
    var list    = $("track-reco-list");
    if (!section || !list) return;
    if (!reco || !reco.cards || !reco.cards.length) {
      section.classList.add("hidden");
      return;
    }
    section.classList.remove("hidden");
    var recoTitle = $("track-reco-title");
    if (recoTitle) recoTitle.textContent = getStr("trackTomorrowReco", "Tomorrow\u2019s recommendations");
    list.innerHTML = "";
    reco.cards.forEach(function (card) {
      var el = document.createElement("div");
      el.className = "tracking-reco-card glass-card animate-in" + (card.type === "burn" ? " tracking-reco-card--burn" : "");
      el.innerHTML = "<strong>" + card.title + "</strong><p>" + card.body + "</p>";
      list.appendChild(el);
    });
  }

  function showSkeleton(on) {
    var sk = $("track-skeleton");
    if (sk) sk.classList.toggle("hidden", !on);
  }

  function showAnalyzeError(message) {
    var el = $("track-analyze-error");
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  function setAnalyzeLoading(on) {
    showSkeleton(on);
    var btn = $("track-analyze-btn");
    if (btn) btn.disabled = !!on;
  }

  function showResults(on) {
    var el = $("track-results");
    if (!el) return;
    if (on) el.classList.remove("hidden");
    else el.classList.add("hidden");
  }

  function resolveSummary(apiResult) {
    if (!apiResult) return {};
    if (apiResult.summary && (apiResult.summary.calories || apiResult.summary.item_count)) {
      return apiResult.summary;
    }
    var n = apiResult.nutrition || {};
    return {
      calories:  Number(n.calories || 0),
      protein_g: Number(n.protein_g != null ? n.protein_g : n.protein || 0),
      carbs_g:   Number(n.carbs_g   != null ? n.carbs_g   : n.carbs   || 0),
      fat_g:     Number(n.fat_g     != null ? n.fat_g     : n.fat     || 0),
      fiber_g:   Number(n.fiber_g   || n.fiber || 0),
      item_count: Number(apiResult.matched_count || 0),
    };
  }

  function renderResults(apiResult, session) {
    var summary = (session && session.cumulativeSummary) || resolveSummary(apiResult);
    var latestSummary = resolveSummary(apiResult);
    var items = apiResult.items || [];
    var targets = (session && session.targets) || {};
    
    if (!targets.calories && global.FitAITrackingState && global.FitAITrackingState.calculateTargets) {
      targets = global.FitAITrackingState.calculateTargets(
        global.FitAITrackingState.loadProfile ? global.FitAITrackingState.loadProfile() : {}
      );
    }
    showResults(true);
    renderIntakeRings(summary, targets);
    renderFoodBreakdown(items, latestSummary);
    try {
      renderMacroCharts(latestSummary, targets);
    } catch (e) { /* charts are optional */ }
    var resultsEl = $("track-results");
    if (resultsEl && resultsEl.scrollIntoView) {
      resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderReminderList(reminders, onDelete) {
    var wrap = $("track-reminder-list");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!reminders.length) {
      wrap.innerHTML = '<p class="tracking-empty-note">' + getStr("trackNoReminders", "No reminders yet. Add one above.") + '</p>';
      return;
    }
    reminders.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "tracking-reminder-item glass-card";
      row.innerHTML =
        '<div><div class="tracking-reminder-item__time">' + r.time +
        '</div><div class="tracking-reminder-item__type">' + r.type +
        (r.message ? " \u2014 " + r.message : "") + "</div></div>" +
        '<button type="button" class="btn btn--ghost btn--sm" data-id="' + r.id + '">' +
        getStr("trackRemove", "Remove") + '</button>';
      row.querySelector("button").addEventListener("click", function () {
        onDelete(r.id);
      });
      wrap.appendChild(row);
    });
  }

  function applyTrackingI18n() {
    var labelMap = {
      "track-analyze-btn":       "trackAnalyzeBtn",
      "track-enable-notify":     "trackEnableNotify",
      "track-add-reminder":      "trackAddReminder",
      "track-card-nutrition-title": "trackNutritionTitle",
    };
    Object.keys(labelMap).forEach(function(id) {
      var el = $(id);
      if (el && el.tagName !== "SELECT") el.textContent = getStr(labelMap[id]) || el.textContent;
    });
    var subtitleEl = $("track-food-subtitle");
    if (subtitleEl) subtitleEl.textContent = getStr("trackNutritionSubtitle", "What did you eat today?");
  }

  function renderBodyTypeGate(onSelect, onClassify) {
    var overlay = $("track-gate-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "track-gate-overlay";
        overlay.className = "auth-overlay animate-fadeIn";
        overlay.innerHTML = 
            '<div class="auth-modal glass-card tracking-gate animate-slideUp">' +
                '<button type="button" class="auth-modal__close" id="gate-close" aria-label="Close">' +
                    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
                '</button>' +
                '<div class="tracking-gate__icon">🛡️</div>' +
                '<h2 class="tracking-gate__title">' + getStr("planBodyTypeTitle", "Select your body type") + '</h2>' +
                '<p class="tracking-gate__hint">' + getStr("planBodyTypeHint", "Choose the type that best describes you. This is required.") + '</p>' +
                '<div class="tracking-gate__options">' +
                    '<button type="button" class="btn btn--primary gate-opt" data-type="ectomorph">Ectomorph</button>' +
                    '<button type="button" class="btn btn--primary gate-opt" data-type="mesomorph">Mesomorph</button>' +
                    '<button type="button" class="btn btn--primary gate-opt" data-type="endomorph">Endomorph</button>' +
                '</div>' +
                '<div class="tracking-gate__footer">' +
                    '<span>' + getStr("planUnknownBodyTypeNote", "Don't know your body type?") + '</span> ' +
                    '<button type="button" class="link-btn" id="gate-classify-link">' + getStr("planUnknownBodyTypeLink", "Click here to find out") + '</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.querySelectorAll(".gate-opt").forEach(function(btn) {
            btn.addEventListener("click", function() {
                var type = btn.getAttribute("data-type");
                onSelect(type);
                overlay.classList.add("hidden");
            });
        });

        var classifyLink = $("gate-classify-link");
        if (classifyLink) {
            classifyLink.addEventListener("click", function() {
                overlay.classList.add("hidden");
                onClassify();
            });
        }

        var closeBtn = $("gate-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", function() {
                overlay.classList.add("hidden");
            });
        }
    }
    overlay.classList.remove("hidden");
  }

  global.FitAITrackingUI = {
    $: $,
    getStr: getStr,
    showSkeleton: showSkeleton,
    showResults: showResults,
    renderResults: renderResults,
    renderReminderList: renderReminderList,
    destroyCharts: destroyCharts,
    showAnalyzeError: showAnalyzeError,
    setAnalyzeLoading: setAnalyzeLoading,
    applyTrackingI18n: applyTrackingI18n,
    renderBodyTypeGate: renderBodyTypeGate,
    resetNutritionUI: function () {
      var input = $("track-food-input");
      if (input) input.value = "";
      showAnalyzeError("");
      showResults(false);
      destroyCharts();
      var reco = $("track-recommendations");
      if (reco) reco.classList.add("hidden");
      var breakdown = $("track-food-breakdown");
      if (breakdown) breakdown.innerHTML = "";
      var helper = $("track-food-breakdown-helper");
      if (helper) helper.remove();
      ["track-val-calories", "track-val-protein", "track-val-carbs", "track-val-fat"].forEach(function (id) {
        var el = $(id);
        if (el) el.textContent = "0";
      });
      ["track-cal-intake-value", "track-pro-intake-value"].forEach(function (id) {
        var el = $(id);
        if (el) el.textContent = id === "track-pro-intake-value" ? "0g" : "0";
      });
      ["track-cal-intake-target", "track-pro-intake-target"].forEach(function (id) {
        var el = $(id);
        if (el) el.textContent = id === "track-pro-intake-target" ? "/ 0g" : "/ 0 kcal";
      });
      ["track-cal-intake-pct", "track-pro-intake-pct"].forEach(function (id) {
        var el = $(id);
        if (el) el.textContent = "0%";
      });
      ["track-cal-intake-badge", "track-pro-intake-badge"].forEach(function (id) {
        var el = $(id);
        if (el) el.textContent = "Low";
      });
      ["track-cal-intake-hint", "track-pro-intake-hint"].forEach(function (id) {
        var el = $(id);
        if (el) el.textContent = "";
      });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
