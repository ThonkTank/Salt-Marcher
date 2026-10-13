import { cp, mkdir, readFile, writeFile, chmod, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const target = process.argv[2] ?? '.build/releases/linux-x64';
if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Dieser erste Packsmoke ist für Linux x64. Andere OS benötigen ihre eigenen Laufzeiten und Tests.');
const appDir = path.join(target, 'resources/app');
const existing = await readdir(target).catch(error => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
if (existing.length) {
  let previous;
  try { previous = JSON.parse(await readFile(path.join(appDir, 'package.json'), 'utf8')); }
  catch { throw new Error('Ausgabeordner ist nicht leer und gehört nicht zur Kampagnenwerkstatt.'); }
  if (previous?.name !== 'campaign-workbench') throw new Error('Ausgabeordner ist nicht leer und gehört nicht zur Kampagnenwerkstatt.');
}
const applicationVersion = JSON.parse(await readFile('package.json', 'utf8')).version;
const built = JSON.parse(await readFile('.build/desktop/build-info.json', 'utf8'));
if (built.applicationVersion !== applicationVersion) throw new Error('Releaseversion und Desktopbuild passen nicht zusammen. Desktopbuild neu erzeugen.');
await mkdir(target, { recursive: true });
await cp('node_modules/electron/dist', target, { recursive: true });
const runtime = path.join(target, 'electron'); await chmod(runtime, 0o755);
await chmod(path.join(target, 'chrome_crashpad_handler'), 0o755);
await rm(appDir, { recursive: true, force: true });
await mkdir(appDir, { recursive: true });
await cp('.build/desktop', appDir, { recursive: true });
await writeFile(path.join(appDir, 'package.json'), JSON.stringify({ name: 'campaign-workbench', productName: 'Kampagnenwerkstatt', version: applicationVersion, main: 'main.cjs' }, null, 2));
const nativeDir = path.join(appDir, 'node_modules/better-sqlite3'); await mkdir(path.join(nativeDir, 'prebuilds'), { recursive: true });
await cp('node_modules/better-sqlite3/lib', path.join(nativeDir, 'lib'), { recursive: true });
await cp('node_modules/better-sqlite3/prebuilds/linux-x64.node', path.join(nativeDir, 'prebuilds/linux-x64.node'));
await cp('node_modules/better-sqlite3/package.json', path.join(nativeDir, 'package.json'));
await cp('node_modules/better-sqlite3/LICENSE', path.join(nativeDir, 'LICENSE'));
await cp('NOTICE.md', path.join(target, 'NOTICE.md'));
await rm(path.join(target, 'resources/default_app.asar'), { force: true });
await writeFile(path.join(target, 'Starten.sh'), '#!/bin/sh\napp_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$app_root/electron" "$@"\n'); await chmod(path.join(target, 'Starten.sh'), 0o755);
await writeFile(path.join(target, 'LIESMICH.txt'), `Kampagnenwerkstatt ${applicationVersion} – lokaler Desktopstand

Start: Starten.sh ausführen. Keine Node- oder npm-Installation nötig.
Daten: lokaler Appdatenordner CampaignWorkbench.
Separater Ordner: ./Starten.sh --data-dir /pfad/zum/ordner

Benutzbar: Kampagnen, Raumzeichnung und Keys, Welttexte und Beziehungen, Orte, Spielabendplanung und Generatoren, Party und getrennte Szenenzeiten, Kampfführung, XP/Rasten/Beute, Monsterkatalog, Gegenstände und Shops, Hexkarten, assistierte Stadtpläne mit Straßen/Vierteln, geschützter Bebauung und individueller Hauskorrektur, Kalender/Wetter/Reise, lokale Musik und Ambience; zweites schreibgeschütztes Spielerfenster mit Gruppenfokus, Kenntnis-/Sichtfilter, Orts-/NPC-Bildern und GM-Blank/Override; opt-in NPC-Verhalten mit Bedürfnissen, Jobs, Ortswegen, Reservierungen, bestätigter Zeit und Party-Entscheidungsgrenzen; direkte Dungeonzeichner mit Raum-/Höhlenpinsel, Aussparungen, Geschossen, gebundenen Türen, Lichtblockaden, Objekten/Flächen/Text, Höhenansicht, Fallen-Charges/Reset und gemeinsamer Autoren-History; Dungeon-Leiten mit räumlicher Gruppenposition, Tür-/Treppenwegen, bestätigter Szenenzeit, Fallenhalt/GM-Freigabe, sichtbarer und erinnerter Dungeon-Geometrie im Spielerfenster sowie NPC-Raumpositionen und räumlichen Jobs, Patrouillen zwischen zwei Räumen, fortgesetzten NPC-Teilwegen, gespeicherten Spuren, gemeinsamen Geometrieständen, zielbezogenen Reservierungen und Fallen-Reset-Jobs über tatsächliche Tür-/Treppenwege; gerichtete Sicht-/Geräuschwahrnehmung, persistente aktive Ergebnisse und GM-Overrides, Spurenentdeckung/-korrektur und bestätigte Begegnungen mit vorhandenen räumlichen NPCs; manuelle Fährten, Bewegungs-/Oberflächenprofile, zeitabhängige Spurenstärke und abschnittsweise Verfolgung mit Prüfungen, Abzweigungen und Fährtenverlust; bearbeitbare 5-Fuß-Volumen mit Höhenschnitten und Flächen, 3D-Körperfreiheit und Hindernissen, Kriech-/Flug-/Schwimm-/Kletterwegen sowie Sicht und Kenntnis nach Höhe; parametrische Korridor-/Treppen-/Rampen-/Leiter-/Schachtverbindungen mit bestätigter Neuberechnung und unabhängigen funktionalen Passagen je Richtung; Dungeon-Key mit Sammelbearbeitung, konzeptuellen Leveln und Gruppen, beschreibender Attributvererbung, verknüpften Textvorlagen, geordneten dynamischen Beschreibungen, ausdrücklich bestätigter Gruppenentdeckung und druckbarer Karten-/Key-Ausgabe; bearbeitbarer Dungeon-Graph mit geschützter Rastervorschau, unabhängiger vollständiger Wiederherstellung, gemeinsamer Übernahme/Undo, Detailreduktion, erhaltenen offenen Gruppenverbindungen und mehrschichtigen Inhalts-Heatmaps; Dungeon-/Level-/Bereichsbudgets mit vererbtem Ziellevel, expliziten Spielabendanteilen und unverteiltem Rest, DMG-XP- und Preset-Fortschrittsguidance, referenzierten Encounter-/Loot-Inhalten sowie Curiosities mit freien Texten, privaten Lösungsnotizen, Tags und exakten Voxelankern; frei markierte mehrteilige Trap-Triggerfelder mit geschützter Autoren-History, tatsächlichem Reiseeintritt, getrennten Notify-/Interrupt-Kontexten, ausdrücklich bestätigtem idempotentem Chargeverbrauch und gemeinsamer zeitgebundener Vollaufladung; räumliche Encounter-/Loot-/Curiosity-Kontexte mit privaten Suchhinweisen, ausdrücklicher Gruppenentdeckung, einmaliger Bindung persistenter NPC-Actors, wiederverwendetem Kampf und direkter Übergabe aus vorhandener Beute an den Ledger; beschriebene Wand-/Boden-/Deckenregionen mit direkter Flächenmarkierung, Raumvererbung, Vorlagen, dynamischer öffentlicher Darstellung und Erhalt ungebundener Fragmente bei Schnitten; Quest-/Gerüchtstatus, Ortsbindung und Mitwirkende, gemeinsamer Encounter-/Questbelohnungsdialog, mehrere Gegenstandsbelohnungen sowie Mengenstapel und ausdrückliche Figurenweitergabe im persönlichen Beutebuch.
Verwalten / Transfer: geschlossene .kwcampaign-Pakete mit Audio; unabhängige Kopien, Importvorschau und ausdrückliche Entscheidungen bei gemeinsamen Definitionskonflikten; Kampagnen-Papierkorb mit Wiederherstellung und dauerhafter Löschung nach Namensbestätigung.

Der dokumentierte Gesamtumfang bleibt in Arbeit, insbesondere Stadtwerkzeuge, volle Dungeon-/Atlasfunktionen, erweiterte Autonomie-/Inventory-/Mechanikoperationen, vollständige Dungeon-Wahrnehmung und Extensions. Dieser Stand ist ein Linux-x64-Paket.
`);
console.log(`Linux desktop package: ${path.resolve(target)} (Electron ${JSON.parse(await readFile('node_modules/electron/package.json')).version}; SQLite dependency ${require('better-sqlite3/package.json').version})`);
