# Ziele
- Enthält spezialisierte Parser für Preset-Quellen (Items, Spells, Creatures, Equipment).
- Liefert gemeinsam genutzte Utilitys, damit CLI-Skripte und App-Datenimporte identisch verarbeiten.

# Aktueller Stand
- Parser decken Basisfelder sowie optionale Metadaten ab; Validierungsfehler werden gesammelt zurückgegeben.
- Tests in `tests/library` verwenden diese Module indirekt über Transformationspipelines.

# ToDo
- [P2] Parser um Schema-Versionierung erweitern und Breaking Changes protokollieren.
- [P3] Mehrsprachige Beschreibungsfelder berücksichtigen (Locale-Fallbacks).

# Standards
- Jede Parser-Datei startet mit Kopfkommentar und exportiert Funktionssignaturen ohne Seiteneffekte.
- Neue Parser benötigen begleitende Fixtures im `tests/golden/library`-Baum und Unit-Tests.
