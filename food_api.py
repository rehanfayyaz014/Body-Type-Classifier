"""
Food analysis API helpers for FitAI Daily Tracking.
Uses food_tracker NLP parser + local CSV, with optional USDA fallback.
"""

from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path

import pandas as pd
import requests
from fuzzywuzzy import fuzz, process

from food_tracker import (
    FUZZY_THRESHOLD,
    load_dataset,
    parse_food_log,
)

BASE_DIR = Path(__file__).resolve().parent
FOOD_CSV = BASE_DIR / "pakistani_food_dataset.csv"
FDC_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass


def _fdc_api_key() -> str | None:
    """Read USDA FoodData Central key from environment (FDC_API_KEY). Backend only."""
    key = (os.environ.get("FDC_API_KEY") or "").strip()
    return key or None


@lru_cache(maxsize=1)
def get_food_df() -> pd.DataFrame:
    path = str(FOOD_CSV if FOOD_CSV.is_file() else BASE_DIR / "pakistani_food_dataset.csv")
    return load_dataset(path)


def _json_num(val, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _json_int(val, default: int = 0) -> int:
    if val is None:
        return default
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return default


def _nutrient_value(nutrients: list, names: tuple[str, ...]) -> float:
    for item in nutrients or []:
        label = str(item.get("nutrientName", "")).lower()
        for name in names:
            if name.lower() in label:
                val = item.get("value")
                if val is not None:
                    return float(val)
    return 0.0


def usda_lookup(query: str) -> dict | None:
    """Fallback lookup via USDA FoodData Central when local dataset has no match."""
    api_key = _fdc_api_key()
    if not api_key:
        return None
    try:
        resp = requests.get(
            FDC_SEARCH_URL,
            params={"api_key": api_key, "query": query, "pageSize": 1},
            timeout=12,
        )
        if not resp.ok:
            return None
        foods = (resp.json() or {}).get("foods") or []
        if not foods:
            return None
        food = foods[0]
        nutrients = food.get("foodNutrients") or []
        calories = _nutrient_value(nutrients, ("Energy", "Calories"))
        if calories > 5000:
            calories = calories / 1000.0
        protein = _nutrient_value(nutrients, ("Protein",))
        carbs = _nutrient_value(nutrients, ("Carbohydrate",))
        fat = _nutrient_value(nutrients, ("Total lipid", "Fat"))
        fiber = _nutrient_value(nutrients, ("Fiber",))
        return {
            "matched_food": food.get("description") or query.title(),
            "portion": "100g (USDA estimate)",
            "weight_g": 100.0,
            "quantity": 1.0,
            "calories": round(float(calories), 1),
            "protein_g": round(float(protein), 1),
            "carbs_g": round(float(carbs), 1),
            "fat_g": round(float(fat), 1),
            "fiber_g": round(float(fiber), 1),
            "match_score": 50,
            "source": "usda",
            "status": "matched",
        }
    except (requests.RequestException, ValueError, TypeError):
        return None


def _apply_usda_fallback(results: list[dict], meal: str) -> list[dict]:
    out = []
    for row in results:
        if row.get("status") == "✅ Matched" or row.get("matched_food"):
            r = dict(row)
            r["status"] = "matched"
            r["source"] = "local"
            out.append(_serialize_item(r))
            continue
        fallback = usda_lookup(row.get("raw_input") or "")
        if fallback:
            fallback["meal"] = row.get("meal") or meal
            fallback["raw_input"] = row.get("raw_input")
            out.append(fallback)
        else:
            out.append(
                {
                    "meal": row.get("meal") or meal,
                    "raw_input": row.get("raw_input"),
                    "matched_food": None,
                    "status": "unmatched",
                    "source": None,
                }
            )
    return out


def _serialize_item(row: dict) -> dict:
    return {
        "meal": row.get("meal", "General"),
        "raw_input": row.get("raw_input"),
        "matched_food": row.get("matched_food"),
        "portion": row.get("portion"),
        "weight_g": _json_num(row.get("weight_g"), 0),
        "quantity": _json_num(row.get("quantity", 1), 1),
        "calories": round(_json_num(row.get("calories", 0)), 1),
        "protein_g": round(_json_num(row.get("protein_g", 0)), 1),
        "carbs_g": round(_json_num(row.get("carbs_g", 0)), 1),
        "fat_g": round(_json_num(row.get("fat_g", 0)), 1),
        "fiber_g": round(_json_num(row.get("fiber_g", 0)), 1),
        "match_score": _json_int(row.get("match_score", 0)),
        "status": "matched" if row.get("matched_food") else "unmatched",
        "source": row.get("source", "local"),
    }


def analyze_food_text(text: str) -> dict:
    df = get_food_df()
    raw = parse_food_log(text, df)
    items = _apply_usda_fallback(raw, "General")

    matched = [i for i in items if i.get("status") == "matched"]
    summary = {
        "calories": float(round(sum(i.get("calories") or 0 for i in matched), 1)),
        "protein_g": float(round(sum(i.get("protein_g") or 0 for i in matched), 1)),
        "carbs_g": float(round(sum(i.get("carbs_g") or 0 for i in matched), 1)),
        "fat_g": float(round(sum(i.get("fat_g") or 0 for i in matched), 1)),
        "fiber_g": float(round(sum(i.get("fiber_g") or 0 for i in matched), 1)),
        "item_count": len(matched),
    }
    nutrition = {
        "calories": summary["calories"],
        "protein": summary["protein_g"],
        "carbs": summary["carbs_g"],
        "fat": summary["fat_g"],
        "fiber": summary["fiber_g"],
    }
    return {
        "success": len(matched) > 0,
        "items": items,
        "summary": summary,
        "nutrition": nutrition,
        "matched_count": len(matched),
    }


def search_food_suggestions(query: str, limit: int = 8) -> list[dict]:
    q = (query or "").strip()
    if len(q) < 2:
        return []
    df = get_food_df()
    names = df["food_name"].unique().tolist()
    hits = process.extract(q, names, scorer=fuzz.partial_ratio, limit=6)
    suggestions: list[dict] = []
    seen: set[str] = set()

    for name, score in hits:
        if score < 50:
            continue
        portions = df[df["food_name"] == name]["portion_label"].unique().tolist()
        if not portions:
            label = name
            key = label.lower()
            if key not in seen:
                seen.add(key)
                suggestions.append(
                    {"label": label, "insert_text": name, "food_name": name, "portion": None}
                )
            continue
        for portion in portions[:3]:
            label = f"{name} ({portion})"
            key = label.lower()
            if key in seen:
                continue
            seen.add(key)
            insert = f"{name} ({portion.lower()})"
            suggestions.append(
                {
                    "label": label,
                    "insert_text": insert,
                    "food_name": name,
                    "portion": portion,
                }
            )
        if len(suggestions) >= limit:
            break
    return suggestions[:limit]


def handle_analyze_food_request(data: dict) -> tuple[dict, int]:
    mode = (data.get("mode") or "analyze").strip().lower()
    try:
        if mode == "suggest":
            query = str(data.get("query") or "")
            return {"suggestions": search_food_suggestions(query)}, 200
        text = str(data.get("text") or "").strip()
        if not text:
            return {"error": "text is required"}, 400
        return analyze_food_text(text), 200
    except Exception:
        return {"error": "Unable to analyze food right now"}, 500
