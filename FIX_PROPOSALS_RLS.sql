-- FIX PROPOSALS RLS - Assure que les policies permettent la création et la mise à jour

-- 1. Supprimer les anciennes policies
DROP POLICY IF EXISTS "Users can view proposals they're involved in" ON proposals;
DROP POLICY IF EXISTS "Users can create proposals" ON proposals;
DROP POLICY IF EXISTS "Users can update proposals they're involved in" ON proposals;
DROP POLICY IF EXISTS "Users can update their proposals" ON proposals;

-- 2. Activer RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- 3. Recréer les policies correctement

-- SELECT: Les utilisateurs peuvent voir les propositions où ils sont impliqués
CREATE POLICY "Users can view proposals they're involved in"
  ON proposals FOR SELECT
  TO authenticated, anon
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- INSERT: Les utilisateurs peuvent créer des propositions où ils sont l'expéditeur
CREATE POLICY "Users can create proposals"
  ON proposals FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

-- UPDATE: Les utilisateurs peuvent modifier les propositions où ils sont impliqués
CREATE POLICY "Users can update proposals they're involved in"
  ON proposals FOR UPDATE
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Vérification: Tester que les policies sont bien créées
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'proposals'
ORDER BY policyname;

