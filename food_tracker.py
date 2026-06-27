"""
Pakistani Food NLP Calorie Tracker
====================================
Natural language food log parser + CSV nutritional lookup
Usage: python food_tracker.py
"""

import ast
import re
import sys
import pandas as pd
from fuzzywuzzy import process, fuzz

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
CSV_PATH = "pakistani_food_dataset.csv"
FUZZY_THRESHOLD = 55
# Direct aliases for common informal/plural food names
FOOD_ALIASES = {
    'eggs'          : 'Boiled Egg',
    'egg'           : 'Boiled Egg',
    'anday'         : 'Boiled Egg',
    'anda'          : 'Boiled Egg',
    'roti'          : 'Chapati (Whole Wheat)',
    'chapatti'      : 'Chapati (Whole Wheat)',
    'rice'          : 'White Rice (Boiled)',
    'chawal'        : 'White Rice (Boiled)',
    'daal'          : 'Daal Masoor (Red Lentil)',
    'dal'           : 'Daal Masoor (Red Lentil)',
    'bhindi'        : 'Bhindi (Okra)',
    'okra'          : 'Bhindi (Okra)',
    'biryani'       : 'Chicken Biryani',
    'pulao'         : 'Pulao (Chicken)',
    'paratha'       : 'Paratha (Plain)',
    'naan'          : 'Naan',
    'karahi'        : 'Chicken Karahi',
    'nihari'        : 'Nihari',
    'haleem'        : 'Haleem',
    'kebab'         : 'Seekh Kebab',
    'tikka'         : 'Tikka (Chicken)',
    'lassi'         : 'Lassi (Sweet)',
    'chai'          : 'Chai (Doodh Patti)',
    'tea'           : 'Chai (Doodh Patti)',
    'milk'          : 'Doodh (Full Fat Milk)',
    'doodh'         : 'Doodh (Full Fat Milk)',
    'yogurt'        : 'Dahi (Plain Yogurt)',
    'dahi'          : 'Dahi (Plain Yogurt)',
    'samosa'        : 'Samosa (Aloo)',
    'pakora'        : 'Pakora (Vegetable)',
    'gulab jamun'   : 'Gulab Jamun',
    'kheer'         : 'Kheer',
    'halwa'         : 'Halwa (Suji)',
}
                       # min match score (0-100)

# ─────────────────────────────────────────────
# MAPPINGS
# ─────────────────────────────────────────────
MEAL_KEYWORDS = [
    'breakfast', 'lunch', 'dinner',
    'sehri', 'suhoor', 'iftar', 'snack', 'brunch'
]

QUANTITY_WORDS = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8,
    'half': 0.5, 'quarter': 0.25, 'double': 2,
    'a': 1, 'an': 1
}

# Maps words found in user text → dataset portion_label (longest match first)
PORTION_HINT_MAP = {
    'double plate'  : 'Double Plate',
    'full plate'    : 'Full Plate',
    'half plate'    : 'Half Plate',
    'full bowl'     : 'Full Bowl',
    'half bowl'     : 'Half Bowl',
    'large glass'   : 'Large Glass',
    'full glass'    : 'Full Glass (250ml)',
    'half glass'    : 'Half Glass (200ml)',
    'large mug'     : 'Large Mug',
    'large'         : 'Large',
    'medium'        : 'Medium',
    'small'         : 'Small',
    '2 plate'       : 'Double Plate',
    '1 plate'       : 'Full Plate',
    '2 bowl'        : 'Full Bowl',
    '1 bowl'        : 'Full Bowl',
    '1 glass'       : 'Full Glass (250ml)',
    '1 cup'         : 'Medium Cup (250ml)',
    '4 pieces'      : '4 pieces',
    '2 pieces'      : '2 pieces',
    '1 piece'       : '1 piece',
}

# Middle portion index fallback (if no hint found)
DEFAULT_PORTION_IDX = 1   # picks middle row when 3 portions exist


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def _parse_nutrition_number(value) -> float:
    """Extract numeric part from strings like '505 kcal' or '14 g'."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0.0
    match = re.search(r"([\d.]+)", str(value))
    return float(match.group(1)) if match else 0.0


def _parse_nutritions_cell(cell) -> dict:
    """Parse the nutritions column (Python dict string) from Foods_data.csv."""
    if cell is None or (isinstance(cell, float) and pd.isna(cell)):
        return {}
    if isinstance(cell, dict):
        return cell
    try:
        return ast.literal_eval(str(cell))
    except (ValueError, SyntaxError):
        return {}


def normalize_foods_dataframe(df_raw: pd.DataFrame) -> pd.DataFrame:
    """
    Convert Foods_data.csv schema → columns expected by the tracker.
    CSV columns: name, nutritions, ...
    Tracker expects: food_name, portion_label, weight_grams, calories, ...
    """
    if "food_name" in df_raw.columns:
        return df_raw

    if "name" not in df_raw.columns:
        raise ValueError(
            "CSV must include either 'food_name' or 'name' column. "
            f"Found columns: {list(df_raw.columns)}"
        )

    rows = []
    for _, row in df_raw.iterrows():
        nutrition = _parse_nutritions_cell(row.get("nutritions"))
        rows.append(
            {
                "food_name": str(row["name"]).strip(),
                "portion_label": "1 serving",
                "weight_grams": 0,
                "calories": _parse_nutrition_number(nutrition.get("Calories")),
                "protein_g": _parse_nutrition_number(nutrition.get("Protein")),
                "carbs_g": _parse_nutrition_number(nutrition.get("Carbohydrates")),
                "fat_g": _parse_nutrition_number(nutrition.get("Fat")),
                "fiber_g": _parse_nutrition_number(nutrition.get("Fiber")),
            }
        )
    return pd.DataFrame(rows)


def load_dataset(path: str) -> pd.DataFrame:
    try:
        df_raw = pd.read_csv(path)
        df = normalize_foods_dataframe(df_raw)
        print(f"✅ Dataset loaded: {len(df)} rows, {df['food_name'].nunique()} unique foods\n")
        return df
    except FileNotFoundError:
        print(f"❌ ERROR: CSV file not found at '{path}'")
        print("   Make sure 'pakistani_food_dataset.csv' is in the same folder as this script.")
        sys.exit(1)
    except ValueError as exc:
        print(f"❌ ERROR: {exc}")
        sys.exit(1)


def detect_meal_label(line: str) -> str | None:
    """Return meal label if line starts with a meal keyword."""
    for kw in MEAL_KEYWORDS:
        if re.match(rf'^\s*{kw}\s*:?', line, re.IGNORECASE):
            return kw.capitalize()
    return None


def parse_quantity(text: str) -> float:
    """Extract leading numeric or word quantity from text."""
    text = text.lower().strip()
    m = re.search(r'(\d+\.?\d*)', text)
    if m:
        return float(m.group(1))
    for word, val in QUANTITY_WORDS.items():
        if re.search(rf'\b{word}\b', text):
            return val
    return 1.0


def detect_portion_hint(text: str) -> str | None:
    """Match longest portion phrase in user text."""
    text_lower = text.lower()
    for phrase in sorted(PORTION_HINT_MAP.keys(), key=len, reverse=True):
        if phrase in text_lower:
            return PORTION_HINT_MAP[phrase]
    return None


def clean_for_matching(text: str) -> str:
    """Strip quantity/portion words so fuzzy match focuses on food name."""
    noise = (
        r'\b(\d+\.?\d*|eat|had|have|took|with|and|a|an|the|'
        r'one|two|three|four|five|six|seven|eight|'
        r'half|quarter|double|small|medium|large|'
        r'plate|bowl|glass|cup|mug|piece|pieces|boiled|fried|scrambled)\b'
    )
    cleaned = re.sub(noise, '', text, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    # if nothing left, return original stripped text (handles single words like 'eggs')
    return cleaned if cleaned else re.sub(r'\d+', '', text).strip()


def fuzzy_match_food(query: str, food_names: list, threshold: int) -> tuple[str | None, int]:
    """Return best matching food name and score."""
    # 1. Check direct aliases first (handles plurals, Urdu names, common short forms)
    query_lower = query.lower().strip()
    for alias, canonical in FOOD_ALIASES.items():
        if alias in query_lower and canonical in food_names:
            return canonical, 100

    # 2. Fuzzy match on cleaned text
    cleaned = clean_for_matching(query)
    if not cleaned:
        return None, 0
    result = process.extractOne(cleaned, food_names, scorer=fuzz.token_set_ratio)
    if result and result[1] >= threshold:
        return result[0], result[1]

    # 3. Try partial ratio with lower threshold for short words
    if len(cleaned.split()) <= 2:
        result2 = process.extractOne(cleaned, food_names, scorer=fuzz.partial_ratio)
        if result2 and result2[1] >= 60:
            return result2[0], result2[1]

    return None, 0


def pick_best_row(food_df: pd.DataFrame, portion_hint: str | None) -> pd.Series:
    """Select the best matching row based on portion hint."""
    if portion_hint:
        # Try exact contains match (case-insensitive)
        matched = food_df[food_df['portion_label'].str.lower().str.contains(
            re.escape(portion_hint.lower()), na=False, regex=True
        )]
        if not matched.empty:
            return matched.iloc[0]

    # Fallback: pick default middle portion
    idx = min(DEFAULT_PORTION_IDX, len(food_df) - 1)
    return food_df.iloc[idx]


# ─────────────────────────────────────────────
# CORE PARSER
# ─────────────────────────────────────────────
def parse_food_log(user_text: str, df: pd.DataFrame) -> list[dict]:
    """Parse free-text food log into structured nutritional records."""
    food_names = df['food_name'].unique().tolist()
    results = []
    current_meal = "General"

    lines = user_text.strip().split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Detect meal label
        meal_label = detect_meal_label(line)
        if meal_label:
            current_meal = meal_label
            # Strip meal keyword from line before food parsing
            line = re.sub(
                rf'\b{meal_label}\b\s*:?\s*', '', line, flags=re.IGNORECASE
            ).strip()

        # Split items by comma / "and" / "with"
        items = re.split(r',|\band\b|\bwith\b', line, flags=re.IGNORECASE)

        for item in items:
            item = item.strip()
            if len(item) < 2:
                continue

            qty          = parse_quantity(item)
            portion_hint = detect_portion_hint(item)
            food_name, score = fuzzy_match_food(item, food_names, FUZZY_THRESHOLD)

            if not food_name:
                results.append({
                    'meal'        : current_meal,
                    'raw_input'   : item,
                    'matched_food': None,
                    'status'      : '❌ No match',
                })
                continue

            food_rows = df[df['food_name'] == food_name].copy()
            best_row  = pick_best_row(food_rows, portion_hint)

            results.append({
                'meal'        : current_meal,
                'raw_input'   : item,
                'matched_food': food_name,
                'portion'     : best_row['portion_label'],
                'weight_g'    : best_row['weight_grams'],
                'quantity'    : qty,
                'calories'    : round(best_row['calories']  * qty, 1),
                'protein_g'   : round(best_row['protein_g'] * qty, 1),
                'carbs_g'     : round(best_row['carbs_g']   * qty, 1),
                'fat_g'       : round(best_row['fat_g']     * qty, 1),
                'fiber_g'     : round(best_row['fiber_g']   * qty, 1),
                'match_score' : score,
                'status'      : '✅ Matched',
            })

    return results


# ─────────────────────────────────────────────
# DISPLAY
# ─────────────────────────────────────────────
MEAL_ORDER = ['General', 'Sehri', 'Suhoor', 'Breakfast', 'Brunch',
              'Snack', 'Lunch', 'Iftar', 'Dinner']

def display_results(results: list[dict]) -> None:
    """Pretty-print results grouped by meal with totals."""
    matched = [r for r in results if r['status'] == '✅ Matched']
    failed  = [r for r in results if r['status'] != '✅ Matched']

    # Group by meal
    meals: dict[str, list] = {}
    for r in matched:
        meals.setdefault(r['meal'], []).append(r)

    grand = {'calories': 0, 'protein_g': 0, 'carbs_g': 0,
             'fat_g': 0, 'fiber_g': 0}

    print("\n" + "═" * 75)
    print("  🥗  PAKISTANI FOOD NUTRITION TRACKER — DAILY REPORT")
    print("═" * 75)

    sorted_meals = sorted(meals.keys(),
                          key=lambda m: MEAL_ORDER.index(m)
                          if m in MEAL_ORDER else 99)

    for meal in sorted_meals:
        items = meals[meal]
        meal_cal = sum(i['calories'] for i in items)

        print(f"\n  🍽️  {meal.upper()}  ({meal_cal:.0f} kcal total)")
        print("  " + "─" * 71)
        print(f"  {'Food':<30} {'Portion':<18} {'Cal':>5} {'Prot':>6} {'Carbs':>6} {'Fat':>5}")
        print("  " + "─" * 71)

        for i in items:
            name_str = f"{i['matched_food']}"
            if i['quantity'] != 1:
                name_str += f" ×{i['quantity']}"
            print(
                f"  {name_str:<30} {i['portion']:<18} "
                f"{i['calories']:>5.0f} {i['protein_g']:>5.1f}g "
                f"{i['carbs_g']:>5.1f}g {i['fat_g']:>4.1f}g"
            )
            for k in grand:
                grand[k] += i[k]

    # Grand total
    print("\n" + "═" * 75)
    print(f"  📊  DAILY TOTAL")
    print("  " + "─" * 71)
    print(f"  {'Calories':<20} {grand['calories']:>8.0f} kcal")
    print(f"  {'Protein':<20} {grand['protein_g']:>8.1f} g")
    print(f"  {'Carbohydrates':<20} {grand['carbs_g']:>8.1f} g")
    print(f"  {'Fat':<20} {grand['fat_g']:>8.1f} g")
    print(f"  {'Fiber':<20} {grand['fiber_g']:>8.1f} g")
    print("═" * 75)

    # Calorie gauge
    cal = grand['calories']
    goal = 2000
    pct = min(int((cal / goal) * 30), 30)
    bar = '█' * pct + '░' * (30 - pct)
    print(f"\n  Calorie Goal (2000 kcal): [{bar}] {cal:.0f}/{goal}")

    # Macro breakdown bar
    total_macro = grand['protein_g'] + grand['carbs_g'] + grand['fat_g']
    if total_macro > 0:
        p_pct = grand['protein_g'] / total_macro * 100
        c_pct = grand['carbs_g']   / total_macro * 100
        f_pct = grand['fat_g']     / total_macro * 100
        print(f"  Macro Split  → Protein {p_pct:.0f}%  |  Carbs {c_pct:.0f}%  |  Fat {f_pct:.0f}%")

    # Unmatched items
    if failed:
        print(f"\n  ⚠️  Could not match {len(failed)} item(s):")
        for r in failed:
            print(f"     • '{r['raw_input']}' — try rephrasing")

    print()


# ─────────────────────────────────────────────
# INTERACTIVE MODE
# ─────────────────────────────────────────────
EXAMPLE_LOG = """\
breakfast: 2 eggs, 1 medium paratha
lunch: 1 plate pulao with raita
dinner: 1 chapati with small plate bhendi
snack: 2 gulab jamun, 1 glass lassi sweet"""


def interactive_mode(df: pd.DataFrame) -> None:
    print("╔══════════════════════════════════════════════════════════════════════╗")
    print("║        🍛  Pakistani Food NLP Calorie Tracker  🍛                   ║")
    print("╠══════════════════════════════════════════════════════════════════════╣")
    print("║  Type your food log in plain English.  Examples:                    ║")
    print("║    breakfast: 2 eggs, 1 medium paratha                              ║")
    print("║    lunch: 1 plate biryani with raita                                ║")
    print("║    dinner: 1 chapati with bhendi                                    ║")
    print("║                                                                      ║")
    print("║  Commands:  'example'  → load demo log                              ║")
    print("║             'quit'     → exit                                       ║")
    print("╚══════════════════════════════════════════════════════════════════════╝\n")

    while True:
        print("Paste your food log (type 'done' on a new line when finished,")
        print("or 'example' / 'quit'):\n")

        lines = []
        while True:
            try:
                line = input("  > ")
            except (EOFError, KeyboardInterrupt):
                print("\nGoodbye!")
                return

            if line.strip().lower() == 'quit':
                print("Goodbye! Stay healthy! 🌿")
                return
            if line.strip().lower() == 'example':
                print(f"\n--- Loading example ---\n{EXAMPLE_LOG}\n-----------------------")
                results = parse_food_log(EXAMPLE_LOG, df)
                display_results(results)
                break
            if line.strip().lower() == 'done':
                if lines:
                    user_text = '\n'.join(lines)
                    results   = parse_food_log(user_text, df)
                    display_results(results)
                break
            lines.append(line)

        again = input("\nAnalyze another log? (y/n): ").strip().lower()
        if again != 'y':
            print("Goodbye! Stay healthy! 🌿")
            break


# ─────────────────────────────────────────────
# ALSO EXPOSE AS FUNCTION (for Jupyter / import)
# ─────────────────────────────────────────────
def analyze(text: str, csv_path: str = CSV_PATH) -> pd.DataFrame:
    """
    Quick function for use in Jupyter or other scripts.

    Returns a DataFrame with nutrition per food item.

    Example:
        from food_tracker import analyze
        df = analyze("breakfast: 2 eggs\\nlunch: 1 plate biryani")
        print(df)
    """
    df = load_dataset(csv_path)
    results = parse_food_log(text, df)
    matched = [r for r in results if r['status'] == '✅ Matched']
    return pd.DataFrame(matched)


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == '__main__':
    # If text passed as command-line argument, use that
    if len(sys.argv) > 1:
        user_text = ' '.join(sys.argv[1:])
        df = load_dataset(CSV_PATH)
        results = parse_food_log(user_text, df)
        display_results(results)
    else:
        df = load_dataset(CSV_PATH)
        interactive_mode(df)
# This line intentionally left blank
