/*
  # Valeur « banned » manquante dans l'enum `user_role`

  Constat (vérifié sur le projet le 18/09/2026) : `public.users.role` est de type enum
  `user_role` et cet enum ne contient que 'user', 'moderator' et 'admin'. Le bannissement
  n'a donc jamais pu fonctionner : `UPDATE users SET role = 'banned'` échoue avec
  « invalid input value for enum user_role: "banned" », et toute fonction SQL comparant
  la colonne à ce littéral refuse même d'être créée.

  ## À EXÉCUTER SEUL, AVANT LES AUTRES MIGRATIONS

  PostgreSQL interdit d'utiliser une valeur d'enum ajoutée dans la transaction en cours.
  Le SQL Editor de Supabase exécute un script entier dans une seule transaction : ce
  fichier doit donc être lancé à part, puis les autres migrations.

  Idempotent : rejouable sans effet si la valeur existe déjà (ou si la colonne est du
  type text sur une autre instance).
*/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role' AND t.typtype = 'e'
  ) THEN
    RAISE NOTICE 'Pas d''enum public.user_role : rien à faire (la colonne role est probablement de type text).';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role' AND e.enumlabel = 'banned'
  ) THEN
    RAISE NOTICE 'La valeur « banned » existe déjà.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TYPE public.user_role ADD VALUE ''banned''';
  RAISE NOTICE 'Valeur « banned » ajoutée à user_role. Lancez maintenant les migrations suivantes.';
END $$;

-- Vérification : doit afficher user, moderator, admin, banned.
SELECT string_agg(e.enumlabel::text, ', ' ORDER BY e.enumsortorder) AS valeurs_de_user_role
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typname = 'user_role';
