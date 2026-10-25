import { cp, mkdir, readFile, writeFile, chmod, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const target = process.argv[2] ?? '.build/releases/linux-x64';
if (process.platform !== 'linux' || process.arch !== 'x64')
  throw new Error(
    'Dieser erste Packsmoke ist für Linux x64. Andere OS benötigen ihre eigenen Laufzeiten und Tests.',
  );
const appDir = path.join(target, 'resources/app');
const existing = await readdir(target).catch((error) => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
if (existing.length) {
  let previous;
  try {
    previous = JSON.parse(await readFile(path.join(appDir, 'package.json'), 'utf8'));
  } catch {
    throw new Error('Ausgabeordner ist nicht leer und gehört nicht zu SaltMarcher.');
  }
  if (!['saltmarcher', 'campaign-workbench'].includes(previous?.name))
    throw new Error('Ausgabeordner ist nicht leer und gehört nicht zu SaltMarcher.');
}
const applicationVersion = JSON.parse(await readFile('package.json', 'utf8')).version;
const built = JSON.parse(await readFile('.build/desktop/build-info.json', 'utf8'));
if (built.applicationVersion !== applicationVersion)
  throw new Error(
    'Releaseversion und Desktopbuild passen nicht zusammen. Desktopbuild neu erzeugen.',
  );
await mkdir(target, { recursive: true });
await cp('node_modules/electron/dist', target, { recursive: true });
const runtime = path.join(target, 'electron');
await chmod(runtime, 0o755);
await chmod(path.join(target, 'chrome_crashpad_handler'), 0o755);
await rm(appDir, { recursive: true, force: true });
await mkdir(appDir, { recursive: true });
await cp('.build/desktop', appDir, { recursive: true });
await writeFile(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    {
      name: 'saltmarcher',
      productName: 'SaltMarcher',
      version: applicationVersion,
      main: 'main.cjs',
    },
    null,
    2,
  ),
);
const nativeDir = path.join(appDir, 'node_modules/better-sqlite3');
await mkdir(path.join(nativeDir, 'prebuilds'), { recursive: true });
await cp('node_modules/better-sqlite3/lib', path.join(nativeDir, 'lib'), { recursive: true });
await cp(
  'node_modules/better-sqlite3/prebuilds/linux-x64.node',
  path.join(nativeDir, 'prebuilds/linux-x64.node'),
);
await cp('node_modules/better-sqlite3/package.json', path.join(nativeDir, 'package.json'));
await cp('node_modules/better-sqlite3/LICENSE', path.join(nativeDir, 'LICENSE'));
await cp('NOTICE.md', path.join(target, 'NOTICE.md'));
await rm(path.join(target, 'resources/default_app.asar'), { force: true });
await writeFile(
  path.join(target, 'Starten.sh'),
  '#!/bin/sh\napp_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)\nexec env ELECTRON_RUN_AS_NODE=1 "$app_root/electron" "$app_root/resources/app/update-helper.cjs" --launch "$@"\n',
);
await chmod(path.join(target, 'Starten.sh'), 0o755);
await writeFile(
  path.join(target, 'LIESMICH.txt'),
  `SaltMarcher ${applicationVersion} – Linux x64

Start
  Starten.sh ausführen. Node.js und npm werden nicht benötigt.

Daten
  Standard: lokaler Appdatenordner CampaignWorkbench.
  Separater Ordner: ./Starten.sh --data-dir /pfad/zum/ordner

Umfang
  Kampagnenverwaltung, Vorbereitung und Live-Spiel, Katalog, Gegenstände,
  Welt und Atlas, Städte, lokale Musik, Dungeonwerkzeuge sowie eine getrennte
  schreibgeschützte Spieleranzeige. Quests und Gerüchte tragen vorbereitete
  XP- und Gegenstandsbelohnungen; persönliche Mengenstapel lassen sich teilen,
  zusammenführen und weitergeben. Angefangene Questangaben bleiben als Entwurf
  erhalten; spätere Verkäufe weitergegebener Beute aktualisieren den ursprünglichen
  Lootwert. Kampf- und Questabschlüsse lassen sich mit Ergebnis und Belohnungsfeldern
  unterbrechen und nach einem Neustart fortsetzen. Der Szenentisch verbindet
  Kampagnenwissen, Suche, gruppenspezifische Pins, direkte NPC-/Quest-/Ortsanlage
  und bearbeitbare Notizen mit der laufenden Gruppe. 289 lokal erfasste
  SRD-5.1-Gegenstände sind mit Quellenangaben, eigenen Kopien und Shoppreisen
  nutzbar; die vollständige Quellenabdeckung bleibt ausdrücklich offen.
  Der eigene Schatzbereich erlaubt Ortszuordnung, Nachbearbeitung unverteilten
  Bestands und Verschiebungen mit Herkunft. Bereits vergebene Beute bleibt im
  persönlichen Ledger erhalten; angefangene Schatzangaben bleiben als Entwurf.
  Monstergruppen lassen sich unabhängig vom Plan mit einzelnen NPC-Figuren,
  HP, Zuständen und Notizen vorbereiten und platzieren. Am Szenenort wählst du
  die Figuren für eine Begegnung ausdrücklich aus.
  Mehrere Begegnungen derselben Scene teilen Figuren-HP und Zustände.
  Partywechsel entfernen PCs aus allen offenen Begegnungs-/Verfolgungsmasken.
  Spielabendpläne lassen sich aus vorhandenen Timelines wiederverwenden oder
  ersetzen. Angenommene Weltinhalte und laufende Scenes bleiben erhalten.
  Kampagnen lassen sich als .kwcampaign mit
  ihren Medien übertragen.

Status
  Dies ist ein Entwicklungsstand. Der vollständige Funktionsumfang,
  Plattformtests und die Produktabnahme sind noch offen.

Lizenzen und Attribution stehen in NOTICE.md.
`,
);
console.log(
  `Linux desktop package: ${path.resolve(target)} (Electron ${JSON.parse(await readFile('node_modules/electron/package.json')).version}; SQLite dependency ${require('better-sqlite3/package.json').version})`,
);

await writeFile(
  path.join(target, 'Installieren.sh'),
  '#!/bin/sh\napp_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)\nexec env ELECTRON_RUN_AS_NODE=1 "$app_root/electron" "$app_root/resources/app/update-helper.cjs" --bootstrap "$@"\n',
);
await chmod(path.join(target, 'Installieren.sh'), 0o755);

await mkdir(path.join(target, 'licenses'), { recursive: true });
await cp('node_modules/yauzl/LICENSE', path.join(target, 'licenses/yauzl.txt'));
await cp('node_modules/pend/LICENSE', path.join(target, 'licenses/pend.txt'));
