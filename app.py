"""
FitAI — Flask API for body type prediction (trained from body_type_dataset.csv).
"""

from __future__ import annotations

import os
from pathlib import Path
import pickle

import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request, send_from_directory
from flask_cors import CORS
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "balanced_body_type_dataset.csv"
MODEL_CACHE_PATH = BASE_DIR / "model_cache.pkl"
SCALER_CACHE_PATH = BASE_DIR / "scaler_cache.pkl"

try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

LETTER_MAP = {"A": 0, "B": 1, "C": 2}


def _normalize_lang(value: object) -> str:
    raw = str(value or "en").strip().lower()
    if raw in {"romanurdu", "roman_urdu", "roman-urdu"}:
        return "romanUrdu"
    if raw == "ur":
        return "ur"
    return "en"


def _number(value: object, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _activity_multiplier(level: object) -> float:
    level_key = str(level or "").strip()
    return {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "veryActive": 1.9,
    }.get(level_key, 1.45)


def _calculate_targets(profile: dict, age: int) -> dict:
    weight = _number(profile.get("weight_kg"), 70.0) or 70.0
    height = _number(profile.get("height_cm"), 170.0) or 170.0
    gender = str(profile.get("gender") or "male").strip().lower()
    goal = str(profile.get("goal") or profile.get("detailGoal") or "maintain").strip()
    body_type = str(profile.get("bodyTypeKey") or "mesomorph").strip().lower()

    bmr = (10 * weight + 6.25 * height - 5 * age - 161) if gender == "female" else (10 * weight + 6.25 * height - 5 * age + 5)
    tdee = bmr * _activity_multiplier(profile.get("activityLevel"))

    if body_type == "ectomorph":
        tdee *= 1.20 if goal == "muscleGain" else 0.90 if goal == "weightLoss" else 1.05
    elif body_type == "endomorph":
        tdee *= 1.08 if goal == "muscleGain" else 0.80 if goal == "weightLoss" else 0.95
    else:
        tdee *= 1.15 if goal == "muscleGain" else 0.85 if goal == "weightLoss" else 1.0

    if body_type == "ectomorph":
        protein_per_kg = 2.2 if goal == "muscleGain" else 1.8
    elif body_type == "endomorph":
        protein_per_kg = 2.0 if goal == "weightLoss" else 1.7
    else:
        protein_per_kg = 2.0 if goal == "muscleGain" else 1.6

    return {
        "calories": int(round(tdee)),
        "protein_g": int(round(weight * protein_per_kg)),
        "carbs_g": int(round((tdee * 0.4) / 4)),
        "fat_g": int(round((tdee * 0.25) / 9)),
    }


def _avg(values: list[float]) -> float:
    items = [float(v) for v in values if v is not None]
    return sum(items) / len(items) if items else 0.0


def _recent_summary(history: list[dict]) -> dict:
    recent = history[-5:] if len(history) > 5 else history
    calories = [_number((row.get("summary") or {}).get("calories")) for row in recent]
    protein = [_number((row.get("summary") or {}).get("protein_g") or (row.get("summary") or {}).get("protein")) for row in recent]
    return {
        "avg_calories": _avg(calories),
        "avg_protein": _avg(protein),
        "count": len(recent),
    }


def _recommendation_text(lang: str) -> dict:
    return {
        "en": {
            "focus_protein": ("Focus on Protein", "Include eggs, chicken, fish and lentils"),
            "greens": ("Eat More Greens", "Increase vegetables and salads"),
            "hydration": ("Stay Hydrated", "Drink 2.5–3 liters water throughout the day"),
            "carbs": ("Healthy Carbs", "Choose oats, brown rice and whole grains"),
            "cardio": ("Cardio", "20–30 min moderate intensity"),
            "strength": ("Strength Training", "Upper body / lower body / full body"),
            "burn": ("Calories Burn Goal", "250–350 kcal"),
            "recovery": ("Recovery Time", "60–90 sec"),
            "insight_low": "Calories slightly low today",
            "insight_mid": "Protein intake moderate",
            "insight_up": "Recommended increase tomorrow",
            "tip": "Consistent nutrition beats extreme dieting.",
            "generic": "Generic guidance ready",
        },
        "romanUrdu": {
            "focus_protein": ("Protein par focus", "Anday, chicken, fish aur daal shamil karein"),
            "greens": ("Sabziyan barhayein", "Vegetables aur salads zyada lein"),
            "hydration": ("Pani zyada piyein", "Din bhar 2.5–3 liter pani piyein"),
            "carbs": ("Behtar carbs", "Oats, brown rice aur whole grains choose karein"),
            "cardio": ("Cardio", "20–30 min moderate intensity"),
            "strength": ("Strength Training", "Upper / lower / full body"),
            "burn": ("Calories burn goal", "250–350 kcal"),
            "recovery": ("Recovery time", "60–90 sec"),
            "insight_low": "Calories aaj thori kam hain",
            "insight_mid": "Protein intake moderate hai",
            "insight_up": "Kal thora increase karein",
            "tip": "Consistent nutrition extreme dieting se behtar hai.",
            "generic": "General guidance ready",
        },
        "ur": {
            "focus_protein": ("پروٹین پر فوکس", "انڈے، چکن، مچھلی اور دال شامل کریں"),
            "greens": ("سبزیاں بڑھائیں", "سبزیاں اور سلاد زیادہ لیں"),
            "hydration": ("پانی زیادہ پئیں", "دن بھر 2.5–3 لیٹر پانی پئیں"),
            "carbs": ("اچھے کاربز", "اوٹس، براؤن رائس اور ہول گرینز منتخب کریں"),
            "cardio": ("کارڈیو", "20–30 منٹ درمیانی شدت"),
            "strength": ("اسٹرینتھ ٹریننگ", "اپر / لوئر / فل باڈی"),
            "burn": ("کیلوری برن ہدف", "250–350 kcal"),
            "recovery": ("ریکوری ٹائم", "60–90 سیکنڈ"),
            "insight_low": "آج کیلوریز تھوڑی کم ہیں",
            "insight_mid": "پروٹین انٹیک درمیانی ہے",
            "insight_up": "کل تھوڑا بڑھائیں",
            "tip": "مستقل خوراک extreme dieting سے بہتر ہے۔",
            "generic": "عام رہنمائی تیار ہے",
        },
    }.get(lang, {})


def _card(priority: str, title: str, icon: str, description: str) -> dict:
    return {
        "title": title,
        "icon": icon,
        "priority": priority,
        "description": description,
    }


def build_recommendation_payload(payload: dict) -> dict:
    lang = _normalize_lang(payload.get("lang") or (payload.get("profile") or {}).get("lang"))
    profile = payload.get("profile") or {}
    nutrition = payload.get("nutrition") or {}
    history = payload.get("history") or []

    age = int(_number(payload.get("age") or profile.get("age"), 30) or 30)
    targets = _calculate_targets(profile, age)
    recent = _recent_summary(history if isinstance(history, list) else [])
    current_calories = _number(nutrition.get("calories"), 0)
    current_protein = _number(nutrition.get("protein_g") or nutrition.get("protein"), 0)
    cal_diff = current_calories - targets["calories"]
    protein_diff = current_protein - targets["protein_g"]

    texts = _recommendation_text(lang)
    body_type = str(profile.get("bodyTypeKey") or "").strip().lower()
    goal = str(profile.get("goal") or profile.get("detailGoal") or "maintain").strip()
    activity = str(profile.get("activityLevel") or "moderate").strip()

    if not profile.get("bodyTypeKey"):
        generic = True
    else:
        generic = False

    diet_cards = []
    if protein_diff < -10 or goal == "muscleGain" or body_type == "ectomorph":
        priority = "high" if protein_diff < -20 or goal == "muscleGain" else "medium"
        diet_cards.append(_card(priority, texts["focus_protein"][0], "protein", texts["focus_protein"][1]))
    if cal_diff > 0 or goal == "weightLoss" or body_type == "endomorph":
        priority = "high" if cal_diff > 200 or goal == "weightLoss" else "medium"
        diet_cards.append(_card(priority, texts["greens"][0], "leaf", texts["greens"][1]))
    if activity in {"active", "veryActive"} or recent["avg_calories"] > 0 and recent["avg_calories"] < targets["calories"] * 0.9:
        diet_cards.append(_card("medium", texts["hydration"][0], "drop", texts["hydration"][1]))
    if body_type in {"ectomorph", "mesomorph"} or goal in {"muscleGain", "maintain"}:
        priority = "low" if cal_diff > 250 else "medium"
        diet_cards.append(_card(priority, texts["carbs"][0], "wheat", texts["carbs"][1]))

    if not diet_cards:
        diet_cards = [
            _card("medium", texts["greens"][0], "leaf", texts["greens"][1]),
            _card("medium", texts["focus_protein"][0], "protein", texts["focus_protein"][1]),
        ]

    exercise_cards = [
        _card("medium", texts["cardio"][0], "running", texts["cardio"][1]),
        _card("high" if goal == "muscleGain" else "medium", texts["strength"][0], "dumbbell", texts["strength"][1]),
        _card("medium", texts["burn"][0], "flame", texts["burn"][1]),
        _card("low", texts["recovery"][0], "timer", texts["recovery"][1]),
    ]

    insights = []
    if cal_diff < -150:
        insights.append(texts["insight_low"])
    elif cal_diff > 150:
        insights.append(texts["insight_up"])
    else:
        insights.append(texts["insight_mid"])
    if protein_diff < -15:
        insights.append("Protein target nearly achieved" if lang == "en" else texts["insight_mid"])
    if recent["count"] >= 2 and recent["avg_calories"] > 0:
        insights.append("Recent logs are consistent" if lang == "en" else texts["generic"])

    tip = texts["tip"]
    if not tip:
        tip = "Consistency matters more than intensity."

    return {
        "success": True,
        "has_profile": not generic,
        "current": {
            "calories": current_calories,
            "protein_g": current_protein,
            "targets": targets,
            "calorie_diff": cal_diff,
            "protein_diff": protein_diff,
        },
        "recommendations": {
            "diet": diet_cards,
            "exercise": exercise_cards,
        },
        "insights": insights,
        "tip": tip,
    }


def _load_model():
    """Load model and scaler from pickle cache. If cache doesn't exist, train and cache."""
    
    # Try loading from cache first (fastest)
    if MODEL_CACHE_PATH.is_file() and SCALER_CACHE_PATH.is_file():
        print(f"Loading model from cache: {MODEL_CACHE_PATH}")
        with open(MODEL_CACHE_PATH, "rb") as f:
            clf = pickle.load(f)
        print(f"Loading scaler from cache: {SCALER_CACHE_PATH}")
        with open(SCALER_CACHE_PATH, "rb") as f:
            scaler = pickle.load(f)
        print("Cache loaded successfully!")
        return clf, scaler
    
    # If cache doesn't exist, train the model
    print("Cache not found. Training model from scratch...")
    if not CSV_PATH.is_file():
        raise FileNotFoundError(f"Dataset not found: {CSV_PATH}")
    
    df = pd.read_csv(CSV_PATH)
    for col in ("body_shape", "weight_gain", "muscle_effect", "belly_fat"):
        df[col] = df[col].map(LETTER_MAP)
    feature_cols = [
        "height_cm",
        "weight_kg",
        "bmi",
        "body_shape",
        "weight_gain",
        "muscle_effect",
        "belly_fat",
    ]
    X = df[feature_cols].values
    y = df["body_type"].values
    
    # Scale features (required for GradientBoosting)
    scaler = StandardScaler()
    X_scaled = X.copy()
    X_scaled[:, [0, 1]] = scaler.fit_transform(X[:, [0, 1]])  # Scale height and weight
    
    # Train GradientBoosting for superior accuracy (97.7% vs 93.3% DecisionTree)
    clf = GradientBoostingClassifier(n_estimators=200, max_depth=6, learning_rate=0.05, random_state=42)
    clf.fit(X_scaled, y)
    
    # Cache model
    print(f"Saving model to cache: {MODEL_CACHE_PATH}")
    with open(MODEL_CACHE_PATH, "wb") as f:
        pickle.dump(clf, f)
    
    # Cache scaler
    print(f"Saving scaler to cache: {SCALER_CACHE_PATH}")
    with open(SCALER_CACHE_PATH, "wb") as f:
        pickle.dump(scaler, f)
    
    print("Model and scaler cached successfully!")
    return clf, scaler


MODEL, SCALER = _load_model()

app = Flask(__name__)
CORS(app)


def _parse_letter(value: str, field: str) -> int:
    if value is None:
        raise ValueError(f"Missing field: {field}")
    s = str(value).strip().upper()
    if s not in LETTER_MAP:
        raise ValueError(f"{field} must be A, B, or C")
    return LETTER_MAP[s]


@app.route("/")
def index_page():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")

@app.route("/profile")
def profile_page():
    return render_template("profile.html")

@app.route("/css/<path:filename>")
def css_files(filename):
    return send_from_directory(BASE_DIR / "css", filename)


@app.route("/js/<path:filename>")
def js_files(filename):
    return send_from_directory(BASE_DIR / "js", filename)


@app.route("/assets/<path:filename>")
def assets_files(filename):
    return send_from_directory(BASE_DIR / "assets", filename)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "gradient_boosting"})


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Expected JSON object"}), 400

    try:
        height_cm = float(data["height_cm"])
        weight_kg = float(data["weight_kg"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "height_cm and weight_kg are required numbers"}), 400

    if height_cm <= 0 or height_cm > 300 or weight_kg <= 0 or weight_kg > 400:
        return jsonify({"error": "height_cm or weight_kg out of valid range"}), 400

    try:
        body_shape = _parse_letter(data.get("body_shape"), "body_shape")
        weight_gain = _parse_letter(data.get("weight_gain"), "weight_gain")
        muscle_effect = _parse_letter(data.get("muscle_effect"), "muscle_effect")
        belly_fat = _parse_letter(data.get("belly_fat"), "belly_fat")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    bmi = weight_kg / ((height_cm / 100.0) ** 2)
    features = np.array(
        [
            [
                height_cm,
                weight_kg,
                bmi,
                body_shape,
                weight_gain,
                muscle_effect,
                belly_fat,
            ]
        ],
        dtype=float,
    )
    
    # Scale the features using the same scaler from training
    features_scaled = features.copy()
    features_scaled[:, [0, 1]] = SCALER.transform(features[:, [0, 1]])
    
    pred = MODEL.predict(features_scaled)[0]
    body_type = str(pred).lower().strip()

    out = {
        "body_type": body_type,
        "bmi": round(float(bmi), 2),
    }
    return jsonify(out)


@app.route("/analyze-food", methods=["POST"])
def analyze_food():
    from food_api import handle_analyze_food_request

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Expected JSON object"}), 400
    try:
        payload, status = handle_analyze_food_request(data)
        return jsonify(payload), status
    except Exception:
        return jsonify({"error": "Unable to analyze food right now"}), 500


@app.route("/recommendations", methods=["POST"])
def recommendations():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Expected JSON object"}), 400
    try:
        return jsonify(build_recommendation_payload(data))
    except Exception:
        return jsonify({"error": "Unable to build recommendations right now"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
