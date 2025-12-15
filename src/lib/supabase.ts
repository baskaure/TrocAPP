import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase Config:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
  keyLength: supabaseAnonKey?.length || 0
});

if (!supabaseUrl || !supabaseAnonKey) {
  const error = `Missing Supabase environment variables: URL=${!!supabaseUrl}, Key=${!!supabaseAnonKey}`;
  console.error(error);
  throw new Error(error);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type User = {
  id: string;
  email: string;
  display_name: string;
  username: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  phone?: string;
  city?: string;
  country?: string;
  geo_lat?: number;
  geo_lng?: number;
  languages?: string[];
  skills?: string[];
  search_radius_km?: number;
  rating_avg: number;
  rating_count: number;
  is_verified: boolean;
  role: 'user' | 'moderator' | 'admin' | 'banned';
  verification_status?: 'none' | 'pending' | 'verified' | 'rejected';
  verification_document_url?: string;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  sort_order: number;
};

export type Listing = {
  id: string;
  user_id: string;
  type: 'service' | 'product';
  title: string;
  description_offer: string;
  desired_exchange_desc: string;
  category_id?: string | null;
  desired_categories?: string[];
  desired_tags?: string[];
  mode: 'remote' | 'on_site' | 'both';
  location_lat?: number;
  location_lng?: number;
  estimation_min?: number;
  estimation_max?: number;
  status: 'draft' | 'published' | 'archived' | 'suspended';
  view_count: number;
  created_at: string;
  updated_at: string;
  user?: User;
  media?: ListingMedia[];
};

export type ListingMedia = {
  id: string;
  listing_id: string;
  url: string;
  type: 'image' | 'video' | 'document';
  sort_order: number;
};

export type Proposal = {
  id: string;
  listing_id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  offer_payload: any;
  estimation_min?: number;
  estimation_max?: number;
  status: 'pending' | 'countered' | 'accepted' | 'refused' | 'cancelled';
  parent_proposal_id?: string;
  created_at: string;
  updated_at: string;
  from_user?: User;
  to_user?: User;
  listing?: Listing;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  attachments?: string[];
  read_at?: string;
  created_at: string;
  sender?: User;
};

export type Dispute = {
  id: string;
  exchange_id: string;
  opened_by: string;
  reason: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  resolution?: string;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
};

export type Exchange = {
  id: string;
  contract_id: string;
  status: 'not_started' | 'in_progress' | 'delivered' | 'confirmed' | 'cancelled';
  due_date?: string;
  delivered_at?: string;
  delivered_by?: string; // ID de l'utilisateur qui a marqué comme livré
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  dispute?: Dispute | null;
};

export type Review = {
  id: string;
  exchange_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
  tags?: string[];
  created_at: string;
  reviewer?: User;
  reviewee?: User;
};

export type Tag = {
  id: string;
  name: string;
  slug: string;
  category: 'skill' | 'interest' | 'product_type' | 'other';
  usage_count: number;
  created_at: string;
};

export type ContractTemplate = {
  id: string;
  name: string;
  type: 'service' | 'product' | 'general';
  html_template: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body?: string;
  variables: string[];
  event_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Contract = {
  id: string;
  proposal_id: string;
  version: number;
  html_content: string;
  pdf_url?: string;
  accepted_by_from_at?: string;
  accepted_by_to_at?: string;
  status: 'awaiting_signatures' | 'active' | 'completed' | 'cancelled';
  signature_provider?: 'signrequest' | null;
  signature_status?: 'idle' | 'pending' | 'sent' | 'completed' | 'failed';
  signature_reference?: string | null;
  created_at: string;
  updated_at: string;
};

export type EsignRequest = {
  id: string;
  contract_id: string;
  provider: 'signrequest';
  status: 'pending' | 'sent' | 'completed' | 'failed';
  envelope_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type Report = {
  id: string;
  entity_type: 'user' | 'listing' | 'proposal' | 'chat';
  entity_id: string;
  reporter_id: string;
  reason: string;
  details?: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
};
