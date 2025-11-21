/*
  # Fix existing users without profiles

  ## Purpose
  Create profiles for any existing auth users who don't have a profile yet.
  This is a one-time fix for users created before the trigger was in place.

  ## Changes
  - Create a function to sync existing auth users to the users table
  - Execute the function once to fix current state
*/

-- Function to create missing user profiles
CREATE OR REPLACE FUNCTION create_missing_user_profiles()
RETURNS void AS $$
BEGIN
  -- Insert missing users from auth.users into public.users
  INSERT INTO public.users (id, email, display_name, username)
  SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1) || '_' || substr(au.id::text, 1, 4))
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL
  ON CONFLICT (id) DO NOTHING;

  -- Insert missing user settings
  INSERT INTO public.user_settings (user_id)
  SELECT au.id
  FROM auth.users au
  LEFT JOIN public.user_settings us ON au.id = us.user_id
  WHERE us.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to fix existing users
SELECT create_missing_user_profiles();