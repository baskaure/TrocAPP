/*
  # Planification automatique des rappels d'avis
  
  Cette migration crée un cron job qui exécute la fonction send-review-reminders
  tous les jours à 7h UTC.
  
  Note: Nécessite que l'extension pg_cron soit activée dans Supabase.
*/

-- Vérifier si pg_cron est disponible
DO $$
BEGIN
  -- Activer l'extension si elle n'existe pas
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_cron nécessite des privilèges administrateur. Créez le schedule via le dashboard Supabase.';
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron non disponible. Créez le schedule via le dashboard Supabase.';
END $$;

-- Supprimer le schedule existant s'il existe
SELECT cron.unschedule('review-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'review-reminders'
);

-- Créer le schedule (tous les jours à 7h UTC)
-- Remplace <PROJECT_REF> par ton project ref: cuxypeejwglisqidxwfj
SELECT cron.schedule(
  'review-reminders',
  '0 7 * * *', -- Tous les jours à 7h UTC
  $$
  SELECT
    net.http_post(
      url := 'https://cuxypeejwglisqidxwfj.supabase.co/functions/v1/send-review-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

