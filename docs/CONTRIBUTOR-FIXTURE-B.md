# Campaign-B-Fixture reproduzieren

Dieser kurze Einstieg prüft genau ein eingechecktes synthetisches Fixture: `e2e01-campaign-b-v1`. Es beschreibt eine zweite Kampagne mit eigenem Atlas, zwei Orten, einer Stadt, einem Dungeon und zwei Terrainchunks. Der Ablauf verändert weder Produktquellen noch Nutzerdaten.

Die Prüfung ist auf den veröffentlichten Fixture-Commit [`eacf6abd57523a246c4d5399ac119bd9af2a0e03`](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/commit/eacf6abd57523a246c4d5399ac119bd9af2a0e03) gepinnt. Damit bleibt sie reproduzierbar, auch solange der darüberliegende Integrationskandidat noch nicht in `active/installed-phase1` enthalten ist.

## Frischer Checkout

```bash
git clone https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1.git
cd Obsidian-Dungeon-Editor-Phase1
git checkout --detach eacf6abd57523a246c4d5399ac119bd9af2a0e03
npm ci
```

`git rev-parse HEAD` muss danach genau `eacf6abd57523a246c4d5399ac119bd9af2a0e03` ausgeben.

## Bytes und Identitäten prüfen

Der [Generator](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/eacf6abd57523a246c4d5399ac119bd9af2a0e03/tools/materialize-campaign-b-fixture.mjs) erzeugt ausschließlich das [Campaign-B-Fixture](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/tree/eacf6abd57523a246c4d5399ac119bd9af2a0e03/tests/fixtures/atlas-e2e-campaign-b-v1). Er liest Campaign A nicht. Erneutes Materialisieren muss bytegleich bleiben:

```bash
node tools/materialize-campaign-b-fixture.mjs
git diff --exit-code -- tests/fixtures/atlas-e2e-campaign-b-v1
```

Der zweite Befehl bleibt ohne Ausgabe und endet mit Status `0`. Jede Abweichung an den acht nativen Dateien oder am `manifest.json` lässt ihn fehlschlagen.

Danach den vorhandenen fokussierten Test bauen und ausführen:

```bash
node build.mjs --test
node --test --test-name-pattern='Campaign B' .build/tests.cjs
```

Erwartet werden genau zwei bestandene Tests und kein Fehler. Der [Fixture-Test](https://github.com/ThonkTank/Obsidian-Dungeon-Editor-Phase1/blob/eacf6abd57523a246c4d5399ac119bd9af2a0e03/tests/core/campaign-b-fixture.test.ts) prüft unter anderem:

- Bytezahlen und SHA-256-Werte jeder im Manifest genannten Datei;
- disjunkte Pfade, Digests und UUIDs gegenüber Campaign A;
- parsebare World-, Terrain-, Location-, City-, Dungeon- und Campaign-Dateien;
- Campaign-, Namespace-, Registry- und Owneridentitäten sowie deren Digests;
- Auffindbarkeit von A und B über die produktive Runtime-Quelle.

Zum Schluss muss `git status --short` leer bleiben. Das zeigt, dass der Generator im frischen Checkout exakt die eingecheckten Bytes erzeugt hat.

## Grenze des Nachweises

Das ist ein deterministischer Modell- und Dateinachweis. Er startet weder Obsidian noch Electron, bedient keinen nativen Picker und belegt keinen echten A→B→A-Hostlauf, keine Installation und keine physische Eingabe. Solche Behauptungen benötigen weiterhin einen separat koordinierten Hostlauf mit eigenem Prozess-, Datei- und Bedienbeleg.
