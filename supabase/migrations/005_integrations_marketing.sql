-- ============================================================
-- INTEGRATIONS
-- ============================================================
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  provider TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- ============================================================
-- SHOWCASES & MARKETING
-- ============================================================
CREATE TABLE showcases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  before_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
  after_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
  gallery_photo_ids UUID[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  platform TEXT,
  review_link TEXT,
  message TEXT,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sync_queue_status ON sync_queue(status, created_at);
CREATE INDEX idx_sync_queue_company ON sync_queue(company_id);
CREATE INDEX idx_integrations_company ON integrations(company_id, provider);
CREATE INDEX idx_showcases_company ON showcases(company_id);
CREATE INDEX idx_showcases_slug ON showcases(slug);

-- RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_company" ON integrations FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "sync_queue_company" ON sync_queue FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "showcases_company" ON showcases FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "showcases_public" ON showcases FOR SELECT USING (is_published = true);
CREATE POLICY "review_requests_company" ON review_requests FOR ALL USING (
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
);

-- ============================================================
-- STORAGE BUCKET POLICIES
-- ============================================================

-- Photos bucket
CREATE POLICY "photos_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos');
CREATE POLICY "photos_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

-- Documents bucket
CREATE POLICY "documents_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');
CREATE POLICY "documents_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

-- Avatars bucket
CREATE POLICY "avatars_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
