package src.domain.encounter.model.session;

import java.util.List;

public record CombatProjectionData(
        int currentTurnIndex,
        int round,
        String status,
        List<CombatCardData> cards,
        boolean allEnemiesDefeated
) {
    public CombatProjectionData {
        status = status == null ? "" : status;
        cards = cards == null ? List.of() : List.copyOf(cards);
    }

    public static CombatProjectionData empty() {
        return new CombatProjectionData(-1, 1, "", List.of(), false);
    }
}
