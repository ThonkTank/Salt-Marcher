# DD-043.22: offener Hostvergleich

Die Originaldatei mit Wand, Portal und Licht ist direkt belegt. Serializer und Kartengeometrie bilden diese gemessenen JSON-Felder in Modultests ab. Der isolierte Hostlauf für dieselbe Szene blieb nach zwei Testaufbaufehlern ohne Ergebnis: `1791203112468` traf beim Speichern zwei gleichzeitig geöffnete Karten; `1791203235548` suchte den aktiven Editor über eine im Host nicht vorhandene CSS-Klasse. Beide Läufe endeten vor dem VTT-Export. Dies ist eine Lücke im Testaufbau, kein belegter Produktfehler und keine Abnahme.

Der Raster-Exportlauf wurde getrennt erfolgreich fortgesetzt (`1791203317898` Bearbeitung, `1791203323521` Frischstart). Das VTT-Szenario ist über `DUNGEON_QA_EXPORT_VTT=1` getrennt schaltbar, nachdem seine Mehrkarten-Navigation unabhängig geprüft wurde. Der Pflichtfall bleibt offen.
