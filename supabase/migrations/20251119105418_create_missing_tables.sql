/*
  # Création des tables manquantes pour MVP complet

  ## Tables créées
  
  1. **tags** - Tags système pour catégorisation
  2. **listing_tags** - Table de liaison many-to-many
  3. **contract_templates** - Modèles de contrats personnalisables
  4. **email_templates** - Templates d'emails transactionnels
  5. **banned_words** - Mots interdits pour modération
  6. **email_logs** - Historique des emails envoyés
  
  ## Sécurité
  - RLS activé sur toutes les tables
  - Policies restrictives par défaut
*/

-- Types ENUM (vérifier existence avant création)
DO $$ BEGIN
  CREATE TYPE tag_category AS ENUM ('skill', 'interest', 'product_type', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE template_type AS ENUM ('service', 'product', 'general');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE word_severity AS ENUM ('warning', 'block');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE email_status AS ENUM ('sent', 'failed', 'bounced', 'pending');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Table tags
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  category tag_category DEFAULT 'other',
  usage_count integer DEFAULT 0 CHECK (usage_count >= 0),
  created_at timestamptz DEFAULT now()
);

-- Table listing_tags (liaison many-to-many)
CREATE TABLE IF NOT EXISTS listing_tags (
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (listing_id, tag_id)
);

-- Table contract_templates
CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type template_type DEFAULT 'general',
  html_template text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table email_templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  variables jsonb DEFAULT '[]'::jsonb,
  event_type text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table banned_words
CREATE TABLE IF NOT EXISTS banned_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text UNIQUE NOT NULL,
  severity word_severity DEFAULT 'warning',
  category text DEFAULT 'other',
  created_at timestamptz DEFAULT now()
);

-- Table email_logs
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  template_name text,
  recipient text NOT NULL,
  subject text,
  status email_status DEFAULT 'pending',
  error_message text,
  sent_at timestamptz DEFAULT now()
);

-- Ajouter notification_settings au users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'notification_settings'
  ) THEN
    ALTER TABLE users ADD COLUMN notification_settings jsonb DEFAULT '{
      "email_new_proposal": true,
      "email_accepted_proposal": true,
      "email_new_message": true,
      "email_weekly_digest": false,
      "email_exchange_reminder": true,
      "email_review_request": true
    }'::jsonb;
  END IF;
END $$;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_listing_tags_listing ON listing_tags(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_tags_tag ON listing_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- RLS Policies

-- tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tags"
  ON tags FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Only admins can manage tags"
  ON tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- listing_tags
ALTER TABLE listing_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view listing tags"
  ON listing_tags FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can manage their listing tags"
  ON listing_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_tags.listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- contract_templates
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active templates"
  ON contract_templates FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "Only admins can manage templates"
  ON contract_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- email_templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Only admins can manage email templates"
  ON email_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- banned_words
ALTER TABLE banned_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view banned words"
  ON banned_words FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage banned words"
  ON banned_words FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can insert email logs"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
