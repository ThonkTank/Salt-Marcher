package src.view.dropdowns.party;

public record PartyRosterTopBarViewInputEvent(
        boolean createEditorRequested,
        boolean editEditorRequested,
        boolean addExistingRequested,
        long memberId,
        String memberName,
        int xpDelta,
        boolean removeRequested,
        boolean shortRestRequested,
        boolean longRestRequested,
        EditorSeed editorSeed
) {

    public PartyRosterTopBarViewInputEvent {
        memberName = memberName == null ? "" : memberName;
        editorSeed = editorSeed == null ? EditorSeed.empty() : editorSeed;
    }

    public record EditorSeed(
            long memberId,
            String memberName,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass
    ) {

        public EditorSeed {
            memberName = memberName == null ? "" : memberName;
            playerName = playerName == null ? "" : playerName;
            rawLevel = rawLevel == null ? "" : rawLevel;
            rawPassivePerception = rawPassivePerception == null ? "" : rawPassivePerception;
            rawArmorClass = rawArmorClass == null ? "" : rawArmorClass;
        }

        static EditorSeed empty() {
            return new EditorSeed(0L, "", "", "", "", "");
        }
    }
}
