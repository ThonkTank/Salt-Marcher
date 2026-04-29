package src.view.dropdowns.party;

public record PartyTopBarViewInputEvent(
        Kind kind,
        long memberId,
        String memberName,
        int xpDelta,
        EditorDraft draft
) {

    public PartyTopBarViewInputEvent {
        kind = kind == null ? Kind.OPENED : kind;
        memberName = memberName == null ? "" : memberName;
        draft = draft == null ? EditorDraft.empty() : draft;
    }

    static PartyTopBarViewInputEvent opened() {
        return new PartyTopBarViewInputEvent(Kind.OPENED, 0L, "", 0, EditorDraft.empty());
    }

    static PartyTopBarViewInputEvent addExisting(long memberId, String memberName) {
        return new PartyTopBarViewInputEvent(Kind.ADD_EXISTING, memberId, memberName, 0, EditorDraft.empty());
    }

    static PartyTopBarViewInputEvent removeFromParty(long memberId, String memberName) {
        return new PartyTopBarViewInputEvent(Kind.REMOVE_FROM_PARTY, memberId, memberName, 0, EditorDraft.empty());
    }

    static PartyTopBarViewInputEvent adjustXp(long memberId, String memberName, int xpDelta) {
        return new PartyTopBarViewInputEvent(Kind.ADJUST_XP, memberId, memberName, xpDelta, EditorDraft.empty());
    }

    static PartyTopBarViewInputEvent shortRest() {
        return new PartyTopBarViewInputEvent(Kind.SHORT_REST, 0L, "", 0, EditorDraft.empty());
    }

    static PartyTopBarViewInputEvent longRest() {
        return new PartyTopBarViewInputEvent(Kind.LONG_REST, 0L, "", 0, EditorDraft.empty());
    }

    static PartyTopBarViewInputEvent createCharacter(EditorDraft draft) {
        return new PartyTopBarViewInputEvent(Kind.CREATE_CHARACTER, 0L, "", 0, draft);
    }

    static PartyTopBarViewInputEvent updateCharacter(EditorDraft draft) {
        return new PartyTopBarViewInputEvent(
                Kind.UPDATE_CHARACTER,
                draft == null ? 0L : draft.id(),
                "",
                0,
                draft);
    }

    static PartyTopBarViewInputEvent deleteCharacter(long memberId, String memberName) {
        return new PartyTopBarViewInputEvent(Kind.DELETE_CHARACTER, memberId, memberName, 0, EditorDraft.empty());
    }

    enum Kind {
        OPENED,
        ADD_EXISTING,
        REMOVE_FROM_PARTY,
        ADJUST_XP,
        SHORT_REST,
        LONG_REST,
        CREATE_CHARACTER,
        UPDATE_CHARACTER,
        DELETE_CHARACTER
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
