# Tests des règles serveur

`run.sh` démarre un Postgres 17 dans Docker, reconstitue le minimum de Supabase (`auth.uid()`, rôles `anon`/`authenticated`/`service_role`, `storage`), crée le schéma de base tel qu'il existe en production (non versionné dans `migrations/`), applique toutes les migrations dans l'ordre puis rejoue `10_scenarios.sql` : inscription, RLS, modération, propositions, contre-propositions, acceptation, signatures, transitions d'échange, litiges, avis, stockage, bannissement, suppression, profil privé.

```bash
./supabase/tests/run.sh
docker rm -f bontroc-pg   # pour nettoyer
```

Toute nouvelle migration doit passer ici avant d'être exécutée sur le projet Supabase. Si le schéma de base évolue, mettre `00_stub_supabase.sql` à jour (ou le remplacer par un `supabase db dump`).
