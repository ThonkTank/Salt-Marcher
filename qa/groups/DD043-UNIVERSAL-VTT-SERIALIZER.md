# DD-043.22: isolierter Universal-VTT-0.3-Serializer

Originalbeleg: `/home/aaron/.cache/dungeon-native-qa/audit-20261004/karten-verwaltung/dd044-native-20261005-004931/evidence/dd044-export.dd2vtt`, SHA-256 `9cb165de5ac4d2964521a4b764b50b13e64d54f253d59b2c65175eb989d1a571`.

Der direkte Export aus Dungeondraft 1.2.0.1 enthält `format: 0.3`, Ursprung `(0,0)`, `map_size: (8,8)`, 256 Pixel je Feld, leere Sichtlinien-/Objektsichtlinien-/Portal-/Lichtlisten, `baked_lighting: true`, `ambient_light: "ffffffff"` und die PNG-Daten als reinen Base64-String. Das PNG misst 2048 × 2048 Pixel. Die neue Funktion `serializeUniversalVtt03` nimmt das bereits gerenderte PNG als Data-URL entgegen und bildet diesen JSON-Rahmen deterministisch nach. Ein Struktur- und Bilddatenvergleich gegen den Originalexport bestand.

**Offene Originalwirkung:** Die native Datenform, Einheiten und Reihenfolge nichtleerer Sichtlinien, Objektsichtlinien, Portale und Lichter sind aus dieser Datei nicht ableitbar. Die Funktion weist solche Eingaben ausdrücklich zurück. Ebenso sind verschobener `map_origin`, andere Werte für `baked_lighting` und die Kanalbedeutung von `ambient_light` nicht durch diese Probe bestimmt. Der Serializer ist deshalb ein belegtes Teilstück von DD-043.22, keine volle Exportabnahme.

Integration: Ein Aufrufer liefert gerenderte PNG-Data-URL, Feldzahl, Feldpixel, vier strukturierte Listen und den achtstelligen Umgebungswert. Der Renderer und der Dateidialog bleiben getrennt. Vor Anbindung eines Kartenzustands mit nichtleeren Geometrie-/Lichtlisten sind weitere Originalexports erforderlich.
