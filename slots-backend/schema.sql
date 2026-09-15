CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  spot_number INTEGER NOT NULL CHECK (spot_number BETWEEN 1 AND 12),
  website TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  logo_key TEXT NOT NULL,
  logo_content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'expired')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  published_at TEXT,
  rejected_at TEXT,
  expires_at TEXT,
  approved_amount_cents INTEGER,
  rejected_reason TEXT,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  unique_clicks INTEGER NOT NULL DEFAULT 0,
  expiry_email_sent_at TEXT
);

CREATE INDEX IF NOT EXISTS applications_status_idx ON applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS applications_spot_idx ON applications(spot_number, status);
CREATE UNIQUE INDEX IF NOT EXISTS applications_one_pending_per_spot_idx ON applications(spot_number) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  visitor_hash TEXT NOT NULL,
  clicked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS clicks_application_idx ON clicks(application_id, clicked_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS clicks_unique_visitor_idx ON clicks(application_id, visitor_hash);
