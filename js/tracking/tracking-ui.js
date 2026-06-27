(function (global) {
  var charts = [];

  function $(id) {
    return document.getElementById(id);
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
      { id: "track-chart-cal", key: "calories", target: targets.calories, color: "#2dd4bf" },
      { id: "track-chart-protein", key: "protein_g", target: targets.protein_g, color: "#22d3ee" },
      { id: "track-chart-carbs", key: "carbs_g", target: targets.carbs_g, color: "#818cf8" },
      { id: "track-chart-fat", key: "fat_g", target: targets.fat_g, color: "#f472b6" },
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
            datasets: [
              {
                data: [pct, Math.max(0, 100 - pct)],
                backgroundColor: [p.color, "rgba(255,255,255,0.08)"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            cutout: "72%",
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { animateRotate: true, duration: 800 },
          },
        });
        charts.push(chart);
      } catch (e) {
        /* chart render is optional */
      }
    });
  }

  function renderTargetBars(summary, targets) {
    var calPct = Math.min(100, Math.round(((summary.calories || 0) / (targets.calories || 1)) * 100));
    var proPct = Math.min(100, Math.round(((summary.protein_g || 0) / (targets.protein_g || 1)) * 100));
    var calFill = $("track-cal-bar-fill");
    var proFill = $("track-pro-bar-fill");
    var calLabel = $("track-cal-bar-label");
    var proLabel = $("track-pro-bar-label");
    if (calFill) calFill.style.width = calPct + "%";
    if (proFill) proFill.style.width = proPct + "%";
    if (calLabel) calLabel.textContent = (summary.calories || 0) + " / " + targets.calories + " kcal";
    if (proLabel) proLabel.textContent = (summary.protein_g || 0) + " / " + targets.protein_g + " g protein";
  }

  function renderFoodBreakdown(items) {
    var wrap = $("track-food-breakdown");
    if (!wrap) return;
    wrap.innerHTML = "";
    (items || [])
      .filter(function (i) {
        return i && (i.status === "matched" || i.matched_food);
      })
      .forEach(function (item) {
        var card = document.createElement("div");
        card.className = "tracking-food-item glass-card animate-in";
        card.innerHTML =
          '<div class="tracking-food-item__name">' +
          (item.matched_food || item.raw_input) +
          "</div>" +
          '<div class="tracking-food-item__meta">Calories: ' +
          (item.calories || 0) +
          " kcal · Protein: " +
          (item.protein_g || 0) +
          "g · Carbs: " +
          (item.carbs_g || 0) +
          "g · Fat: " +
          (item.fat_g || 0) +
          "g</div>" +
          (item.portion ? '<div class="tracking-food-item__meta">' + item.portion + "</div>" : "") +
          (item.source === "usda" ? '<div class="tracking-food-item__meta">Source: USDA estimate</div>' : "");
        wrap.appendChild(card);
      });
  }

  function renderRecommendations(reco) {
    var section = $("track-recommendations");
    var list = $("track-reco-list");
    if (!section || !list) return;
    if (!reco || !reco.cards || !reco.cards.length) {
      section.classList.add("hidden");
      return;
    }
    section.classList.remove("hidden");
    list.innerHTML = "";
    reco.cards.forEach(function (card) {
      var el = document.createElement("div");
      el.className =
        "tracking-reco-card glass-card animate-in" + (card.type === "burn" ? " tracking-reco-card--burn" : "");
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
      calories: Number(n.calories || 0),
      protein_g: Number(n.protein_g != null ? n.protein_g : n.protein || 0),
      carbs_g: Number(n.carbs_g != null ? n.carbs_g : n.carbs || 0),
      fat_g: Number(n.fat_g != null ? n.fat_g : n.fat || 0),
      fiber_g: Number(n.fiber_g || n.fiber || 0),
      item_count: Number(apiResult.matched_count || 0),
    };
  }

  function renderResults(apiResult, session) {
    var summary = resolveSummary(apiResult);
    var targets = (session && session.targets) || {};
    if (!targets.calories && global.FitAITrackingState && global.FitAITrackingState.calculateTargets) {
      targets = global.FitAITrackingState.calculateTargets(
        global.FitAITrackingState.loadProfile ? global.FitAITrackingState.loadProfile() : {}
      );
    }
    showResults(true);
    // #region agent log
    fetch("http://127.0.0.1:7460/ingest/e1f322df-fef2-4388-9086-e7c3e5afbefc", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "97d6cc" }, body: JSON.stringify({ sessionId: "97d6cc", hypothesisId: "E", location: "tracking-ui.js:renderResults", message: "showResults true", data: { el_exists: !!$("track-results"), hidden: $("track-results") ? $("track-results").classList.contains("hidden") : null, parent_hidden: $("view-tracking-nutrition") ? $("view-tracking-nutrition").classList.contains("hidden") : null, summary_cal: summary.calories }, timestamp: Date.now() }) }).catch(function () {});
    // #endregion
    renderTargetBars(summary, targets);
    renderFoodBreakdown(apiResult.items);
    renderRecommendations(session && session.recommendations);
    try {
      renderMacroCharts(summary, targets);
    } catch (e) {
      /* charts are optional; macro values still shown in stat cards */
    }
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
      wrap.innerHTML = '<p class="tracking-empty-note">No reminders yet. Add one above.</p>';
      return;
    }
    reminders.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "tracking-reminder-item glass-card";
      row.innerHTML =
        '<div><div class="tracking-reminder-item__time">' +
        r.time +
        '</div><div class="tracking-reminder-item__type">' +
        r.type +
        (r.message ? " — " + r.message : "") +
        "</div></div>" +
        '<button type="button" class="btn btn--ghost btn--sm" data-id="' +
        r.id +
        '">Remove</button>";
      row.querySelector("button").addEventListener("click", function () {
        onDelete(r.id);
      });
      wrap.appendChild(row);
    });
  }

  global.FitAITrackingUI = {
    $: $,
    showSkeleton: showSkeleton,
    showResults: showResults,
    renderResults: renderResults,
    renderReminderList: renderReminderList,
    destroyCharts: destroyCharts,
    showAnalyzeError: showAnalyzeError,
    setAnalyzeLoading: setAnalyzeLoading,
  };
})(typeof window !== "undefined" ? window : globalThis);
