# FitAI — Project Memory

## Structure
```
app.py                # Flask backend, routes, targets/recommendation logic
food_api.py            # USDA API + food dataset lookup for food analysis
food_tracker.py         # Food log parsing (fuzzy match, quantity/portion extraction) from CSV
train_and_cache.py       # Trains + caches ML model (model_cache.pkl, scaler_cache.pkl)
model_training.ipynb    # Notebook for classifier development
pakistani_food_dataset.csv / balanced_body_type_dataset.csv  # datasets
index.html              # Main SPA (landing + assessment + tracking)
templates/dashboard.html, profile.html  # Flask-rendered pages
css/                    # styles.css, styles-enhanced.css, auth.css, profile.css, tracking.css
js/app.js               # Main SPA controller (lang/theme, profile, assessment flow)
js/auth.js, auth-ui.js   # Supabase auth logic + UI bindings
js/dashboard.js          # Dashboard page logic
js/profile.js            # Profile page logic
js/i18n.js               # Translation strings (en/roman-ur/ur)
js/animations.js          # UI animation helpers
js/recommendations.js, recommendation-page.js  # Recommendation rendering
js/supabase-client.js     # Supabase client init (URL + publishable key)
js/tracking/tracking-state.js   # Central tracking state + localStorage read/write
js/tracking/tracking-foods.js   # Food entry helpers
js/tracking/tracking-ui.js      # Tracking UI rendering
js/tracking/tracking-reminders.js # Reminder sound toggle
js/tracking/tracking-main.js    # Tracking page orchestration
supabase/migrations/*.sql  # DB schema + RLS policies
```

## Routes (Flask, app.py)
- `/` → index_page (SPA)
- `/dashboard` → dashboard_page
- `/profile` → profile_page
- `/css/<file>`, `/js/<file>`, `/assets/<file>` → static file serving
- `/health` (GET) → health check
- `/predict` (POST) → body-type classification (ML model)
- `/analyze-food` (POST) → food text analysis (delegates to food_api.py)
- `/recommendations` (POST) → builds diet/exercise recommendation payload

## Major Modules
- **Backend**: app.py (routes + BMR/TDEE target calc + recommendation text/cards), food_api.py (USDA lookup, food dataset), food_tracker.py (CLI-style food log parser, fuzzy matching).
- **Frontend**: app.js (core SPA state/lang/theme/profile/assessment), auth.js/auth-ui.js (Supabase session, syncing local profile/history to DB), tracking/* (food logging, daily summary, reminders), profile.js & dashboard.js (page-specific views), i18n.js (translations), recommendations*.js (rendering recommendation cards).

## State Flow
- Client-side state held in module-scoped JS objects per page (app.js, dashboard.js, profile.js, tracking-state.js), synced to localStorage on change.
- On load, each page hydrates state from localStorage (lang, theme, profile, tracking history).
- auth.js reads local profile/history and pushes to Supabase when a user logs in (local → cloud sync); Supabase session also gates authenticated features.
- Assessment (body-type predict) → result stored in localStorage profile → used by tracking/recommendation pages.

## Database Flow (Supabase/Postgres)
- `profiles`: id (auth.users FK), name, gender, height_cm, weight_kg — RLS: user can only access own row.
- `body_type_history`: per-assessment records (body_type, bmi, height/weight, goal, activity_level, workout_preference) tied to user_id — RLS scoped.
- `food_tracking_history`: daily food log entries per user_id/log_date — RLS scoped.
- All tables use Row Level Security keyed on `auth.uid()`.

## localStorage Keys
- `fitai-lang` — selected language
- `fitai-theme` — theme (dark/light)
- `fitai-profile` — user profile + latest assessment
- `fitai-prefill-plan` — session handoff data for plan prefill
- `fitai-tracking-history` — food log history
- `fitai-daily-summary` — daily nutrition summary
- `fitai-tracking-nutrition` — per-date items + summary
- `fitai-reminders` — reminder settings
- `fitai-tracking-recommendations` — cached recommendation data
- reminder sound on/off key (tracking-reminders.js)

## Important Dependencies
- Backend: flask, flask-cors, pandas, scikit-learn, fuzzywuzzy, requests, python-dotenv
- Frontend CDN: Tailwind CSS (cdn.tailwindcss.com), Chart.js 4.4.1, Supabase JS v2 (UMD)
- ML artifacts: model_cache.pkl, scaler_cache.pkl (pre-trained, loaded by app.py `_load_model`)
- External API: USDA FoodData Central (via food_api.py, requires API key)
