-- 1. Allow users to update their own body type history (for weight/BMI sync)
create policy "Users can update own history"
  on public.body_type_history for update
  using (auth.uid() = user_id);

-- 2. Allow users to delete their own food logs
create policy "Users can delete own food logs"
  on public.food_tracking_history for delete
  using (auth.uid() = user_id);
