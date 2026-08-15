CREATE TABLE campaign_runtime (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE valuable_campaign_data (
  id TEXT PRIMARY KEY NOT NULL,
  content TEXT NOT NULL
);
INSERT INTO valuable_campaign_data VALUES ('golden-campaign', 'preserve campaign');
PRAGMA user_version = 27;
