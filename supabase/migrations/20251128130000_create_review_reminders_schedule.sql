/*
  # Obsolète — ne fait plus rien

  Cette migration planifiait le job `review-reminders` avec
  `current_setting('app.settings.service_role_key')`, un paramètre qui n'existe pas sur
  Supabase : l'en-tête valait « Bearer  » et la fonction répondait 401 chaque matin.

  Remplacée par `20260917103000_review_reminders_cron.sql`, qui lit la clé dans Vault.
  Le contenu d'origine est conservé dans `supabase/scripts/` pour référence.
*/
DO $$
BEGIN
  RAISE NOTICE 'Migration obsolète : la planification est faite par 20260917103000_review_reminders_cron.sql.';
END $$;
