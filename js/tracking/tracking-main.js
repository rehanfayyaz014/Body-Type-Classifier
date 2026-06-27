(function (global) {
  var suggestTimer = null;
  var suggestIndex = -1;
  var currentSuggestions = [];
  var trackingBooted = false;
  var suggestDocClickBound = false;

  var VIEWS = ["view-landing", "view-quiz", "view-plan", "view-result", "view-detail"];
  var TRACK_VIEWS = ["view-tracking-hub", "view-tracking-nutrition", "view-tracking-reminders"];

  function $(id) {
    return document.getElementById(id);
  }

  function whenReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function isTrackingModule() {
    return new URLSearchParams(window.location.search).get("module") === "tracking";
  }

  function getUI() {
    return global.FitAITrackingUI;
  }

  function getFoods() {
    return global.FitAITrackingFoods;
  }

  function getState() {
    return global.FitAITrackingState;
  }

  function getReminders() {
    return global.FitAITrackingReminders;
  }

  function hasMatchedFoods(result) {
    if (!result) return false;
    if ((result.items || []).some(function (item) {
      return item && (item.status === "matched" || item.matched_food);
    })) return true;
    if (result.success === false) return false;
    var summary = result.summary || {};
    var count = Number(summary.item_count || result.matched_count || 0);
    if (count > 0) return true;
    if (Number(summary.calories || 0) > 0) return true;
    var nutrition = result.nutrition || {};
    if (Number(nutrition.calories || 0) > 0) return true;
    return false;
  }

  function hideAppViews() {
    VIEWS.forEach(function (id) {
      var el = $(id);
      if (el) el.classList.add("hidden");
    });
  }

  function showTrackView(id) {
    hideAppViews();
    TRACK_VIEWS.forEach(function (vid) {
      var el = $(vid);
      if (el) el.classList.toggle("hidden", vid !== id);
    });
    updateHeader(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateHeader(inModule) {
    var back = $("btn-back");
    var dash = $("btn-dashboard");
    if (back) back.classList.toggle("hidden", !inModule);
    if (dash) dash.classList.toggle("hidden", !inModule);
  }

  function goHub() {
    showTrackView("view-tracking-hub");
  }

  function goNutrition() {
    showTrackView("view-tracking-nutrition");
    bindNutritionView();
  }

  function goReminders() {
    showTrackView("view-tracking-reminders");
    refreshReminderUI();
  }

  function goDashboard() {
    window.location.href = "/dashboard";
  }

  function onBack() {
    var hub = $("view-tracking-hub");
    if (hub && !hub.classList.contains("hidden")) {
      goDashboard();
      return;
    }
    goHub();
  }

  function bindHeader() {
    var back = $("btn-back");
    var dash = $("btn-dashboard");
    if (back && back.getAttribute("data-track-bound") !== "1") {
      back.setAttribute("data-track-bound", "1");
      back.addEventListener("click", onBack);
    }
    if (dash && dash.getAttribute("data-track-bound") !== "1") {
      dash.setAttribute("data-track-bound", "1");
      dash.addEventListener("click", goDashboard);
    }
  }

  function bindHub() {
    var nutritionCard = $("track-card-nutrition");
    var remindersCard = $("track-card-reminders");
    if (nutritionCard && nutritionCard.getAttribute("data-track-bound") !== "1") {
      nutritionCard.setAttribute("data-track-bound", "1");
      nutritionCard.addEventListener("click", goNutrition);
    }
    if (remindersCard && remindersCard.getAttribute("data-track-bound") !== "1") {
      remindersCard.setAttribute("data-track-bound", "1");
      remindersCard.addEventListener("click", goReminders);
    }
  }

  function hideSuggest() {
    var box = $("track-suggest");
    if (box) box.classList.add("hidden");
    suggestIndex = -1;
    currentSuggestions = [];
  }

  function applySuggestion(item) {
    var ta = $("track-food-input");
    if (!ta || !item) return;
    var val = ta.value;
    var lines = val.split("\n");
    var last = lines[lines.length - 1];
    if (last.indexOf(":") >= 0 && last.indexOf(":") < last.length - 1) {
      lines[lines.length - 1] = last.replace(/[^:]*$/, " " + item.insert_text);
    } else if (last.trim()) {
      lines[lines.length - 1] = last + ", " + item.insert_text;
    } else {
      lines[lines.length - 1] = item.insert_text;
    }
    ta.value = lines.join("\n");
    ta.focus();
    hideSuggest();
  }

  function renderSuggest(list) {
    var box = $("track-suggest");
    if (!box) return;
    currentSuggestions = list || [];
    if (!currentSuggestions.length) {
      hideSuggest();
      return;
    }
    box.innerHTML = "";
    currentSuggestions.forEach(function (item, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tracking-suggest__item" + (idx === suggestIndex ? " is-active" : "");
      btn.textContent = item.label;
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        applySuggestion(item);
      });
      box.appendChild(btn);
    });
    box.classList.remove("hidden");
  }

  function runAnalyze() {
    var ui = getUI();
    var foods = getFoods();
    var stateApi = getState();
    if (!ui) return;

    var input = $("track-food-input");
    var text = (input && input.value ? input.value : "").trim();
    ui.showAnalyzeError("");

    if (!text) {
      ui.showAnalyzeError("Please enter food items");
      ui.showResults(false);
      return;
    }

    if (!foods || !foods.analyzeFoodText) {
      ui.showAnalyzeError("Unable to analyze food right now");
      return;
    }

    ui.setAnalyzeLoading(true);
    ui.showResults(false);
    var reco = $("track-recommendations");
    if (reco) reco.classList.add("hidden");

    foods
      .analyzeFoodText(text)
      .then(function (result) {
        ui.setAnalyzeLoading(false);
        // #region agent log
        fetch("http://127.0.0.1:7460/ingest/e1f322df-fef2-4388-9086-e7c3e5afbefc", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "97d6cc" }, body: JSON.stringify({ sessionId: "97d6cc", hypothesisId: "B", location: "tracking-main.js:runAnalyze.then", message: "Normalized result", data: { success: result && result.success, matched: hasMatchedFoods(result), item_count: result && result.summary && result.summary.item_count, calories: result && result.summary && result.summary.calories, items_len: result && result.items && result.items.length }, timestamp: Date.now() }) }).catch(function () {});
        // #endregion
        if (!hasMatchedFoods(result)) {
          ui.showAnalyzeError("Please enter food items");
          ui.showResults(false);
          return;
        }
        try {
          var session = null;
          if (stateApi && stateApi.saveAnalysisSession) {
            session = stateApi.saveAnalysisSession(text, result);
          } else {
            session = {
              targets: (stateApi && stateApi.calculateTargets)
                ? stateApi.calculateTargets(stateApi.loadProfile ? stateApi.loadProfile() : {})
                : {},
              recommendations: null,
            };
          }
          ui.renderResults(result, session);
          // #region agent log
          fetch("http://127.0.0.1:7460/ingest/e1f322df-fef2-4388-9086-e7c3e5afbefc", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "97d6cc" }, body: JSON.stringify({ sessionId: "97d6cc", hypothesisId: "C", location: "tracking-main.js:runAnalyze.render", message: "renderResults called", data: { has_session: !!session }, timestamp: Date.now() }) }).catch(function () {});
          // #endregion
        } catch (err) {
          // #region agent log
          fetch("http://127.0.0.1:7460/ingest/e1f322df-fef2-4388-9086-e7c3e5afbefc", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "97d6cc" }, body: JSON.stringify({ sessionId: "97d6cc", hypothesisId: "D", location: "tracking-main.js:runAnalyze.catch", message: "render threw", data: { err: String(err && err.message ? err.message : err) }, timestamp: Date.now() }) }).catch(function () {});
          // #endregion
          ui.showAnalyzeError("Unable to analyze food right now");
          ui.showResults(false);
        }
      })
      .catch(function () {
        ui.setAnalyzeLoading(false);
        ui.showResults(false);
        ui.showAnalyzeError("Unable to analyze food right now");
      });
  }

  function onNutritionClick(e) {
    var analyzeBtn = e.target.closest("#track-analyze-btn");
    if (!analyzeBtn) return;
    e.preventDefault();
    e.stopPropagation();
    runAnalyze();
  }

  function onNutritionInput(e) {
    if (!e.target || e.target.id !== "track-food-input") return;
    var foods = getFoods();
    clearTimeout(suggestTimer);
    var text = e.target.value;
    var fragment = text.split("\n").pop() || "";
    var query = fragment.split(/[,+]/).pop().trim();
    if (query.length < 2) {
      hideSuggest();
      return;
    }
    suggestTimer = setTimeout(function () {
      if (!foods || !foods.fetchSuggestions) return;
      foods.fetchSuggestions(query).then(renderSuggest).catch(hideSuggest);
    }, 220);
  }

  function onNutritionKeydown(e) {
    if (!e.target || e.target.id !== "track-food-input") return;
    var suggestBox = $("track-suggest");
    if (!suggestBox || suggestBox.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      suggestIndex = Math.min(currentSuggestions.length - 1, suggestIndex + 1);
      renderSuggest(currentSuggestions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      suggestIndex = Math.max(0, suggestIndex - 1);
      renderSuggest(currentSuggestions);
    } else if (e.key === "Enter" && suggestIndex >= 0) {
      e.preventDefault();
      applySuggestion(currentSuggestions[suggestIndex]);
    } else if (e.key === "Escape") {
      hideSuggest();
    }
  }

  function bindNutritionView() {
    var section = $("view-tracking-nutrition");
    if (!section) return;

    if (section.getAttribute("data-events-bound") !== "1") {
      section.setAttribute("data-events-bound", "1");
      section.addEventListener("click", onNutritionClick);
      section.addEventListener("input", onNutritionInput);
      section.addEventListener("keydown", onNutritionKeydown);
    }

    if (!suggestDocClickBound) {
      suggestDocClickBound = true;
      document.addEventListener("click", onDocumentClickSuggest);
    }
  }

  function onDocumentClickSuggest(e) {
    if (!e.target.closest(".tracking-input-wrap")) hideSuggest();
  }

  function refreshReminderUI() {
    var ui = getUI();
    var Reminders = getReminders();
    if (!ui || !Reminders) return;
    ui.renderReminderList(Reminders.getReminders(), function (id) {
      Reminders.removeReminder(id);
      refreshReminderUI();
    });
    var customWrap = $("track-custom-msg-wrap");
    var typeSel = $("track-reminder-type");
    if (customWrap && typeSel) {
      customWrap.classList.toggle("hidden", typeSel.value !== "Custom");
    }
  }

  function bindReminders() {
    var typeSel = $("track-reminder-type");
    var enableBtn = $("track-enable-notify");
    var addBtn = $("track-add-reminder");
    var Reminders = getReminders();

    if (typeSel && typeSel.getAttribute("data-track-bound") !== "1") {
      typeSel.setAttribute("data-track-bound", "1");
      typeSel.addEventListener("change", refreshReminderUI);
    }
    if (enableBtn && enableBtn.getAttribute("data-track-bound") !== "1") {
      enableBtn.setAttribute("data-track-bound", "1");
      enableBtn.addEventListener("click", function () {
        if (!Reminders) return;
        Reminders.requestNotificationPermission(function (ok) {
          var banner = $("track-notify-banner");
          if (banner) {
            banner.textContent = ok
              ? "Notifications enabled. Reminders will alert while this tab is open."
              : "Notifications blocked. Enable them in browser settings for alerts.";
          }
        });
      });
    }
    if (addBtn && addBtn.getAttribute("data-track-bound") !== "1") {
      addBtn.setAttribute("data-track-bound", "1");
      addBtn.addEventListener("click", function () {
        if (!Reminders) return;
        var time = $("track-reminder-time");
        var type = $("track-reminder-type");
        var msg = $("track-reminder-message");
        var timeVal = (time && time.value) || "08:00";
        var typeVal = (type && type.value) || "Breakfast";
        var msgVal = (msg && msg.value) || "";
        if (typeVal === "Custom" && !msgVal.trim()) {
          alert("Please enter a custom reminder message.");
          return;
        }
        Reminders.addReminder({ time: timeVal, type: typeVal, message: msgVal.trim() });
        refreshReminderUI();
        if (msg) msg.value = "";
      });
    }
  }

  function bootTrackingOnce() {
    if (trackingBooted) return;
    trackingBooted = true;
    bindHeader();
    bindHub();
    bindNutritionView();
    bindReminders();
    var Reminders = getReminders();
    if (Reminders && Reminders.initReminders) Reminders.initReminders();
    goHub();
  }

  function init() {
    whenReady(bootTrackingOnce);
  }

  global.FitAITracking = {
    init: init,
    goHub: goHub,
    goNutrition: goNutrition,
    goReminders: goReminders,
    bindNutritionView: bindNutritionView,
  };

  whenReady(function () {
    if (isTrackingModule()) {
      bootTrackingOnce();
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
