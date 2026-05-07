package src.view.statetabs.encounter;

import java.util.List;

record EncounterStateUndoRef(long token) {
    EncounterStateUndoRef {
        token = Math.max(0L, token);
    }

    boolean isResolved() {
        return token > 0L;
    }
}

record EncounterStateInitiativeEntry(String id, int initiative) {
    EncounterStateInitiativeEntry {
        id = id == null ? "" : id;
    }
}

enum EncounterStateCombatSimpleAction {
    ADVANCE_TURN,
    END_COMBAT;

    static EncounterStateCombatSimpleAction fallback(EncounterStateCombatSimpleAction action) {
        return action == null ? values()[0] : action;
    }

    boolean endsCombat() {
        return this == END_COMBAT;
    }
}

record EncounterStateHpChange(
        String combatantId,
        int amount,
        boolean healing
) {
    EncounterStateHpChange {
        combatantId = combatantId == null ? "" : combatantId;
        amount = Math.max(0, amount);
    }
}

record EncounterStateInitiativeAdjustment(
        String combatantId,
        int initiativeValue
) {
    EncounterStateInitiativeAdjustment {
        combatantId = combatantId == null ? "" : combatantId;
    }
}

record EncounterStatePartyMemberJoin(
        long partyMemberId,
        int initiativeValue
) {
    EncounterStatePartyMemberJoin {
        partyMemberId = Math.max(0L, partyMemberId);
    }

    boolean hasResolvedMemberId() {
        return partyMemberId > 0L;
    }
}

enum EncounterStateResultAction {
    BACK_TO_BUILDER,
    AWARD_XP,
    RETURN_TO_BUILDER;

    static EncounterStateResultAction fallback(EncounterStateResultAction action) {
        return action == null ? AWARD_XP : action;
    }
}

final class EncounterStateInputCopies {

    private EncounterStateInputCopies() {
    }

    static List<EncounterStateInitiativeEntry> initiatives(List<EncounterStateInitiativeEntry> initiatives) {
        return initiatives == null ? List.of() : List.copyOf(initiatives);
    }

    static boolean hasId(long candidate) {
        return candidate > 0L;
    }
}
