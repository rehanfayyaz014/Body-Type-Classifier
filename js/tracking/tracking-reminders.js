(function (global) {
  var timers = [];
  var S = global.FitAITrackingState;

  // ── Sound toggle ──────────────────────────────────────────────────────────
  var SOUND_KEY = "fitai-reminder-sound";
  function isSoundEnabled() {
    try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch(e) { return true; }
  }
  function setSoundEnabled(val) {
    try { localStorage.setItem(SOUND_KEY, val ? "on" : "off"); } catch(e) {}
  }

  // ── Chime sound ───────────────────────────────────────────────────────────
  function playBeep() {
    if (!isSoundEnabled()) return;
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1100].forEach(function(freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        var start = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
        osc.start(start);
        osc.stop(start + 0.6);
      });
    } catch(e) {}
  }

  // ── Emoji map per reminder type ──────────────────────────────────────────
  var TYPE_EMOJI = {
    "Breakfast"  : "🍳",
    "Lunch"      : "🍱",
    "Dinner"     : "🍽️",
    "Workout"    : "💪",
    "Water"      : "💧",
    "Medicine"   : "💊",
    "Sleep"      : "😴",
    "Custom"     : "🔔",
  };

  function getEmoji(type) {
    return TYPE_EMOJI[type] || "🔔";
  }

  // ── In-app toast popup notification ──────────────────────────────────────
  function showToast(title, body) {
    // Remove existing toasts
    var old = document.getElementById("fitai-reminder-toast");
    if (old) old.remove();

    var toast = document.createElement("div");
    toast.id = "fitai-reminder-toast";
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");

    var emoji = getEmoji(title.replace(" Reminder", "").replace("FitAI ", ""));

    toast.innerHTML =
      '<div class="fitai-toast__icon">' + emoji + '</div>' +
      '<div class="fitai-toast__content">' +
        '<div class="fitai-toast__title">' + escapeHtml(title) + '</div>' +
        '<div class="fitai-toast__body">' + escapeHtml(body) + '</div>' +
      '</div>' +
      '<button class="fitai-toast__close" aria-label="Dismiss" onclick="this.parentNode.remove()">✕</button>';

    // Inject styles if not already present
    if (!document.getElementById("fitai-toast-style")) {
      var style = document.createElement("style");
      style.id = "fitai-toast-style";
      style.textContent = [
        "#fitai-reminder-toast {",
        "  position: fixed; bottom: 24px; right: 24px; z-index: 99999;",
        "  display: flex; align-items: flex-start; gap: 12px;",
        "  min-width: 280px; max-width: 360px;",
        "  padding: 14px 16px;",
        "  background: linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.97) 100%);",
        "  border: 1px solid rgba(45,212,191,0.35);",
        "  border-radius: 16px;",
        "  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(45,212,191,0.1);",
        "  backdrop-filter: blur(12px);",
        "  animation: fitaiToastIn 0.35s cubic-bezier(0.34,1.56,0.64,1);",
        "  font-family: inherit;",
        "}",
        "@keyframes fitaiToastIn {",
        "  from { opacity:0; transform: translateY(20px) scale(0.92); }",
        "  to   { opacity:1; transform: translateY(0) scale(1); }",
        "}",
        ".fitai-toast__icon {",
        "  font-size: 1.75rem; line-height: 1; flex-shrink: 0; margin-top: 2px;",
        "}",
        ".fitai-toast__content { flex: 1; min-width: 0; }",
        ".fitai-toast__title {",
        "  font-size: 0.9rem; font-weight: 700;",
        "  color: #2dd4bf; margin-bottom: 4px;",
        "}",
        ".fitai-toast__body {",
        "  font-size: 0.82rem; color: rgba(255,255,255,0.8); line-height: 1.4;",
        "}",
        ".fitai-toast__close {",
        "  background: none; border: none; cursor: pointer;",
        "  color: rgba(255,255,255,0.4); font-size: 0.85rem;",
        "  padding: 0; line-height: 1; flex-shrink: 0;",
        "  transition: color 0.2s;",
        "}",
        ".fitai-toast__close:hover { color: rgba(255,255,255,0.9); }",
      ].join("\n");
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto-dismiss after 8 seconds
    setTimeout(function() {
      if (toast.parentNode) {
        toast.style.transition = "opacity 0.4s, transform 0.4s";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 400);
      }
    }, 8000);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Notification permission ───────────────────────────────────────────────
  function requestNotificationPermission(onDone) {
    if (!("Notification" in window)) { onDone(false, "not_supported"); return; }
    if (Notification.permission === "granted") { onDone(true, "granted"); return; }
    if (Notification.permission === "denied")  { onDone(false, "denied");  return; }
    Notification.requestPermission().then(function(p) {
      onDone(p === "granted", p);
    });
  }

  // ── Show notification: toast (always) + OS notification (if permitted) ───
  function showNotification(title, body) {
    playBeep();

    // Always show in-app toast (works even without permission)
    showToast(title, body);

    // Also send OS notification via Service Worker (background support)
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title: title,
        body: body,
        icon: "/static/favicon.ico"
      });
      return;
    }

    // Direct OS notification fallback
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body: body });
      } catch(e) {}
    }
  }

  // ── Build rich title/body with emoji ─────────────────────────────────────
  function buildNotification(reminder) {
    var emoji = getEmoji(reminder.type);
    var title, body;

    switch (reminder.type) {
      case "Breakfast":
        title = emoji + " Breakfast Time!";
        body  = reminder.message || "Nashta karne ka waqt ho gaya! Healthy breakfast khayein. 🥚🍳";
        break;
      case "Lunch":
        title = emoji + " Lunch Time!";
        body  = reminder.message || "Dopahar ka khana khane ka waqt! Balanced meal lijiye. 🍱";
        break;
      case "Dinner":
        title = emoji + " Dinner Time!";
        body  = reminder.message || "Dinner ka waqt ho gaya. Light aur nutritious khana khayein. 🍽️";
        break;
      case "Workout":
        title = emoji + " Workout Time!";
        body  = reminder.message || "Exercise karne ka waqt! Body ko active rakhein. 🏋️‍♂️";
        break;
      case "Water":
        title = emoji + " Pani Piyein!";
        body  = reminder.message || "1 glass pani piyein. Hydrated rehna zaroori hai! 💧";
        break;
      case "Medicine":
        title = emoji + " Medicine Reminder";
        body  = reminder.message || "Dawai lene ka waqt ho gaya. Mat bhoolen! 💊";
        break;
      case "Sleep":
        title = emoji + " Sone Ka Waqt!";
        body  = reminder.message || "7-8 ghante ki neend zaroor lein. Good night! 😴";
        break;
      default:
        title = emoji + " FitAI Reminder";
        body  = reminder.message || "Aapka reminder set waqt par aa gaya hai!";
    }
    return { title: title, body: body };
  }

  // ── Timer helpers ─────────────────────────────────────────────────────────
  function parseTime(timeStr) {
    var parts = String(timeStr || "08:00").split(":");
    return { h: parseInt(parts[0], 10) || 0, m: parseInt(parts[1], 10) || 0 };
  }

  function msUntil(timeStr) {
    var t = parseTime(timeStr);
    var now = new Date();
    var target = new Date();
    target.setHours(t.h, t.m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target.getTime() - now.getTime();
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function scheduleReminder(reminder) {
    if (!reminder.enabled) return;
    var delay = msUntil(reminder.time);
    var id = setTimeout(function() {
      var notif = buildNotification(reminder);
      showNotification(notif.title, notif.body);
      scheduleReminder(reminder); // reschedule for next day
    }, delay);
    timers.push(id);
  }

  function rescheduleAll(reminders) {
    clearTimers();
    (reminders || []).forEach(scheduleReminder);
  }

  function addReminder(data) {
    var list = S.getReminders();
    var item = {
      id: "rem_" + Date.now(),
      time: data.time,
      type: data.type,
      message: data.message || "",
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    S.saveReminders(list);
    scheduleReminder(item);
    return item;
  }

  function removeReminder(id) {
    var list = S.getReminders().filter(function(r) { return r.id !== id; });
    S.saveReminders(list);
    rescheduleAll(list);
  }

  function initReminders() {
    rescheduleAll(S.getReminders());
  }

  global.FitAITrackingReminders = {
    requestNotificationPermission: requestNotificationPermission,
    addReminder: addReminder,
    removeReminder: removeReminder,
    initReminders: initReminders,
    getReminders: S.getReminders,
    isSoundEnabled: isSoundEnabled,
    setSoundEnabled: setSoundEnabled,
    showToast: showToast, // exposed for testing
  };
})(typeof window !== "undefined" ? window : globalThis);
