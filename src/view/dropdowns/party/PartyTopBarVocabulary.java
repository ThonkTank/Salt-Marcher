package src.view.dropdowns.party;

final class PartyTopBarVocabulary {

    static final String HEADER_TITLE = "PARTY";
    static final String EMPTY_TRIGGER_TEXT = "Keine _Party \u25bc";
    static final String CLOSE_BUTTON_TEXT = "x";
    static final String CLOSE_ACCESSIBLE_TEXT = "Party-Panel schlie\u00dfen";
    static final String ACTIVE_SECTION = "AKTUELLE PARTY";
    static final String ADD_SECTION = "CHARAKTER HINZUFUEGEN";
    static final String RESERVE_SEARCH_PROMPT = "Reserve durchsuchen";
    static final String RESERVE_SEARCH_ACCESSIBLE = "Reserve-Charaktere durchsuchen";
    static final String SHORT_REST = "Short Rest";
    static final String LONG_REST = "Long Rest";
    static final String NEW_CHARACTER = "+ Neuer Charakter";
    static final String NEW_CHARACTER_ACCESSIBLE = "+ Neuer Charakter, neuen Charakter erstellen";
    static final String STORAGE_ERROR = "Party konnte nicht geladen werden.";
    static final String EMPTY_ACTIVE = "Keine aktiven Party-Mitglieder";
    static final String NO_RESERVE = "Keine Reserve-Charaktere";
    static final String NO_RESERVE_MATCH = "Keine Treffer in der Reserve";
    static final String LOADING = "Lade...";

    private PartyTopBarVocabulary() {
    }

    static String triggerText(int activeCount, int averageLevel) {
        return activeCount == 0 ? EMPTY_TRIGGER_TEXT : activeCount + " Charaktere, \u00d8 Lv " + averageLevel + " \u25bc";
    }

    static String deleteConfirmation(String targetName) {
        return "\"" + safe(targetName).trim() + "\" wirklich dauerhaft loeschen?";
    }

    static String safe(String value) {
        return value == null ? "" : value;
    }
}
