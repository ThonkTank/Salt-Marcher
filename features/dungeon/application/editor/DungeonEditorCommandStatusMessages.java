package features.dungeon.application.editor;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;

/** Maps stable command meaning to presentation text without parsing domain feedback. */
final class DungeonEditorCommandStatusMessages {
    private DungeonEditorCommandStatusMessages() {
    }

    static String message(DungeonEditorCommandOutcome outcome) {
        if (outcome instanceof DungeonEditorCommandOutcome.Accepted) {
            return "Aenderung gespeichert.";
        }
        if (outcome instanceof DungeonEditorCommandOutcome.Rejected rejected) {
            return switch (rejected.reason()) {
                case BLOCKED_ROUTE -> "Korridorroute blockiert.";
                case PROTECTED_EXTERIOR_WALL -> "Cluster-Aussenwand kann nicht geloescht werden.";
                case REFERENCED_CONNECTION -> "Verknuepfte Verbindung kann nicht geloescht werden.";
                case INVALID_STAIR_GEOMETRY -> "Treppengeometrie ungueltig.";
                case STALE_REVISION -> "Eingabe verworfen: Editor-Stand ist veraltet.";
                case INSUFFICIENT_LOADED_CLOSURE ->
                        "Die benoetigten Dungeon-Daten konnten nicht vollstaendig geladen werden.";
                case MISSING_TRANSITION_DESTINATION -> "Uebergangsziel fehlt oder ist ungueltig.";
                case INVALID_TARGET -> "Bearbeitungsziel ist ungueltig.";
                case NO_EFFECT -> "Der Befehl hat keine Aenderung erzeugt.";
            };
        }
        return "";
    }
}
