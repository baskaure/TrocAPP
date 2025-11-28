/*
  # Fix des colonnes manquantes dans disputes
  
  Ajoute les colonnes resolution et resolution_notes si elles n'existent pas.
*/

-- Vérifier et ajouter la colonne resolution si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'resolution'
  ) THEN
    ALTER TABLE disputes ADD COLUMN resolution text;
  END IF;
END $$;

-- Vérifier et ajouter la colonne resolution_notes si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'resolution_notes'
  ) THEN
    ALTER TABLE disputes ADD COLUMN resolution_notes text;
  END IF;
END $$;

-- Vérifier et ajouter la colonne resolved_by si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'resolved_by'
  ) THEN
    ALTER TABLE disputes ADD COLUMN resolved_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Vérifier et ajouter la colonne resolved_at si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE disputes ADD COLUMN resolved_at timestamptz;
  END IF;
END $$;

-- Vérifier que updated_at existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE disputes ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Vérifier que le trigger existe, sinon le créer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_disputes_updated_at'
  ) THEN
    CREATE TRIGGER update_disputes_updated_at
      BEFORE UPDATE ON disputes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Vérifier et recréer la contrainte CHECK sur status si nécessaire
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe avec un nom différent
  ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
  
  -- Vérifier si la contrainte existe déjà
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    AND table_name = 'disputes'
    AND constraint_name = 'disputes_status_check'
    AND constraint_type = 'CHECK'
  ) THEN
    -- Ajouter la contrainte
    ALTER TABLE disputes ADD CONSTRAINT disputes_status_check 
      CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed'));
  END IF;
END $$;

