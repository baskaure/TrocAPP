/*
  # Obsolète et dangereuse — ne fait plus rien

  Cette migration demandait de coller la vraie clé `service_role` dans le fichier
  (`service_role_key TEXT := 'TON_SERVICE_ROLE_KEY_ICI'`), donc de la committer et de
  l'inscrire en clair dans `cron.job.command`. Telle quelle, elle planifiait en plus un
  job qui envoyait littéralement « Bearer TON_SERVICE_ROLE_KEY_ICI ».

  Remplacée par `20260917103000_review_reminders_cron.sql`, qui lit la clé dans Vault.
  Le contenu d'origine est conservé dans `supabase/scripts/` pour référence.

  Si une vraie clé a déjà été collée ici puis exécutée : la révoquer dans
  Settings → API, puis vérifier `SELECT jobname, command FROM cron.job;`.
*/
DO $$
BEGIN
  RAISE NOTICE 'Migration obsolète : la planification est faite par 20260917103000_review_reminders_cron.sql.';
END $$;
