CREATE TABLE campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  trashed_at TEXT,
  status TEXT NOT NULL DEFAULT 'ready'
);
CREATE TABLE valuable_installation_data (
  id TEXT PRIMARY KEY NOT NULL,
  content TEXT NOT NULL
);
INSERT INTO valuable_installation_data VALUES ('golden-installation', 'preserve installation');
PRAGMA user_version = 27;
