# Referenzlücken vor den Stadtpaketen

Abgeleitete Übersicht vom09.10.2026, CITY-00-I35-I; 65 CO-/24 CTY-Pflichten. Maßgeblich bleibt `acceptance.json` unter `cityPlans.functionalInventory`. Ein Originalprobe-Status bezeichnet ausschließlich beobachteten Umfang; eigene Umsetzung, Hostvergleich und bessere Bedienung sind für alle Einträge offen. Diese Übersicht ersetzt keine Pflicht und kein Abnahmetor. Sie ist ein versionierter Snapshot, keine zusätzliche Statusdatenbank; spätere Änderungen werden aus acceptance in einem zusammengehörigen Planpaket neu zugeordnet.

CITY-01 startet nach HEX-05. Frühe Referenzen: Save/Open CO-COK-0006 direkt belegt; FTG-Gebäudeverschiebung/Abbruch sowie Straßenzeichnung/Save/Reload/Entfernung CO-FTG-0015 direkt teilbelegt. COK-Undo CO-COK-0007: je zwei Versuche nach Save und vor manuellem Save ohne Rücknahme; automatische Sicherungen/History-Eignung ungeklärt, beide Hypothesen gestoppt. Weitere Originalwirkungen werden spätestens vor ihrer hier genannten Zielphase geprüft.

| Pflicht | Zielphase | Funktion | Originalbelegumfang |
|---|---|---|---|
| CO-COK-0006 | CITY-01 | Native Karten speichern und öffnen | save_and_fresh_open_observed |
| CO-COK-0007 | CITY-01 | Rückgängig und Wiederherstellen | two_undo_attempts_before_manual_save_no_observed_effect; Auto-Save ungeklärt, Redo ungeprüft |
| CO-FTG-0015 | CITY-01 | Manuelle Kartenbearbeitung | road_draw_save_reload_remove_observed |
| CO-FTG-0001 | CITY-02 | Siedlungsgröße und benannte Vorgaben | partial |
| CO-FTG-0002 | CITY-02 | Straßenlayout und Bebauungsvorgaben | preset_parameter_change_observed_not_generated |
| CO-FTG-0010 | CITY-02 | Küste, Insel und Flüsse | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0022 | CITY-02 / CITY-06 | Einstellungen und Namenslisten | load_empty_save_access_unconfirmed; frühere Namensauswahl erhalten |
| CO-WAT-0001 | CITY-02 | Stadtlayout und Größenoptionen | Frühere Feature-Rebuilds; Small ändert Größe UND Seed,9 Gruppen geändert/4 gleich; feste Presetranges/Customgröße/weitere Features offen |
| CO-WAT-0011 | CITY-02 / CITY-08 | Reproduzierbare Generatorlinks (Permalink) | From URL/Generate stellt Kontrollausgabe bytegleich wieder her; manuelle Erhaltung/Versionverträglichkeit/eigener Vergleich offen |
| CO-FTG-0016 | CITY-04 | Lokale Neugeneration | keine gesonderte Wirkungsprobe; documentation |
| CO-WAT-0007 | CITY-04 | Lokale Geometrie erneut erzeugen | local_reroll_visual_effect_observed |
| CO-WAT-0008 | CITY-04 | Stadtgeometrie verformen (Warp) | all8_operations_direct_partial; Rotate global, Measure96m |
| CO-COK-0008 | CITY-05 | Snapping und Kollisionsprüfung | control_observed_only |
| CO-WAT-0003 | CITY-05 | Gassen und Straßennetz | alley_flag_actual_json_roads_3_to74_other13_equal; Einzelbearbeitung/Topologie/Persistenz offen |
| CO-WAT-0010 | CITY-05 | Kontrollierte Tor-/Straßenanzahl | Number3 und Maximum/hub-Rebuild direkt; Maximum roads5→10/weitere4 Gruppen geändert/andere8 gleich; Default-Rückstellungen bytegleich; genaue Maximalregel/Torzählung offen |
| CO-FTG-0004 | CITY-06 | Demografie und Lebensstandard | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0005 | CITY-06 | Regierung und Wachen | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0006 | CITY-06 | Viertelwachstum und Dekoration | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0007 | CITY-06 | Fraktionen | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0008 | CITY-06 | Religionen und Götter | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0012 | CITY-06 | Gegenstände, Dienstleistungen und Preise | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0013 | CITY-06 | Gebäudebedarfe und Anzahlgrenzen | partial |
| CO-FTG-0014 | CITY-06 | Bewohnerdetails und Beziehungen | resident_access_unverified_after_network_error; Detail nicht erreicht |
| CO-FTG-0017 | CITY-06 | Bewohner-Massenbearbeitung | partial |
| CO-FTG-0026 | CITY-06 | Familienstammbaum | graph_fullscreen_person_navigation_observed |
| CO-FTG-0027 | CITY-06 | Gebäudeereignisse | control_observed_only |
| CO-FTG-0028 | CITY-06 | Favoriten für Gebäude und Bewohner | control_observed_only |
| CO-FTG-0030 | CITY-06 | Gebäudedaten bearbeiten und erhalten | rename_save_reload_observed |
| CO-WAT-0006 | CITY-06 | Landmarken setzen | legend_name_inline_rename_delete_and_actual_svg_observed; Position-Menü ist Legendenlayout, Pin/Persistenz offen |
| CO-COK-0001 | CITY-07 | Pfad-/Flächenplatzierung | named_path_and_plot_effect_observed |
| CO-COK-0002 | CITY-07 | Zufallsvarianten von Objektkategorien | keine gesonderte Wirkungsprobe; documentation |
| CO-COK-0003 | CITY-07 | Zusammen bewegte Objektgruppen | Auto Combine angeboten; Hütte/Stumpf bodengleich platziert, nur Hütte bewegt und gespeichert; geeigneter Träger/gemeinsame Bewegung offen |
| CO-COK-0012 | CITY-07 | Layergruppen gemeinsam einblenden und gegen Bearbeitung sperren | Groups-Tooltip direkt; in Demo nicht verfügbar, vollständige Originalwirkung offen |
| CO-COK-0004 | CITY-07 | Licht und Wettervorlagen | keine gesonderte Wirkungsprobe; documentation |
| CO-COK-0009 | CITY-07 | Höhenversatz von Pfaden und Plots | control_observed_only |
| CO-COK-0010 | CITY-07 | Eigene Assets und Asset Editor | control_observed_only |
| CO-COK-0011 | CITY-07 | Gemeinschaftsassets über Steam Workshop | control_observed_only |
| CO-FTG-0003 | CITY-07 | Baumaterial | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0009 | CITY-07 | Landschaft und Klima | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0011 | CITY-07 | Kalender | keine gesonderte Wirkungsprobe; direct |
| CO-FTG-0018 | CITY-07 | Tagespläne und Zeitsimulation | partial_effect_observed |
| CO-FTG-0019 | CITY-07 | Wetter, Jahreszeiten, Tag/Nacht | partial_effect_observed |
| CO-FTG-0031 | CITY-07 | Dachdarstellungsmodi | control_observed_only |
| CO-FTG-0033 | CITY-07 | Texturen oder Vollfarben | control_observed_only |
| CO-FTG-0034 | CITY-07 | Materialfarbvariation | control_observed_only |
| CO-FTG-0035 | CITY-07 | Weiche Feldkanten | control_observed_only |
| CO-FTG-0036 | CITY-07 | Wassertiefe und Schaumdarstellung | control_observed_only |
| CO-FTG-0039 | CITY-07 | Bildeffekte | control_observed_only |
| CO-FTG-0041 | CITY-07 | 3D-Darstellung und Street View | perspective_entry_and_return_observed |
| CO-FTG-0042 | CITY-07 | Ruhetag manuell überschreiben | control_observed_only |
| CO-WAT-0002 | CITY-07 | Dächer und Vierteldarstellung | Dach-/Display-/Processing-/Raised-/Solids visuell; Processing-JSON buildings669→651/andere13 gleich; Complex-Vollwirkung und interne Geometrie/IDs/Persistenz offen |
| CO-WAT-0004 | CITY-07 | Wälder und Stadtumgebung | Bäume0→13 Punkte; Waldflag off/on/off mit sichtbaren Außenflächen, tatsächliches JSON bytegleich299585B/all14; Konturbearbeitung/Persistenz offen |
| CO-WAT-0009 | CITY-07 | Farb-/Stilvorgaben | vivid_apply_color_file_geometry_equal_tint_partial |
| CO-COK-0005 | CITY-08 | Exportbereich, Raster und Vorlagen | keine gesonderte Wirkungsprobe; documentation |
| CO-FTG-0020 | CITY-08 | Bild-, CSV- und JSON-Ausgabe | partial |
| CO-FTG-0021 | CITY-08 | FoundryVTT und Roll20 Integration | disabled_control_observed_only |
| CO-FTG-0023 | CITY-08 | Generierungsvorschau und Metropole | keine gesonderte Wirkungsprobe; documentation |
| CO-FTG-0024 | CITY-08 | SVG-Kartenausgabe | control_observed_only |
| CO-FTG-0025 | CITY-08 | GeoJSON-Kartenausgabe | control_observed_only |
| CO-FTG-0029 | CITY-08 | Maßstab, Lineal und Einheiten | control_observed_only |
| CO-FTG-0032 | CITY-08 | Sichtbarer Dekorationsanteil | control_observed_only |
| CO-FTG-0037 | CITY-08 | Kantenglättung und FPS-Anzeige | control_observed_only |
| CO-FTG-0038 | CITY-08 | Schattenqualität | control_observed_only |
| CO-FTG-0040 | CITY-08 | SVG-Renderer als Gerätefallback | control_observed_only |
| CO-WAT-0005 | CITY-08 | PNG-/SVG-/JSON-Ausgabe | png_svg_json_received_parsed_partial; SVG-Sichtnachweis offen |

Der FTG-Move-Ablauf enthält getrennte Orts- und Orientierungsschritte. Im eigenen CITY-01-Editor kann direkter Zug mit sichtbarer Vorschau dieselbe Aufgabe erfüllen; Aktionsersparnis und bessere Verständlichkeit bleiben bis zur gepaarten Bedienprobe unbewiesen. Material- und Meterhöhe gehören an dieselbe Gebäudegeometrie/Assetreferenz, keine zweite Karte. Cancel muss den gesamten Entwurf ohne Persistenz-/Historywirkung verwerfen.
