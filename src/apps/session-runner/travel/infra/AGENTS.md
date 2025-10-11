# Ziele
- Verbindet die Travel-Domain mit Obsidian-spezifischen Diensten und Ereignissen.
- Beschreibt, welche Adapter-Funktionen die Domain erwartet und wie Encounter-Sync Playback und Sessions steuert.
- Sichert nachvollziehbare Standards für neue Infrastruktur-Hooks (z. B. weitere Adapter oder Gateways).

# Aktueller Stand
## Strukturüberblick
- `adapter.ts` definiert den `RenderAdapter`-Vertrag: `ensurePolys`, `centerOf`, `draw` sowie das `token`-Handle, das vom Travel-Playback genutzt wird.
- `encounter-sync.ts` beobachtet Encounter-Events aus `apps/encounter/session-store`, pausiert Travel-Playback und öffnet Encounter-Views über das Gateway.

## Integrationspfade
- `createTravelLogic()` injiziert beim Start einen `RenderAdapter` und ruft dessen `draw`-/`ensurePolys`-Methoden bei jeder Zustandsänderung auf.
- `view/experience.ts` erzeugt `createEncounterSync()` und koppelt `pausePlayback` sowie `openEncounter()` an den Lifecycle.
- Encounter-Events aus `view/controllers/encounter-gateway` landen zuerst im Session-Store; `createEncounterSync()` dedupliziert Events anhand der ID und sorgt dafür, dass externe Trigger den Encounter-View öffnen.

## Beobachtungen & Risiken
- Externe Encounter-Events pausieren das Playback sofort, auch wenn `onExternalEncounter` den View-Start verhindert (z. B. bei Abbruch). Ohne Gegenmaßnahme bleibt der Travel-Modus dann dauerhaft pausiert.
- Manuelle oder externe Events rufen `openEncounter()` ohne `await` auf. Schlägt das Öffnen fehl, verschwindet die Fehlermeldung im Promise, sodass Nutzer*innen und Logs keine Rückmeldung erhalten.

# ToDo
- [P2.59] Playback nur pausieren, wenn ein Encounter tatsächlich geöffnet wird, oder nach unterdrückten externen Events sauber fortsetzen.
- [P2.60] `openEncounter()` bei externen Events awaiten und Fehler bzw. Abbrüche mit Logging/Notice sichtbar machen.

# Standards
- Adapter beschreiben die Quell- und Zielsysteme im Kopfkommentar.
- Neue Adapter exportieren reine Fabriken ohne Singleton-Zustand.
- Encounter-Integrationen dokumentieren, wie sie mit `apps/encounter/*` interagieren und welche Hooks (`pausePlayback`, `openEncounter`) sie erwarten.
