# Kleine Werkzeuge, nur bei Bedarf

`scripts/maintain.py` braucht Python-Standardbibliothek und Git. Checkpoint und
maschineller Durchsichtstand liegen gemeinsam außerhalb der Produktarbeitskopie.
Der Helfer verändert keinen Produktcode.
`scripts/maintain.py` ist relativ zum Skillordner; außerhalb davon seinen
absoluten Pfad verwenden. `status` liefert den kurzen Kontext, nicht die ganze
Zustandsdatei laden.

```bash
python3 scripts/maintain.py --repo PRODUKT --state CHECKPOINT init
python3 scripts/maintain.py --repo PRODUKT --state CHECKPOINT status
python3 scripts/maintain.py --repo PRODUKT --state CHECKPOINT next
python3 scripts/maintain.py --repo PRODUKT --state CHECKPOINT start --goal 'Konkretes vollständiges Ergebnis' --paths PFAD
python3 scripts/maintain.py --repo PRODUKT --state CHECKPOINT checkpoint --phase check --next 'Verbleibende Prüfung'
python3 scripts/maintain.py --repo PRODUKT --state CHECKPOINT mark --path PFAD --decision keep --reason 'Konkrete Leseraufgabe'
python3 scripts/maintain.py --repo PRODUKT --state CHECKPOINT finish --outcome complete --published SHA --evidence 'Prüfbeleg und Verständnisverbesserung'
```

`next` liefert nur Metadaten nächster ungeprüfter Dateien im Modus; `--prefix`
begrenzt auf den gewählten Bereich. Große Dateien mit `mark --through ZEILE`
abschnittsweise verfolgen. Erst am tatsächlichen Ende ohne `--through` fertig
markieren. Nach Commit der geprüften Bytes markieren; geänderte Blobs werden
wieder offen. Bei geänderter fachlicher Beziehung mit `forget --path` neu öffnen.
Entfernte Dateien nur aus vorher belegten aktiven Pfaden als `remove` markieren.

`finish --outcome no-work --evidence 'Belegter fehlender Bedarf'` schaltet ohne
künstlichen Commit weiter. Aktive ungeprüfte Änderungen nicht so abschließen.
Externe Blockade mit `park --reason` offen halten; unabhängige Arbeit bleibt
möglich. Mit `resume --index` im passenden Modus wiederaufnehmen. Der Helfer
bestätigt weder CI noch Qualität selbst; passende Belege bleiben nötig.

`chat-mark --thread ID --item MARKE` merkt die letzte tatsächlich ausgewertete
Stelle. `progress --through SHA` setzt im Aktualitätsmodus den Git-Abgleichsstand
nur nach vollständiger Beurteilung aller Änderungen bis zu diesem SHA weiter.
Ein fertiggestellter Teilauftrag verschiebt diese Marke nicht automatisch.
Ein im Lauf beobachteter Bedarf für einen anderen Modus bleibt mit
`note --mode MODUS --question 'Konkrete Frage' --source 'Chat-/Item-/Quellmarke'`
erhalten. `status` zeigt nur die ersten fünf Hinweise des aktuellen Modus.
`start --from-note INDEX` übernimmt einen solchen Hinweis in die aktive Aufgabe;
Unterbrechung und Blockade verlieren ihn nicht. Erst nach gesichertem Hinweis
die gelesene Chatstelle weitersetzen. Kein vorab erzeugter Fragenkatalog.

## Zeichen zählen, keine Inhalte ausgeben

Bereits bekannte Pfade/Zeilengrenzen derselben Frage verwenden:

```bash
python3 scripts/maintain.py --repo PRODUKT count --rev SHA --doc 'docs/ATLAS.md#L1-L15' --code 'src/app/atlas.ts#L20-L65'
```

`--doc`/`--code` wiederholbar; ohne Zeilengrenze zählt die ganze Datei.
UTF-8-Zeichen einschließlich Leerraum zählen, überlappende Ausschnitte je Seite
einmal. Beide Seiten nutzen denselben Commit. Nötige Navigation, Suche und
verbleibenden Code mitrechnen. Bereits vorhandene Suchausgaben über
`--doc-search DATEI`/`--code-search DATEI` zählen. Kein Chatkommando nachspielen,
keinen künstlich großen Codepfad konstruieren. Dokupfad länger: kürzen, besser
erschließen oder direkt auf die Quelle führen. Ohne bekannten vergleichbaren
Codepfad keine Messung erzwingen. Anforderungen/Gründe/Originalbelege können ohne
Codeantwort nötig sein. Zählung beweist weder Richtigkeit noch exakte Tokenkosten.

## Entwurfsgrundlage, keine Pflichtlektüre

[Diátaxis](https://diataxis.fr/compass/),
[GitLabs Dokumenttypen](https://docs.gitlab.com/development/documentation/topic_types/),
[Google Engineering Practices](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
und [bedarfsgerecht geladene Skills](https://learn.chatgpt.com/docs/build-skills).
