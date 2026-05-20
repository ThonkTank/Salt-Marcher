package src.view.dropdowns.party;

public record PartyEditorTopBarViewInputEvent(
        boolean cancelRequested,
        boolean submitRequested,
        boolean deleteConfirmationRequested,
        boolean deleteConfirmationCancelled,
        boolean deleteConfirmed,
        EditorDraft draft
) {

    public PartyEditorTopBarViewInputEvent {
        draft = draft == null ? new EditorDraft("", "", "", "", "") : draft;
    }

    public record EditorDraft(
            String name,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass
    ) {

        public EditorDraft {
            name = name == null ? "" : name;
            playerName = playerName == null ? "" : playerName;
            rawLevel = rawLevel == null ? "" : rawLevel;
            rawPassivePerception = rawPassivePerception == null ? "" : rawPassivePerception;
            rawArmorClass = rawArmorClass == null ? "" : rawArmorClass;
        }

    }
}
