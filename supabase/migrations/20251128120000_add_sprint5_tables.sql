/*
  # Tables Sprint 5 : Litiges, Rappels d'avis, Signature électronique

  ## Tables créées
  1. **disputes** - Gestion des litiges sur les échanges
  2. **review_reminders** - Journalisation des rappels d'avis
  3. **esign_requests** - File d'attente pour signatures électroniques
  
  ## Modifications
  - Ajout colonnes signature_* à contracts
*/

-- Table disputes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'disputes'
  ) THEN
    CREATE TABLE disputes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      exchange_id uuid NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
      opened_by uuid NOT NULL REFERENCES users(id),
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
      reason text NOT NULL,
      resolution text,
      resolution_notes text,
      resolved_by uuid REFERENCES users(id),
      resolved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Table review_reminders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'review_reminders'
  ) THEN
    CREATE TABLE review_reminders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      exchange_id uuid NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
      recipient_id uuid NOT NULL REFERENCES users(id),
      reminder_type text NOT NULL CHECK (reminder_type IN ('first', 'second')),
      sent_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Table esign_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'esign_requests'
  ) THEN
    CREATE TABLE esign_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      provider text NOT NULL CHECK (provider IN ('signrequest')),
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed')),
      envelope_id text,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Ajouter colonnes signature_* à contracts si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'signature_provider'
  ) THEN
    ALTER TABLE contracts ADD COLUMN signature_provider text CHECK (signature_provider IN ('signrequest'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'signature_status'
  ) THEN
    ALTER TABLE contracts ADD COLUMN signature_status text DEFAULT 'idle' CHECK (signature_status IN ('idle', 'pending', 'sent', 'completed', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'signature_reference'
  ) THEN
    ALTER TABLE contracts ADD COLUMN signature_reference text;
  END IF;
END $$;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_disputes_exchange ON disputes(exchange_id);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_by ON disputes(opened_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_review_reminders_exchange ON review_reminders(exchange_id);
CREATE INDEX IF NOT EXISTS idx_review_reminders_recipient ON review_reminders(recipient_id);
CREATE INDEX IF NOT EXISTS idx_esign_requests_contract ON esign_requests(contract_id);
CREATE INDEX IF NOT EXISTS idx_esign_requests_status ON esign_requests(status);

-- Créer la fonction update_updated_at si elle n'existe pas
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at sur disputes
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

-- Trigger pour updated_at sur esign_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_esign_requests_updated_at'
  ) THEN
    CREATE TRIGGER update_esign_requests_updated_at
      BEFORE UPDATE ON esign_requests
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- RLS Policies

-- disputes
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view disputes for their exchanges" ON disputes;
CREATE POLICY "Users can view disputes for their exchanges"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exchanges e
      JOIN contracts c ON c.id = e.contract_id
      JOIN proposals p ON p.id = c.proposal_id
      WHERE e.id = disputes.exchange_id
      AND (p.from_user_id = auth.uid() OR p.to_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create disputes for their exchanges" ON disputes;
CREATE POLICY "Users can create disputes for their exchanges"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    opened_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM exchanges e
      JOIN contracts c ON c.id = e.contract_id
      JOIN proposals p ON p.id = c.proposal_id
      WHERE e.id = disputes.exchange_id
      AND (p.from_user_id = auth.uid() OR p.to_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Moderators and admins can manage disputes" ON disputes;
CREATE POLICY "Moderators and admins can manage disputes"
  ON disputes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('moderator', 'admin')
    )
  );

-- review_reminders
ALTER TABLE review_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reminders" ON review_reminders;
CREATE POLICY "Users can view their own reminders"
  ON review_reminders FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "System can insert reminders" ON review_reminders;
CREATE POLICY "System can insert reminders"
  ON review_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- esign_requests
ALTER TABLE esign_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view esign requests for their contracts" ON esign_requests;
CREATE POLICY "Users can view esign requests for their contracts"
  ON esign_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      JOIN proposals p ON p.id = c.proposal_id
      WHERE c.id = esign_requests.contract_id
      AND (p.from_user_id = auth.uid() OR p.to_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "System can manage esign requests" ON esign_requests;
CREATE POLICY "System can manage esign requests"
  ON esign_requests FOR ALL
  TO authenticated
  WITH CHECK (true);

