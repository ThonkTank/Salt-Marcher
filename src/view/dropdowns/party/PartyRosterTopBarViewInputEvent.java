package src.view.dropdowns.party;

public record PartyRosterTopBarViewInputEvent(
        Source source,
        long memberId,
        String memberName,
        int xpDelta,
        EditorSeed editorSeed
) {

    public PartyRosterTopBarViewInputEvent {
        source = source == null ? Source.OPEN_CREATE_EDITOR : source;
        memberName = memberName == null ? "" : memberName;
        editorSeed = editorSeed == null ? EditorSeed.empty() : editorSeed;
    }

    enum Source {
        OPEN_CREATE_EDITOR,
        OPEN_EDIT_EDITOR,
        ADD_EXISTING_MEMBER,
        REMOVE_ACTIVE_MEMBER_BUTTON,
        ADJUST_XP_POPUP,
        SHORT_REST_BUTTON,
        LONG_REST_BUTTON
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
