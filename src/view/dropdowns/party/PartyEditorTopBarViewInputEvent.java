package src.view.dropdowns.party;

public record PartyEditorTopBarViewInputEvent(
        boolean cancelRequested,
        boolean submitRequested,
        boolean deleteConfirmationRequested,
        boolean deleteConfirmationCancelled,
        boolean deleteConfirmed,
        boolean editingExisting,
        long memberId,
        String memberName,
        EditorDraft draft
) {

    public PartyEditorTopBarViewInputEvent {
        memberName = memberName == null ? "" : memberName;
        draft = draft == null ? EditorDraft.empty() : draft;
    }

    public record EditorDraft(
            long id,
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

        static EditorDraft empty() {
            return new EditorDraft(0L, "", "", "", "", "");
        }
    }
}
