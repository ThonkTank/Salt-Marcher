package src.domain.encounter.model.session;

import java.util.List;

public record CombatTurnEntry(
        String id,
        String name,
        boolean playerCharacter,
        boolean alive,
        int currentHp,
        int maxHp,
        int ac,
        int initiative,
        int count,
        String detail,
        int order,
        List<String> memberIds
) {
    public CombatTurnEntry {
        memberIds = memberIds == null ? List.of() : List.copyOf(memberIds);
    }

    public CombatCardData toCardData(boolean active) {
        return new CombatCardData(
                id,
                name,
                playerCharacter,
                active,
                alive,
                currentHp,
                maxHp,
                ac,
                initiative,
                count,
                detail);
    }

    public static int compareByTurnOrder(CombatTurnEntry left, CombatTurnEntry right) {
        int byInitiative = Integer.compare(right.initiative(), left.initiative());
        if (byInitiative != 0) {
            return byInitiative;
        }
        int byKind = Boolean.compare(!left.playerCharacter(), !right.playerCharacter());
        return byKind != 0 ? byKind : Integer.compare(left.order(), right.order());
    }
}
