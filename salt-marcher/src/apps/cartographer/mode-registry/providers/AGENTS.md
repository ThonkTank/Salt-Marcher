# Ziele
- Stellt konkrete Initialisierer für jeden Cartographer-Modus bereit.

# Aktueller Stand
- Enthält Provider für Editor-, Inspector- und Travel-Guide-Flüsse.

# ToDo
- Abhängigkeiten der Provider klar dokumentieren, sobald weitere Services hinzukommen.
- Gemeinsame Mock-Helfer für Tests hinzufügen.

# Standards
- Provider-Dateien listen zuerst ihre externen Services in einem Satz.
- Rückgaben liefern stets ein Objekt mit `activate`/`deactivate`-Signaturen.
