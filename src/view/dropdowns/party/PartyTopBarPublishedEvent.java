package src.view.dropdowns.party;

public record PartyTopBarPublishedEvent(
        Kind kind,
        long characterId,
        MembershipTarget membershipTarget,
        String name,
        String playerName,
        int level,
        int passivePerception,
        int armorClass,
        int xpDelta,
        RestAction restAction,
        String successMessage
) {

    public PartyTopBarPublishedEvent {
        java.util.Objects.requireNonNull(kind, "kind");
        membershipTarget = membershipTarget == null ? MembershipTarget.ACTIVE : membershipTarget;
        name = name == null ? "" : name;
        playerName = playerName == null ? "" : playerName;
        restAction = restAction == null ? RestAction.NONE : restAction;
        successMessage = successMessage == null ? "" : successMessage;
    }

    static PartyTopBarPublishedEvent setMembership(
            long characterId,
            MembershipTarget membershipTarget,
            String successMessage
    ) {
        return new PartyTopBarPublishedEvent(
                Kind.SET_MEMBERSHIP,
                characterId,
                membershipTarget,
                "",
                "",
                0,
                0,
                0,
                0,
                RestAction.NONE,
                successMessage);
    }

    static PartyTopBarPublishedEvent createCharacter(
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass,
            String successMessage
    ) {
        return new PartyTopBarPublishedEvent(
                Kind.CREATE_CHARACTER,
                0L,
                MembershipTarget.ACTIVE,
                name,
                playerName,
                level,
                passivePerception,
                armorClass,
                0,
                RestAction.NONE,
                successMessage);
    }

    static PartyTopBarPublishedEvent updateCharacter(
            long characterId,
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass,
            String successMessage
    ) {
        return new PartyTopBarPublishedEvent(
                Kind.UPDATE_CHARACTER,
                characterId,
                MembershipTarget.ACTIVE,
                name,
                playerName,
                level,
                passivePerception,
                armorClass,
                0,
                RestAction.NONE,
                successMessage);
    }

    static PartyTopBarPublishedEvent deleteCharacter(long characterId, String successMessage) {
        return new PartyTopBarPublishedEvent(
                Kind.DELETE_CHARACTER,
                characterId,
                MembershipTarget.ACTIVE,
                "",
                "",
                0,
                0,
                0,
                0,
                RestAction.NONE,
                successMessage);
    }

    static PartyTopBarPublishedEvent adjustXp(long characterId, int xpDelta, String successMessage) {
        return new PartyTopBarPublishedEvent(
                Kind.ADJUST_XP,
                characterId,
                MembershipTarget.ACTIVE,
                "",
                "",
                0,
                0,
                0,
                xpDelta,
                RestAction.NONE,
                successMessage);
    }

    static PartyTopBarPublishedEvent performRest(RestAction restAction, String successMessage) {
        return new PartyTopBarPublishedEvent(
                Kind.PERFORM_REST,
                0L,
                MembershipTarget.ACTIVE,
                "",
                "",
                0,
                0,
                0,
                0,
                restAction,
                successMessage);
    }

    enum Kind {
        SET_MEMBERSHIP,
        CREATE_CHARACTER,
        UPDATE_CHARACTER,
        DELETE_CHARACTER,
        ADJUST_XP,
        PERFORM_REST
    }

    enum RestAction {
        NONE,
        SHORT_REST,
        LONG_REST
    }

    enum MembershipTarget {
        ACTIVE,
        RESERVE
    }
}
