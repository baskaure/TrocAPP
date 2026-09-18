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

/*
  Le SQL Editor de Supabase n'affiche pas les messages NOTICE : ce tableau dit donc
  explicitement où en est la planification. Les quatre lignes doivent être « OK ».
  Si l'une indique « MANQUANT », corrigez le prérequis puis rejouez ce fichier.

  La fonction est créée dans `pg_temp` : elle disparaît à la fin de la session, et le
  schéma `cron` est interrogé en SQL dynamique pour que le script fonctionne aussi
  quand l'extension n'est pas encore installée.
*/
CREATE OR REPLACE FUNCTION pg_temp.bontroc_cron_report()
RETURNS TABLE (prerequis text, etat text)
LANGUAGE plpgsql
AS $report$
DECLARE
  v_job text;
BEGIN
  prerequis := 'extension pg_cron';
  etat := CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
               THEN 'OK' ELSE 'MANQUANT — Database → Extensions → activer pg_cron' END;
  RETURN NEXT;

  prerequis := 'extension pg_net';
  etat := CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
               THEN 'OK' ELSE 'MANQUANT — Database → Extensions → activer pg_net' END;
  RETURN NEXT;

  prerequis := 'secret Vault service_role_key';
  BEGIN
    EXECUTE 'SELECT ''OK'' FROM vault.secrets WHERE name = ''service_role_key'' LIMIT 1' INTO etat;
  EXCEPTION WHEN OTHERS THEN
    etat := NULL;
  END;
  etat := COALESCE(etat, 'MANQUANT — SELECT vault.create_secret(''<clé service_role>'', ''service_role_key'')');
  RETURN NEXT;

  prerequis := 'job review-reminders';
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT ''OK — '' || schedule || CASE WHEN active THEN '' (actif)'' ELSE '' (INACTIF)'' END'
            || ' FROM cron.job WHERE jobname = ''review-reminders'''
      INTO v_job;
  END IF;
  etat := COALESCE(v_job, 'MANQUANT — rejouez ce fichier une fois les trois lignes ci-dessus en OK');
  RETURN NEXT;
END;
$report$;

SELECT * FROM pg_temp.bontroc_cron_report();
