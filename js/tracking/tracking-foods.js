(function (global) {
  function apiBase() {
    if (typeof window === "undefined") return "http://127.0.0.1:5000";
    var b = window.FITAI_API_BASE;
    if (b === "" || b === null) return "";
    if (b !== undefined) return String(b).replace(/\/$/, "");
    var o = window.location.origin || "";
    if (o && o !== "null" && o.indexOf("file") !== 0) return "";
    return "http://127.0.0.1:5000";
  }

  function analyzeUrl() {
    if (typeof window !== "undefined" && window.location && window.location.origin && window.location.origin !== "null") {
      return window.location.origin + "/analyze-food";
    }
    var base = apiBase();
    return base === "" ? "/analyze-food" : base + "/analyze-food";
  }

  function normalizeAnalyzeResult(data) {
    if (!data || typeof data !== "object") {
      return { success: false, items: [], summary: {}, nutrition: {}, matched_count: 0 };
    }

    var items = data.items || [];
    var matchedItems = items.filter(function (item) {
      return item && (item.status === "matched" || item.matched_food);
    });

    if (data.summary) {
      var summary = Object.assign({}, data.summary);
      if (!summary.item_count) {
        summary.item_count = data.matched_count || matchedItems.length || 0;
      }
      var nutrition = data.nutrition || {
        calories: summary.calories || 0,
        protein: summary.protein_g != null ? summary.protein_g : summary.protein || 0,
        carbs: summary.carbs_g != null ? summary.carbs_g : summary.carbs || 0,
        fat: summary.fat_g != null ? summary.fat_g : summary.fat || 0,
        fiber: summary.fiber_g || summary.fiber || 0,
      };
      return {
        success: data.success !== false && (matchedItems.length > 0 || summary.item_count > 0 || summary.calories > 0),
        items: items,
        summary: summary,
        nutrition: nutrition,
        matched_count: data.matched_count || summary.item_count || matchedItems.length,
      };
    }

    var n = data.nutrition || {};
    var summaryFromNutrition = {
      calories: Number(n.calories || 0),
      protein_g: Number(n.protein_g != null ? n.protein_g : n.protein || 0),
      carbs_g: Number(n.carbs_g != null ? n.carbs_g : n.carbs || 0),
      fat_g: Number(n.fat_g != null ? n.fat_g : n.fat || 0),
      fiber_g: Number(n.fiber_g || n.fiber || 0),
      item_count: Number(data.matched_count || matchedItems.length || (n.calories ? 1 : 0)),
    };

    return {
      success: data.success !== false && (matchedItems.length > 0 || summaryFromNutrition.item_count > 0 || summaryFromNutrition.calories > 0),
      items: items,
      summary: summaryFromNutrition,
      nutrition: n,
      matched_count: summaryFromNutrition.item_count,
    };
  }

  async function postFoodApi(payload) {
    var res;
    try {
      res = await fetch(analyzeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error("Unable to analyze food right now");
    }
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.error || "Unable to analyze food right now");
    }
    return data;
  }

  function analyzeFoodText(text) {
    return postFoodApi({ mode: "analyze", text: text }).then(normalizeAnalyzeResult);
  }

  function fetchSuggestions(query) {
    return postFoodApi({ mode: "suggest", query: query }).then(function (data) {
      return data.suggestions || [];
    });
  }

  global.FitAITrackingFoods = {
    analyzeFoodText: analyzeFoodText,
    fetchSuggestions: fetchSuggestions,
    normalizeAnalyzeResult: normalizeAnalyzeResult,
  };
})(typeof window !== "undefined" ? window : globalThis);
