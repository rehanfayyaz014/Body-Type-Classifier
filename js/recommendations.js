/**
 * Composes diet / weekly / tips from base i18n plans + gender, activity level, workout preference.
 */
(function (global) {
  var MODS = {
    en: {
      genderDietLine: function (gender, goal, bodyType) {
        if (gender === "female") {
          if (goal === "tone" || goal === "weightLoss") {
            return "Include iron-rich options (lean meat, beans, leafy greens) and steady protein across meals.";
          }
          return "Adequate protein and calcium-rich foods support training recovery.";
        }
        if (goal === "muscleGain") {
          return "Emphasize lean protein each meal; add carbs around workouts for performance.";
        }
        return "Lean protein at each meal; adjust carbs to match goal and energy.";
      },
      activityDiet: {
        sedentary:
          "Low daily movement: structure 3 meals + 1 protein snack; avoid mindless grazing; add a 10–15 min walk after meals.",
        light: "Light activity: keep protein consistent; time most carbs around training or midday.",
        moderate: "Moderate activity: match hydration to sweat; split protein across 3–4 feeds.",
        active: "Active lifestyle: prioritize recovery meals with carbs + protein after hard sessions.",
        veryActive:
          "Very active: higher fluid/electrolyte needs; add a carb + protein snack on long days.",
      },
      activityTips: {
        sedentary: "Set hourly movement reminders; aim for 5–7k steps before adding intensity.",
        light: "Build toward 7–8k steps on non-training days.",
        moderate: "Use steps + sessions together; avoid all-or-nothing cardio.",
        active: "Watch fatigue; one full rest day weekly if sleep drops.",
        veryActive: "Extra mobility and sleep matter more than extra sessions.",
      },
      prefWeeklyNote: {
        gym: "Equipment: barbells, dumbbells, cables, machines.",
        home: "Equipment: dumbbells, resistance bands, bench optional.",
        mixed: "Split: 2 gym days + home/bodyweight days.",
        outdoor: "Outdoor: hills, track repeats, park calisthenics, cycling.",
        bodyweight: "Minimal gear: pull-up bar/rings optional; focus on push-up & squat progressions.",
      },
      prefTips: {
        gym: "Log loads weekly; machines are fine for isolation after compounds.",
        home: "Tempo and pauses make light loads effective.",
        mixed: "Keep gym days for heavy compounds; home for accessories.",
        outdoor: "Weather-proof plan B (indoor stairs/bodyweight) for missed sessions.",
        bodyweight: "Add vest or slow eccentrics when reps get easy.",
      },
    },
    romanUrdu: {
      genderDietLine: function (gender, goal) {
        if (gender === "female") {
          return "Har meal mein protein; iron wale options (lean meat, daal, sabzi) shamil karein.";
        }
        return "Har meal lean protein; carbs ko goal ke hisaab se adjust karein.";
      },
      activityDiet: {
        sedentary:
          "Kam harkat: 3 meals + 1 protein snack; random snacking kam; khane ke baad 10–15 min walk.",
        light: "Halki activity: protein steady; zyada carbs training/midday ke aas paas.",
        moderate: "Darmiyani: pani zyada; protein 3–4 dafa divide karein.",
        active: "Ziyada active: hard session ke baad carbs + protein recovery meal.",
        veryActive: "Bohat active: lambe din par extra carb + protein snack; fluid/electrolytes.",
      },
      activityTips: {
        sedentary: "Har ghante uth ke chalen; 5–7k steps pehla target.",
        light: "Non-training din 7–8k steps ki taraf barhein.",
        moderate: "Steps + sessions balance; over-cardio se parhez.",
        active: "Thakan dekhein; neend kam ho to ek din rest.",
        veryActive: "Mobility aur neend zyada sessions se zyada zaroori.",
      },
      prefWeeklyNote: {
        gym: "Gym: barbell, dumbbell, cable, machine.",
        home: "Ghar: dumbbell, bands, bench optional.",
        mixed: "Mix: 2 gym din + ghar/bodyweight din.",
        outdoor: "Outdoor: hill, track, park calisthenics, cycle.",
        bodyweight: "Kam samaan: pull-up bar optional; push-up/squat progressions.",
      },
      prefTips: {
        gym: "Har hafta weights log karein.",
        home: "Tempo aur pause se load barhao.",
        mixed: "Gym par heavy; ghar par accessories.",
        outdoor: "Mausam kharab ho to plan B (andar stairs/bodyweight).",
        bodyweight: "Reps asaan hon to slow negative ya extra set.",
      },
    },
    ur: {
      genderDietLine: function (gender) {
        if (gender === "female") {
          return "ہر کھانے میں پروٹین؛ آئرن والے اختیارات (گوشت، دال، سبزیاں) شامل کریں۔";
        }
        return "ہر کھانے میں لیان پروٹین؛ کاربوہائیڈریٹ کو ہدف کے مطابق رکھیں۔";
      },
      activityDiet: {
        sedentary:
          "کم حرکت: ۳ کھانے + ۱ پروٹین ناشتہ؛ بے ترتیب ناشتہ کم؛ کھانے کے بعد ۱۰–۱۵ من چہل قدمی۔",
        light: "ہلکی سرگرمی: پروٹین مستقل؛ زیادہ کارب ورزش/دوپہر کے قریب۔",
        moderate: "درمیانہ: پانی زیادہ؛ پروٹین ۳–۴ حصوں میں۔",
        active: "زیادہ سرگرمی: سخت سیشن کے بعد کارب + پروٹین ریکوری۔",
        veryActive: "بہت زیادہ: لمبے دن پر اضافی ناشتہ؛ مائعات/معدنیات۔",
      },
      activityTips: {
        sedentary: "ہر گھنٹے اٹھیں؛ ۵–۷ ہزار قدم پہلا ہدف۔",
        light: "غیر تربیتی دن ۷–۸ ہزار قدم۔",
        moderate: "قدم + سیشن متوازن؛ زیادہ کارڈیو نہیں۔",
        active: "تھکن دیکھیں؛ نیند کم ہو تو آرام کا دن۔",
        veryActive: "چال اور نیند زیادہ سیشن سے زیادہ ضروری۔",
      },
      prefWeeklyNote: {
        gym: "جم: باربل، ڈمبل، کیبل، مشین۔",
        home: "گھر: ڈمبل، بینڈ، بینچ اختیاری۔",
        mixed: "آمیزش: ۲ جم دن + گھر/بغیر وزن۔",
        outdoor: "بیرون: پہاڑی، ٹریک، پارک، سائیکل۔",
        bodyweight: "کم سامان: پل اپ بار اختیاری؛ push-up / squat ترقی۔",
      },
      prefTips: {
        gym: "ہر ہفتے وزن لکھیں۔",
        home: "آہستگی اور رکاؤ سے وزن بڑھائیں۔",
        mixed: "جم پر بھاری؛ گھر پر معاون۔",
        outdoor: "موسم خراب ہو تو متبادل منصوبہ۔",
        bodyweight: "آسان ہو تو سست منفی یا extra سیٹ۔",
      },
    },
  };

  function getMod(lang) {
    return MODS[lang] && MODS[lang].activityDiet ? MODS[lang] : MODS.en;
  }

  function buildPersonalizedPlan(ctx) {
    var lang = ctx.lang || "en";
    var m = getMod(lang);
    var plans = ctx.plans;
    var bt = ctx.bodyTypeKey;
    var goal = ctx.goal;
    if (!plans || !plans[bt] || !plans[bt][goal]) {
      return { diet: [], weekly: [], tips: [] };
    }
    var bundle = plans[bt][goal];
    var diet = [];

    var gLine =
      typeof m.genderDietLine === "function"
        ? m.genderDietLine(ctx.gender, goal, bt)
        : MODS.en.genderDietLine(ctx.gender, goal, bt);
    diet.push(gLine);

    var actLine = m.activityDiet[ctx.activityLevel] || m.activityDiet.moderate || MODS.en.activityDiet.moderate;
    diet.push(actLine);

    bundle.diet.forEach(function (line) {
      diet.push(line);
    });

    var prefNote = m.prefWeeklyNote[ctx.workoutPreference] || m.prefWeeklyNote.mixed || "";
    var weekly = bundle.weekly.map(function (row) {
      return {
        day: row.day,
        text: prefNote ? row.text + " · " + prefNote : row.text,
      };
    });

    var tips = bundle.tips.slice();
    var at = m.activityTips[ctx.activityLevel] || MODS.en.activityTips.moderate;
    if (at) tips.push(at);
    var pt = m.prefTips[ctx.workoutPreference] || MODS.en.prefTips.mixed;
    if (pt) tips.push(pt);

    return { diet: diet, weekly: weekly, tips: tips };
  }

  global.buildPersonalizedPlan = buildPersonalizedPlan;
})(typeof window !== "undefined" ? window : globalThis);
