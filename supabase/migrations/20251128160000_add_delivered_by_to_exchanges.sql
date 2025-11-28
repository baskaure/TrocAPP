/*
  # Ajouter delivered_by à exchanges
  
  Permet de savoir qui a marqué l'échange comme livré,
  pour empêcher cette personne de confirmer la réception.
*/

-- Ajouter la colonne delivered_by si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'exchanges' 
    AND column_name = 'delivered_by'
  ) THEN
    ALTER TABLE exchanges ADD COLUMN delivered_by uuid REFERENCES users(id);
  END IF;
END $$;

