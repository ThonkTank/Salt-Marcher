package features.party.adapter.javafx.party;

final class PartyTopBarVocabulary {

    static final String HEADER_TITLE = "PARTY";
    static final String EMPTY_TRIGGER_TEXT = "Keine _Party \u25bc";
    static final String CLOSE_BUTTON_TEXT = "x";
    static final String CLOSE_ACCESSIBLE_TEXT = "Party-Panel schlie\u00dfen";
    static final String ACTIVE_SECTION = "AKTUELLE PARTY";
    static final String ROSTER_SECTION = "CHARAKTER-ROSTER";
    static final String ROSTER_SEARCH_PROMPT = "Roster durchsuchen";
    static final String ROSTER_SEARCH_ACCESSIBLE = "Charakter-Roster nach Name oder ID durchsuchen";
    static final String SHORT_REST = "Short Rest";
    static final String LONG_REST = "Long Rest";
    static final String NEW_ROSTER_CHARACTER = "+ Roster-Charakter";
    static final String NEW_ROSTER_CHARACTER_ACCESSIBLE =
            "+ Roster-Charakter, neuen Charakter ohne Party-Mitgliedschaft erstellen";
    static final String STORAGE_ERROR = "Party konnte nicht geladen werden.";
    static final String EMPTY_ACTIVE = "Keine aktiven Party-Mitglieder";
    static final String EMPTY_ROSTER = "Noch keine Charaktere im Roster";
    static final String NO_ROSTER_MATCH = "Keine Treffer im Roster";
    static final String LOADING = "Lade...";

    private PartyTopBarVocabulary() {
    }

    static String triggerText(int activeCount, Integer averageLevel) {
        if (activeCount == 0) {
            return EMPTY_TRIGGER_TEXT;
        }
        return averageLevel == null
                ? activeCount + " Charaktere \u25bc"
                : activeCount + " Charaktere, \u00d8 Lv " + averageLevel + " \u25bc";
    }

    static String deleteConfirmation(String targetName) {
        return "\"" + safe(targetName).trim() + "\" wirklich dauerhaft loeschen?";
    }

    static String rosterId(long memberId) {
        return "Roster-ID " + Math.max(0L, memberId);
    }

    static String editorTitle(boolean editingExisting, long memberId) {
        return editingExisting
                ? "Roster-Charakter bearbeiten · " + rosterId(memberId)
                : "Neuer Roster-Charakter";
    }

    static String savedRosterCharacter(
            long memberId,
            String name,
            String playerName,
            Integer level,
            Integer passivePerception,
            Integer armorClass
    ) {
        return rosterId(memberId) + " (" + safe(name).trim() + ") wurde gespeichert. "
                + "Spieler: " + optionalText(playerName) + " · "
                + "Level: " + optionalText(level) + " · "
                + "PP: " + optionalText(passivePerception) + " · "
                + "AC: " + optionalText(armorClass) + ".";
    }

    static String safe(String value) {
        return value == null ? "" : value;
    }

    private static String optionalText(String value) {
        String safeValue = safe(value).trim();
        return safeValue.isBlank() ? "—" : safeValue;
    }

    private static String optionalText(Integer value) {
        return value == null ? "—" : Integer.toString(value);
    }
}
