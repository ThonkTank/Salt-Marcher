#!/usr/bin/env bash
# quality-loop.sh — Autonomous quality review & fix loop for dungeonmap
#
# Runs repeated cycles of:
#   1. /review-quality on the dungeonmap package
#   2. Extract concrete fix tasks
#   3. Execute each task sequentially (with compile check)
#   4. Repeat until stopped (Ctrl+C)

# No set -e — the loop must never die on transient errors
set +e

PROJECT="/home/awuster/Schreibtisch/SaltMarcher"
TARGET="src/features/world/dungeonmap"
LOG_DIR="$PROJECT/logs/quality-loop"
CYCLE=0

mkdir -p "$LOG_DIR"

echo "=== Quality Loop gestartet ==="
echo "Ziel:     $TARGET"
echo "Logs:     $LOG_DIR"
echo "Stoppen:  Ctrl+C"
echo ""

while true; do
  CYCLE=$((CYCLE + 1))
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  CYCLE_LOG="$LOG_DIR/cycle-${CYCLE}-${TIMESTAMP}.md"

  echo "────────────────────────────────────────"
  echo "Zyklus $CYCLE  ($TIMESTAMP)"
  echo "────────────────────────────────────────"

  # ── Phase 1: Review & Aufgaben formulieren ──────────────────────
  echo "[1/3] Review läuft..."

  REVIEW_OUTPUT=$(cd "$PROJECT" && claude -p \
    --output-format text \
    --model claude-opus-4-6 \
    --dangerously-skip-permissions \
    --max-turns 30 \
    "Du bist ein autonomer Quality-Review-Agent.

Aufgabe:
1. Führe ein /review-quality auf dem Verzeichnis $TARGET durch.
   Lies dazu die relevanten Dateien und analysiere den Code nach den
   Kriterien des review-quality Skills.
2. Formuliere aus den Befunden eine priorisierte Liste konkreter
   Arbeitsaufträge.

Regeln für Arbeitsaufträge:
- Jeder Auftrag muss in sich abgeschlossen sein (keine Abhängigkeiten
  untereinander)
- Jeder Auftrag muss konkret genug sein, dass ein anderer Agent ihn
  ohne Rückfragen umsetzen kann: nenne betroffene Dateien, beschreibe
  die gewünschte Zielstruktur, und erkläre was wohin verschoben/extrahiert
  werden soll
- Jeder Auftrag soll eine deutliche, spürbare Verbesserung des
  Code-Zustands bewirken
- REIHENFOLGE: Die Aufträge werden sequenziell von 1..N abgearbeitet.
  Ordne sie so, dass kein späterer Auftrag durch einen früheren
  sabotiert wird. Wenn z.B. ein Auftrag Code löscht, den ein anderer
  als Vorlage nutzen könnte, muss der nutzende Auftrag zuerst kommen.
  Destruktive Aufträge (Löschen, Entfernen) gehören ans Ende

Ausgabeformat (exakt einhalten):

REVIEW_SUMMARY:
<2-4 Sätze Zusammenfassung>

TASK 1:
<Kompletter Arbeitsauftrag>

TASK 2:
...

TASK_COUNT: <Anzahl>
" 2>&1)

  RC=$?
  echo "$REVIEW_OUTPUT" > "$CYCLE_LOG"

  if [ $RC -ne 0 ]; then
    echo "[1/3] FEHLER: Review-Agent abgestürzt (exit $RC). Retry in 30s..."
    echo "  Log: $CYCLE_LOG"
    sleep 30
    continue
  fi

  echo "[1/3] Review abgeschlossen."

  # ── Phase 2: Aufgaben parsen ────────────────────────────────────
  TASK_COUNT=$(echo "$REVIEW_OUTPUT" | grep -oP 'TASK_COUNT:\s*\K\d+' 2>/dev/null || echo "0")

  if [ "$TASK_COUNT" -eq 0 ] || [ "$TASK_COUNT" -gt 50 ]; then
    echo "[2/3] TASK_COUNT=$TASK_COUNT (ungültig oder 0). Neuer Zyklus in 15s..."
    sleep 15
    continue
  fi

  echo "[2/3] $TASK_COUNT Aufgabe(n) gefunden."

  # ── Phase 3: Aufgaben sequenziell abarbeiten ────────────────────
  for i in $(seq 1 "$TASK_COUNT"); do
    NEXT=$((i + 1))

    # Extract task block: from "TASK N:" until next "TASK M:" or "TASK_COUNT:"
    TASK_BODY=$(echo "$REVIEW_OUTPUT" | awk "
      /^TASK ${i}:/{found=1; next}
      /^TASK ${NEXT}:/{exit}
      /^TASK_COUNT:/{exit}
      found{print}
    ")

    # Trim leading/trailing whitespace
    TASK_BODY=$(echo "$TASK_BODY" | sed '/./,$!d' | sed -e :a -e '/^[[:space:]]*$/{ $d; N; ba; }')

    if [ -z "$TASK_BODY" ]; then
      echo "  [$i/$TASK_COUNT] Task leer, überspringe."
      continue
    fi

    echo "  [$i/$TASK_COUNT] Starte Umsetzung..."
    echo "  $(echo "$TASK_BODY" | head -1)"

    TASK_LOG="$LOG_DIR/cycle-${CYCLE}-task-${i}.md"

    TASK_OUTPUT=$(cd "$PROJECT" && claude -p \
      --output-format text \
      --model claude-sonnet-4-6 \
      --dangerously-skip-permissions \
      --max-turns 50 \
      "Du bist ein Code-Refactoring-Agent. Setze den folgenden Arbeitsauftrag
exakt um. Lies zuerst ALLE betroffenen Dateien gründlich, plane die
Änderungen, nimm sie vor, und kompiliere danach mit
'./gradlew build --console=plain 2>&1'.
Behebe alle Kompilierfehler, bevor du fertig bist.

Wichtig:
- Ändere NUR was der Auftrag verlangt
- Keine zusätzlichen Refactorings oder Verbesserungen
- UI-Strings bleiben Deutsch
- Code-Identifier und Kommentare bleiben Englisch
- Bei größeren Refactorings: arbeite inkrementell, kompiliere nach
  jedem größeren Schritt, und behebe Fehler sofort

Arbeitsauftrag:
$TASK_BODY
" 2>&1)

    TASK_RC=$?
    echo "$TASK_OUTPUT" > "$TASK_LOG"

    if [ $TASK_RC -ne 0 ]; then
      echo "  [$i/$TASK_COUNT] WARNUNG: Agent-Fehler (exit $TASK_RC). Weiter..."
      continue
    fi

    # Compile check
    BUILD_RESULT=$(cd "$PROJECT" && ./gradlew build --console=plain 2>&1)
    if echo "$BUILD_RESULT" | grep -q "BUILD SUCCESSFUL"; then
      echo "  [$i/$TASK_COUNT] Erledigt + kompiliert."
    else
      echo "  [$i/$TASK_COUNT] WARNUNG: Build fehlgeschlagen. Starte Fix-Versuch..."
      echo "$BUILD_RESULT" > "$LOG_DIR/cycle-${CYCLE}-task-${i}-buildfail.log"

      # One attempt to fix build errors
      FIX_OUTPUT=$(cd "$PROJECT" && claude -p \
        --output-format text \
        --model claude-sonnet-4-6 \
        --dangerously-skip-permissions \
        --max-turns 10 \
        "Der Build ist fehlgeschlagen. Hier ist die Ausgabe:

$BUILD_RESULT

Behebe die Kompilierfehler. Lies die betroffenen Dateien, fixe die Fehler,
und kompiliere erneut mit './gradlew build --console=plain 2>&1'.
Ändere nur das Nötigste um den Build zu reparieren." 2>&1)

      echo "$FIX_OUTPUT" > "$LOG_DIR/cycle-${CYCLE}-task-${i}-fix.md"

      BUILD2=$(cd "$PROJECT" && ./gradlew build --console=plain 2>&1)
      if echo "$BUILD2" | grep -q "BUILD SUCCESSFUL"; then
        echo "  [$i/$TASK_COUNT] Build repariert."
      else
        echo "  [$i/$TASK_COUNT] Build immer noch kaputt. Weiter mit nächstem Task."
      fi
    fi
  done

  echo ""
  echo "Zyklus $CYCLE abgeschlossen. Nächster Zyklus in 10s..."
  echo "(Ctrl+C zum Stoppen)"
  sleep 10
done
