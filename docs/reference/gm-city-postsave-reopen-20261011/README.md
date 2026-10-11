# City-Hausname: Post-Save-Fresh-Process und PR-117-Fokus

Dieser Beleg schließt den in #92 offen gelassenen dauerhaften Wiederöffnungsanschluss und bindet die danach ausdrücklich übergebene enge PR-117-Tastaturprüfung.

## Quellen und Host

- Nachweis: [#92](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/issues/92), `GM-CITY-HOUSE-NAME-CLOUD-UI-RETEST-20261011-01`.
- Post-Save-Fresh-Process-Lauf: Shared/Product `eaf6bd95564ab398eabe9b2c0ac046feec079f0f`, nach integriertem City-Save-Fix PR #106. `npm run build` am exakten Commit PASS, Node v24.19.0, `dirty:false`; der Build wurde auf diesem Commit erneut erzeugt und gegen das damals im Vault installierte Tripel bestätigt.
- PR-117-Fokuslauf: aktueller Shared/Product `a4c2cb39aafdfb7abf5469e575a82e630ef41313`, Merge von PR #117 / Produktcommit `14729dc429d9699998284b1ee7a3bb8ee3ebc8a3`. `npm run build` PASS, Node v24.19.0, `dirty:false`.
- Die beiden Produktläufe sind getrennt an ihre Quellen gebunden. Zwischen `eaf6bd9` und `a4c2cb3` liegt beim City-Inspector nur die PR-117-Fokusänderung in `src/ui/atlas-city-building-panel.ts`; City-Save-/Datenpfad blieb derselbe. Die Tastaturprüfung lief danach mit dem exakt gebauten und installierten PR-117-Tripel.
- Beide Läufe nutzten denselben unabhängigen Cloud-Container `gm-city-cloud-isolated-20261011` (ID `e49e330d328c1e2d97e6f46a677e34f5f288c4dab7b41db242d3584e4ab66b33`), Obsidian 1.14.4 / Electron 43.7.7, eigenes Xvfb `:100` bei 1440×1000, sichtbares Appfenster 1024×800, DPR 1. CDP war nur der eigene Cloud-Host-Zugang; kein Laptop oder Nutzervault.
- Testdatenbasis: `tests/fixtures/atlas-e2e-spatial-v2/input`, Manifest SHA-256 `23735bb6c95107b7dec93ffa56ec66405a0f4fe0ec3822fc0476d90d2920188d`. Der City-Post-Reopen-Lauf nutzte den isolierten Vault `/dev/shm/gm-city-postsave-reopen-vault-6105457026`; der Fokuslauf eine daraus abgeleitete, getrennte QA-Kopie `/dev/shm/gm-city-pr117-vault-6105507657`.

### Build-Tripel

Die reproduzierbaren `npm run build`-Quittungen und Tripel stehen in [BUILD-MANIFEST.md](BUILD-MANIFEST.md).

| Lauf | Produkt-SHA | `main.js` | `styles.css` | `manifest.json` |
| --- | --- | --- | --- | --- |
| Fresh-Process/City | `eaf6bd95564ab398eabe9b2c0ac046feec079f0f` | `46736ec62a71db260ddf3a78b66ddd15417e60cb8d3f796539b2d5b9b1693038` | `df11f8352b61e45d3984d29e0136fc0225aaabe85c7b004a3b55eb0c6cc52934` | `2acb4649cad04120636e891c96c5cbb9c84d5b91b1e4e378705b0f58d7a4bd64` |
| PR-117-Fokus | `a4c2cb39aafdfb7abf5469e575a82e630ef41313` | `f3332ceac377a77fcdc359316bcba94217a6ca9d1e6bddbb2c932fed3373a953` | `df11f8352b61e45d3984d29e0136fc0225aaabe85c7b004a3b55eb0c6cc52934` | `2acb4649cad04120636e891c96c5cbb9c84d5b91b1e4e378705b0f58d7a4bd64` |

## Sichtbarer City-Nachtest

Nach dem ersten sichtbaren Save wurde der eigene Obsidian-Prozess über `Browser.close` geordnet geschlossen; der alte Prozess verschwand, ohne erzwungene PID-Beendigung. Der gleiche Profil-/Vaultpfad wurde danach mit neuem Obsidian-PID 3313 wieder geöffnet. Das ist ein neuer Prozess, keine bloße Tab-Neuöffnung; ein Exitcode des vorherigen Detached-Launchers lag nicht vor.

1. Der wiedergeöffnete Atlas zeigte Torheim. Über den sichtbaren Torheim-Marker und `Ziel suchen` wurde „Roter Anker“ gefiltert; die sichtbare Ergebniszeile lautete `Haus B — Roter Anker (Post-Save-Reopen 2026-10-11)`.
2. Das sichtbare Ergebnis öffnete die Stadtkarte. Ein Klick auf die Haus-B-Fläche öffnete `Haus bearbeiten`; das Feld zeigte genau den im vorherigen Lauf gespeicherten Namen.
3. Der Name wurde zu `Haus B — Roter Anker (Post-Save-Reopen 2026-10-11; erneut verwendet)` geändert. Nach `Hausname übernehmen` meldete die UI zunächst nur `Entwurf gesichert`; erst der sichtbare Atlas-Button `Speichern` zeigte `Gespeichert`. Der City- und Campaign-Dateihash änderte sich entsprechend.

**Data oracle:** Gegenüber dem e2e01-spatial-v2-City-Input änderte sich im City-JSON nur `buildings[1].name`; IDs 105/106 und sämtliche Gebäudegeometrie einschließlich Innenhof blieben identisch. Zwischen dem vor diesem Fresh-Process-Anschluss aufgenommenen Hash und danach änderten sich City und Campaign; Atlas, beide Terraindateien, Dungeon und beide Ortsdateien blieben bytegleich. Der Campaign-Hashwechsel enthält den erwarteten neuen City-Digest-/Registry-Revision-Pfad. Exakte Pfade und SHA-256 stehen in [DATA-ORACLE.txt](DATA-ORACLE.txt).

## Sichtbare PR-117-Tastaturprüfung

Auf einer getrennten Kopie des gespeicherten synthetischen City-Zustands, mit dem frisch gebauten und installierten PR-117-Tripel:

1. Im sichtbaren Haus-Inspector wurde `Gebäudename` fokussiert, der Text per Ctrl+A/Tastatureingabe ersetzt und mit Tab der aktuelle Button `Hausname übernehmen` erreicht. Enter übernahm den Text. Nach dem Re-Render blieb der sichtbare Fokusrahmen am neu erzeugten Button `Hausname übernehmen`.
2. Ein zweiter unübernommener Tastaturentwurf wurde erstellt. Tab/Tab erreichte `Namenseingabe verwerfen`; Enter verwarf den Entwurf. Der neu erzeugte Verwerfen-Button behielt den sichtbaren Fokus, und das Feld zeigte weiterhin den zuvor übernommenen Wert.
3. Ein weiterer Tab bewegte den Fokus erwartungsgemäß auf das nächste sichtbare Inspector-Control `Atlas speichern`. Die City-, Atlas- und Campaign-Dateihashes der isolierten Fokus-Kopie blieben während dieser Folge unverändert; der Tastaturtest schrieb keine Daten.

## Grenzen

- Die Tastatureingaben waren synthetische Cloud-CDP-Tastaturereignisse; kein physisches Keyboard-/Mausgerät.
- Der Tastaturtest prüfte Apply/Discard und die Fokusfortsetzung; der separate direkte-Save-Fokusfall aus PR #117 wurde nicht ausgeführt.
- Kein 200-%-Zoom-/Fenstergrößen-, physischer Eingabe-, Wiederherstellungs-, PlayerProjection-, Originalkarten- oder breiter Atlas-/Dungeon-/E2E-Pass. Keine Produktlatenz gemessen.
- Der Fresh-Process-Citytest ist an `eaf6bd9` gebunden; der PR-117-Fokuslauf ist an `a4c2cb3` gebunden. Ergebnisse nicht auf weitere Builds übertragen.

## Rohbilder

Die Hashes der acht beigefügten Screenshots stehen in [screenshots/SHA256SUMS.txt](screenshots/SHA256SUMS.txt).
