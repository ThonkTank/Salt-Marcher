package src.domain.encounter.model.session.model;

import java.util.List;

final class EncounterSessionCreatureRows {

    private static final String MANUAL_CREATURE_ROLE = "Manual";
    private static final String SAVED_PLAN_CREATURE_ROLE = "Saved";

    private EncounterSessionCreatureRows() {
    }

    static EncounterCreatureData manual(CreatureDetailData detail, int quantity) {
        return fromDetail(detail, quantity, MANUAL_CREATURE_ROLE);
    }

    static EncounterCreatureData savedPlan(CreatureDetailData detail, int quantity) {
        return fromDetail(detail, quantity, SAVED_PLAN_CREATURE_ROLE);
    }

    private static EncounterCreatureData fromDetail(CreatureDetailData detail, int quantity, String role) {
        return new EncounterCreatureData(
                "monster-" + detail.id(),
                detail.id(),
                detail.name(),
                detail.challengeRating(),
                detail.xp(),
                Math.max(1, detail.hitPoints()),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.creatureType(),
                role,
                quantity,
                List.of());
    }
}
