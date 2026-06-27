(function (global) {
  var STORAGE_PROFILE = "fitai-profile";
  var STORAGE_HISTORY = "fitai-tracking-history";
  var STORAGE_SUMMARY = "fitai-daily-summary";
  var STORAGE_NUTRITION = "fitai-tracking-nutrition";
  var STORAGE_REMINDERS = "fitai-reminders";
  var STORAGE_RECOMMENDATIONS = "fitai-tracking-recommendations";

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadProfile() {
    return readJson(STORAGE_PROFILE, {});
  }

  function activityMultiplier(level) {
    var map = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      veryActive: 1.9,
    };
    return map[level] || 1.45;
  }

  function calculateTargets(profile) {
    profile = profile || {};
    var weight = Number(profile.weight_kg) || 70;
    var height = Number(profile.height_cm) || 170;
    var gender = profile.gender || "male";
    var goal = profile.goal || profile.detailGoal || "maintain";
    var bodyType = (profile.bodyTypeKey || "mesomorph").toLowerCase();
    var age = 30;

    var bmr =
      gender === "female"
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age + 5;
    var tdee = bmr * activityMultiplier(profile.activityLevel);

    if (goal === "weightLoss") tdee *= 0.85;
    else if (goal === "muscleGain") tdee *= 1.12;
    else if (goal === "tone") tdee *= 0.95;

    if (bodyType === "ectomorph" && goal === "muscleGain") tdee *= 1.08;
    if (bodyType === "endomorph" && goal === "weightLoss") tdee *= 0.92;
    if (bodyType === "mesomorph") tdee *= 1.0;

    var proteinPerKg = 1.6;
    if (goal === "muscleGain") proteinPerKg = 2.0;
    if (goal === "weightLoss") proteinPerKg = 1.8;
    if (bodyType === "ectomorph") proteinPerKg += 0.15;
    if (bodyType === "endomorph" && goal === "weightLoss") proteinPerKg = 1.9;

    return {
      calories: Math.round(tdee),
      protein_g: Math.round(weight * proteinPerKg),
      carbs_g: Math.round((tdee * 0.4) / 4),
      fat_g: Math.round((tdee * 0.25) / 9),
      bodyType: bodyType,
      goal: goal,
    };
  }

  function isMeaningfulIntake(summary, targets) {
    if (!summary) return false;
    var matched = summary.item_count || 0;
    var cal = summary.calories || 0;
    if (matched >= 2) return true;
    if (matched >= 1 && cal >= 350) return true;
    if (targets && targets.calories && cal >= targets.calories * 0.25) return true;
    return false;
  }

  function buildTomorrowRecommendations(summary, targets, profile) {
    profile = profile || loadProfile();
    targets = targets || calculateTargets(profile);
    var bodyType = (profile.bodyTypeKey || "mesomorph").toLowerCase();
    var goal = profile.goal || profile.detailGoal || "maintain";
    var calDiff = (summary.calories || 0) - targets.calories;
    var proteinDiff = (summary.protein_g || 0) - targets.protein_g;
    var cards = [];

    if (calDiff < -250) {
      if (bodyType === "ectomorph") {
        cards.push({
          title: "Increase calories tomorrow",
          body:
            "Your calories were below target today. Add milk, eggs, rice, and chicken to support your muscle gain goal.",
          type: "calories",
        });
      } else {
        cards.push({
          title: "Calorie intake was low",
          body: "Add a balanced meal with lean protein and complex carbs to reach your daily target tomorrow.",
          type: "calories",
        });
      }
    } else if (calDiff > 250) {
      if (bodyType === "endomorph" || goal === "weightLoss") {
        cards.push({
          title: "Reduce calories tomorrow",
          body: "Your calories exceeded your target. Lower portion sizes and increase workout intensity.",
          type: "burn",
        });
      } else {
        cards.push({
          title: "Slightly above target",
          body: "Keep portions moderate tomorrow and stay active to balance your intake.",
          type: "burn",
        });
      }
    } else {
      cards.push({
        title: "Balanced intake today",
        body: "You stayed close to your calorie target. Maintain similar portions tomorrow.",
        type: "calories",
      });
    }

    if (proteinDiff < -15) {
      cards.push({
        title: "Protein boost needed",
        body: "Add eggs, chicken, daal, or yogurt tomorrow to close your protein gap.",
        type: "protein",
      });
    }

    if (bodyType === "mesomorph") {
      cards.push({
        title: "Suggested exercise",
        body: "Mix strength training and moderate cardio tomorrow for balanced progress.",
        type: "exercise",
      });
    } else if (bodyType === "ectomorph") {
      cards.push({
        title: "Suggested exercise",
        body: "Prioritize compound lifts with moderate cardio so extra calories support muscle, not fatigue.",
        type: "exercise",
      });
    } else {
      cards.push({
        title: "Suggested exercise",
        body: "Include 30–40 minutes cardio plus full-body resistance work tomorrow.",
        type: "exercise",
      });
    }

    return {
      date: todayKey(),
      targets: targets,
      summary: summary,
      cards: cards,
    };
  }

  function saveAnalysisSession(text, apiResult) {
    var date = todayKey();
    var targets = calculateTargets(loadProfile());
    var summary = apiResult.summary || {};
    var entry = {
      id: "log_" + Date.now(),
      date: date,
      text: text,
      items: apiResult.items || [],
      summary: summary,
      targets: targets,
      createdAt: new Date().toISOString(),
    };

    var history = readJson(STORAGE_HISTORY, []);
    history.unshift(entry);
    writeJson(STORAGE_HISTORY, history.slice(0, 60));

    writeJson(STORAGE_NUTRITION, { date: date, items: entry.items, summary: summary });
    writeJson(STORAGE_SUMMARY, { date: date, totals: summary, targets: targets });

    var reco = null;
    if (isMeaningfulIntake(summary, targets)) {
      reco = buildTomorrowRecommendations(summary, targets, loadProfile());
      writeJson(STORAGE_RECOMMENDATIONS, reco);
    }
    return { entry: entry, recommendations: reco, targets: targets };
  }

  function getReminders() {
    return readJson(STORAGE_REMINDERS, []);
  }

  function saveReminders(list) {
    writeJson(STORAGE_REMINDERS, list);
  }

  function clearAllTrackingData() {
    [
      STORAGE_HISTORY,
      STORAGE_SUMMARY,
      STORAGE_NUTRITION,
      STORAGE_REMINDERS,
      STORAGE_RECOMMENDATIONS,
    ].forEach(function (key) {
      localStorage.removeItem(key);
    });
  }

  global.FitAITrackingState = {
    STORAGE_REMINDERS: STORAGE_REMINDERS,
    todayKey: todayKey,
    loadProfile: loadProfile,
    calculateTargets: calculateTargets,
    isMeaningfulIntake: isMeaningfulIntake,
    saveAnalysisSession: saveAnalysisSession,
    getReminders: getReminders,
    saveReminders: saveReminders,
    buildTomorrowRecommendations: buildTomorrowRecommendations,
    clearAllTrackingData: clearAllTrackingData,
  };
})(typeof window !== "undefined" ? window : globalThis);
