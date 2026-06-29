-- 1. PROFILES TABLE (user ka naam, basic info)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  gender text check (gender in ('male', 'female')),
  height_cm numeric,
  weight_kg numeric,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);


-- 2. BODY TYPE HISTORY (har assessment ka record, time ke sath build hogi)
create table public.body_type_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  body_type text not null,
  bmi numeric not null,
  height_cm numeric not null,
  weight_kg numeric not null,
  body_shape text,
  weight_gain text,
  muscle_effect text,
  belly_fat text,
  goal text,
  activity_level text,
  workout_preference text,
  created_at timestamptz default now() not null
);

alter table public.body_type_history enable row level security;

create policy "Users can view own history"
  on public.body_type_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own history"
  on public.body_type_history for insert
  with check (auth.uid() = user_id);


-- 3. FOOD TRACKING HISTORY (daily food log entries)
create table public.food_tracking_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  items jsonb,
  summary jsonb,
  created_at timestamptz default now() not null
);

alter table public.food_tracking_history enable row level security;

create policy "Users can view own food logs"
  on public.food_tracking_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own food logs"
  on public.food_tracking_history for insert
  with check (auth.uid() = user_id);


-- 4. AUTO-CREATE PROFILE ON SIGNUP (signup ke waqt naam profiles table mein khud chala jaye)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'User'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();