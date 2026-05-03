package src.view.dropdowns.party;

public record PartyEditorTopBarViewInputEvent(
        Source source,
        long memberId,
        String memberName,
        EditorDraft draft
) {

    public PartyEditorTopBarViewInputEvent {
        source = source == null ? Source.CANCEL_EDITOR : source;
        memberName = memberName == null ? "" : memberName;
        draft = draft == null ? EditorDraft.empty() : draft;
    }

    enum Source {
        CANCEL_EDITOR,
        CREATE_SUBMIT,
        UPDATE_SUBMIT,
        REQUEST_DELETE_CONFIRM,
        CANCEL_DELETE_CONFIRM,
        CONFIRM_DELETE
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
