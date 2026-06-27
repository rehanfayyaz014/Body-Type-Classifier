(function (global) {
  var timers = [];
  var S = global.FitAITrackingState;

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

  function requestNotificationPermission(onDone) {
    if (!("Notification" in window)) {
      onDone(false);
      return;
    }
    if (Notification.permission === "granted") {
      onDone(true);
      return;
    }
    if (Notification.permission === "denied") {
      onDone(false);
      return;
    }
    Notification.requestPermission().then(function (p) {
      onDone(p === "granted");
    });
  }

  function showNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      new Notification(title, { body: body, icon: "/assets/icon.png" });
    } catch (e) {
      /* ignore */
    }
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function scheduleReminder(reminder) {
    if (!reminder.enabled) return;
    var delay = msUntil(reminder.time);
    var id = setTimeout(function () {
      var title = reminder.type === "Custom" ? "FitAI Reminder" : reminder.type + " Reminder";
      var body = reminder.message || "Time for your " + reminder.type.toLowerCase() + ".";
      showNotification(title, body);
      scheduleReminder(reminder);
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
    var list = S.getReminders().filter(function (r) {
      return r.id !== id;
    });
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
  };
})(typeof window !== "undefined" ? window : globalThis);
