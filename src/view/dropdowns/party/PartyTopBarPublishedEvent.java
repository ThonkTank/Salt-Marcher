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
