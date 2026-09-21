CREATE TABLE IF NOT EXISTS application_stats_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO application_stats_cache (id, payload, updated_at)
VALUES (
  1,
  '{"total":442,"days":[{"date":"2026-09-21","count":4,"isToday":true},{"date":"2026-09-20","count":3,"isToday":false},{"date":"2026-09-19","count":11,"isToday":false},{"date":"2026-09-18","count":12,"isToday":false}]}',
  unixepoch()
)
ON CONFLICT(id) DO NOTHING;
