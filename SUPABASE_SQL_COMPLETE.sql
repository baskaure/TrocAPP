-- ============================================
-- TROCMARKET / TROCHUB - BASE DE DONNÉES COMPLÈTE
-- Script SQL pour Supabase PostgreSQL
-- ============================================

-- ÉTAPE 1: TYPES ENUM
-- ============================================

CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE listing_type AS ENUM ('service', 'product');
CREATE TYPE listing_mode AS ENUM ('remote', 'on_site', 'both');
CREATE TYPE listing_status AS ENUM ('draft', 'published', 'archived', 'suspended');
CREATE TYPE proposal_status AS ENUM ('pending', 'countered', 'accepted', 'refused', 'cancelled');
CREATE TYPE contract_status AS ENUM ('awaiting_signatures', 'active', 'completed', 'cancelled');
CREATE TYPE exchange_status AS ENUM ('not_started', 'in_progress', 'delivered', 'confirmed', 'cancelled');
CREATE TYPE report_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');
CREATE TYPE tag_category AS ENUM ('skill', 'interest', 'product_type', 'other');
CREATE TYPE template_type AS ENUM ('service', 'product', 'general');
CREATE TYPE word_severity AS ENUM ('warning', 'block');
CREATE TYPE email_status AS ENUM ('sent', 'failed', 'bounced', 'pending');

-- ÉTAPE 2: TABLES PRINCIPALES
-- ============================================

-- Table users (extension de auth.users)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  username text UNIQUE NOT NULL,
  avatar_url text,
  bio text DEFAULT '',
  city text,
  country text,
  geo_lat double precision,
  geo_lng double precision,
  languages jsonb DEFAULT '[]'::jsonb,
  rating_avg double precision DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count integer DEFAULT 0 CHECK (rating_count >= 0),
  is_verified boolean DEFAULT false,
  role user_role DEFAULT 'user',
  notification_settings jsonb DEFAULT '{
    "email_new_proposal": true,
    "email_accepted_proposal": true,
    "email_new_message": true,
    "email_weekly_digest": false,
    "email_exchange_reminder": true,
    "email_review_request": true
  }'::jsonb,
  last_login_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table user_settings
CREATE TABLE user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_email boolean DEFAULT true,
  notify_push boolean DEFAULT false,
  visibility_estimation text DEFAULT 'hidden' CHECK (visibility_estimation IN ('hidden', 'internal')),
  search_radius_km integer DEFAULT 50 CHECK (search_radius_km > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table categories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Table tags
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  category tag_category DEFAULT 'other',
  usage_count integer DEFAULT 0 CHECK (usage_count >= 0),
  created_at timestamptz DEFAULT now()
);

-- Table listings
CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type listing_type NOT NULL,
  title text NOT NULL,
  description_offer text NOT NULL,
  desired_exchange_desc text NOT NULL,
  desired_categories jsonb DEFAULT '[]'::jsonb,
  desired_tags jsonb DEFAULT '[]'::jsonb,
  mode listing_mode DEFAULT 'both',
  location_lat double precision,
  location_lng double precision,
  estimation_min numeric,
  estimation_max numeric,
  status listing_status DEFAULT 'draft',
  view_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table listing_media
CREATE TABLE listing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url text NOT NULL,
  type text NOT NULL CHECK (type IN ('image', 'video', 'document')),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Table listing_tags (liaison many-to-many)
CREATE TABLE listing_tags (
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (listing_id, tag_id)
);

-- Table proposals
CREATE TABLE proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  offer_payload jsonb NOT NULL,
  estimation_min numeric,
  estimation_max numeric,
  status proposal_status DEFAULT 'pending',
  parent_proposal_id uuid REFERENCES proposals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table chats
CREATE TABLE chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid UNIQUE NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Table chat_messages
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Table contract_templates
CREATE TABLE contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type template_type DEFAULT 'general',
  html_template text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table contracts
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  version integer DEFAULT 1,
  html_content text NOT NULL,
  pdf_url text,
  accepted_by_from_at timestamptz,
  accepted_by_to_at timestamptz,
  status contract_status DEFAULT 'awaiting_signatures',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table exchanges
CREATE TABLE exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  status exchange_status DEFAULT 'not_started',
  due_date date,
  delivered_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table reviews
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id uuid NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table reports
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('user', 'listing', 'proposal', 'chat')),
  entity_id uuid NOT NULL,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status report_status DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table email_templates
CREATE TABLE email_templates (
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
CREATE TABLE banned_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text UNIQUE NOT NULL,
  severity word_severity DEFAULT 'warning',
  category text DEFAULT 'other',
  created_at timestamptz DEFAULT now()
);

-- Table email_logs
CREATE TABLE email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  template_name text,
  recipient text NOT NULL,
  subject text,
  status email_status DEFAULT 'pending',
  error_message text,
  sent_at timestamptz DEFAULT now()
);

-- ÉTAPE 3: INDEX POUR PERFORMANCE
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_listings_user_id ON listings(user_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_type ON listings(type);
CREATE INDEX idx_proposals_listing_id ON proposals(listing_id);
CREATE INDEX idx_proposals_from_user ON proposals(from_user_id);
CREATE INDEX idx_proposals_to_user ON proposals(to_user_id);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_tags_category ON tags(category);
CREATE INDEX idx_listing_tags_listing ON listing_tags(listing_id);
CREATE INDEX idx_listing_tags_tag ON listing_tags(tag_id);
CREATE INDEX idx_email_logs_user ON email_logs(user_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);

-- ÉTAPE 4: ROW LEVEL SECURITY (RLS)
-- ============================================

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- User settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON user_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Categories (public read)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Only admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Tags (public read)
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

-- Listings
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published listings"
  ON listings FOR SELECT
  TO authenticated, anon
  USING (status = 'published' OR user_id = auth.uid());

CREATE POLICY "Users can create own listings"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own listings"
  ON listings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own listings"
  ON listings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Listing media
ALTER TABLE listing_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view listing media"
  ON listing_media FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_media.listing_id
      AND (listings.status = 'published' OR listings.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own listing media"
  ON listing_media FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_media.listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- Listing tags
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

-- Proposals
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view proposals they're involved in"
  ON proposals FOR SELECT
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can create proposals"
  ON proposals FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can update proposals they're involved in"
  ON proposals FOR UPDATE
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Chats
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chats for their proposals"
  ON chats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proposals
      WHERE proposals.id = chats.proposal_id
      AND (proposals.from_user_id = auth.uid() OR proposals.to_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create chats for their proposals"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals
      WHERE proposals.id = chats.proposal_id
      AND (proposals.from_user_id = auth.uid() OR proposals.to_user_id = auth.uid())
    )
  );

-- Chat messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their chats"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chats
      JOIN proposals ON proposals.id = chats.proposal_id
      WHERE chats.id = chat_messages.chat_id
      AND (proposals.from_user_id = auth.uid() OR proposals.to_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their chats"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contracts for their proposals"
  ON contracts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proposals
      WHERE proposals.id = contracts.proposal_id
      AND (proposals.from_user_id = auth.uid() OR proposals.to_user_id = auth.uid())
    )
  );

CREATE POLICY "System can create contracts"
  ON contracts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update contracts for their proposals"
  ON contracts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proposals
      WHERE proposals.id = contracts.proposal_id
      AND (proposals.from_user_id = auth.uid() OR proposals.to_user_id = auth.uid())
    )
  );

-- Exchanges
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view exchanges for their contracts"
  ON exchanges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      JOIN proposals ON proposals.id = contracts.proposal_id
      WHERE contracts.id = exchanges.contract_id
      AND (proposals.from_user_id = auth.uid() OR proposals.to_user_id = auth.uid())
    )
  );

CREATE POLICY "System can create exchanges"
  ON exchanges FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update exchanges for their contracts"
  ON exchanges FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      JOIN proposals ON proposals.id = contracts.proposal_id
      WHERE contracts.id = exchanges.contract_id
      AND (proposals.from_user_id = auth.uid() OR proposals.to_user_id = auth.uid())
    )
  );

-- Reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can create reviews for their exchanges"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

-- Reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('moderator', 'admin')
  ));

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Contract templates
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

-- Email templates
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

-- Banned words
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

-- Email logs
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

-- ÉTAPE 5: TRIGGERS
-- ============================================

-- Trigger pour créer user_settings automatiquement
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_settings();

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_exchanges_updated_at
  BEFORE UPDATE ON exchanges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FIN DU SCRIPT
-- ============================================
