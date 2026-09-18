/*
  # Cron des rappels d'avis — clé lue dans Vault (17/09/2026)

  Remplace les planifications de 20251128130000 / 20251128140000 qui utilisaient un
  paramètre inexistant puis un placeholder littéral (le job répondait 401 chaque matin).

  Prérequis, une seule fois, dans le SQL Editor (ne jamais versionner la clé) :
    SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key', 'Clé service_role pour pg_cron');
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron non activé : activez-le (Database → Extensions) puis rejouez cette migration.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net non activée : activez-la (Database → Extensions) puis rejouez cette migration, sinon le job échouerait chaque matin.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    RAISE NOTICE 'Secret Vault "service_role_key" absent : créez-le puis rejouez cette migration.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'review-reminders';

  PERFORM cron.schedule(
    'review-reminders',
    '0 7 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://cuxypeejwglisqidxwfj.supabase.co/functions/v1/send-review-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
      ),
      body := '{}'::jsonb
    );
    $cron$
  );
  RAISE NOTICE 'Job review-reminders planifié (7h UTC).';
END $$;
