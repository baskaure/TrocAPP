/*
  # Fix du schedule pour review-reminders
  
  Alternative si net.http_post n'est pas disponible.
  Utilise directement l'appel HTTP via une fonction SQL.
*/

-- Vérifier si le schedule existe
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'review-reminders';

-- Si net.http_post n'est pas disponible, utilise cette version alternative :
-- (Remplace <SERVICE_ROLE_KEY> par ta clé service role depuis Supabase Dashboard > Settings > API)

DO $$
DECLARE
  service_role_key TEXT := 'TON_SERVICE_ROLE_KEY_ICI'; -- À remplacer par ta vraie clé
BEGIN
  -- Supprimer l'ancien schedule s'il existe
  PERFORM cron.unschedule('review-reminders') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'review-reminders'
  );

  -- Créer le nouveau schedule avec appel HTTP direct
  PERFORM cron.schedule(
    'review-reminders',
    '0 7 * * *', -- Tous les jours à 7h UTC
    format(
      $$
      SELECT
        net.http_post(
          url := 'https://cuxypeejwglisqidxwfj.supabase.co/functions/v1/send-review-reminders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer %s'
          ),
          body := '{}'::jsonb
        ) AS request_id;
      $$,
      service_role_key
    )
  );
END $$;

