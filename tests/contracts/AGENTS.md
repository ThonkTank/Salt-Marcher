# Ziele
- Führt plattformübergreifende Vertragstests für die Library-Domäne aus.

# Aktueller Stand
- Neues Test-Cluster, das Ports und Adapter gegen deterministische Fixtures prüft.
- Der Harness initialisiert einen Fake-Metadata-Cache, der Frontmatter beim Seed ausliest; Fixtures benötigen gültige YAML-Header.

# ToDo
- [P2] Smoke-Subset für PR-Läufe dokumentieren und aktuell halten.

# Standards
- Test-Harness exportiert eine `createLibraryHarness`-Factory und kapselt Adapterumschaltung.
- Vertrags-Tests nutzen ausschließlich die bereitgestellten Fixtures/Fakes aus `library-fixtures`.
- Spell-Preset-Fixtures enthalten YAML-konformes Frontmatter (Booleans, Zahlen, Listen) und werden bei neuen Domains mitgepflegt.
