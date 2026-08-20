/*
  # Colonnes manquantes utilisées par le front

  Le code front référence plusieurs colonnes absentes des migrations du dépôt
  (probablement créées à la main sur certaines instances). Cette migration les
  ajoute de façon idempotente pour garantir que suppression de compte,
  vérification d'identité et modération des signalements fonctionnent en prod.

  1. `users.status` — soft delete du compte ('active' | 'deleted')
  2. `users.verification_submitted_at` — date d'envoi du document de vérification
  3. `users.verification_reviewed_at` — date de traitement par un modérateur
  4. `reports.moderator_id` / `reports.resolved_at` — traçabilité de la modération
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'status'
  ) THEN
    ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'deleted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'verification_submitted_at'
  ) THEN
    ALTER TABLE users ADD COLUMN verification_submitted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'verification_reviewed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN verification_reviewed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'moderator_id'
  ) THEN
    ALTER TABLE reports ADD COLUMN moderator_id uuid REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE reports ADD COLUMN resolved_at timestamptz;
  END IF;
END $$;
