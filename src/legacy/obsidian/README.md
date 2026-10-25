# Historischer Obsidian-Anschluss

Diese Adapter und Oberflächen gehören zum früheren Plugin. `build.mjs` baut
weiterhin `main.ts` als historischen Nachweis. Der aktive Electron-Desktop
verwendet `desktop/` und die Fachbereiche in `src/app/`.

Gemeinsam verwendete, reine Fachlogik bleibt außerhalb dieses Verzeichnisses.
Quellenbindungen und Referenztests bleiben erhalten; dieser Bereich ist kein
Desktop-Lieferziel. Es gibt keine Weiterleitungsdateien an den früheren Pfaden.
