package src.domain.encounter.model.session;

import java.util.List;

final class EncounterSessionCreatureRows {

    private static final String MANUAL_CREATURE_ROLE = "Manual";
    private static final String SAVED_PLAN_CREATURE_ROLE = "Saved";

    private EncounterSessionCreatureRows() {
    }

    static EncounterCreatureData manual(CreatureDetailData detail, int quantity) {
        return fromDetail(detail, 0L, quantity, MANUAL_CREATURE_ROLE);
    }

    static EncounterCreatureData worldNpc(CreatureDetailData detail, long worldNpcId) {
        return fromDetail(detail, worldNpcId, 1, MANUAL_CREATURE_ROLE);
    }

    static EncounterCreatureData savedPlan(CreatureDetailData detail, int quantity) {
        return fromDetail(detail, 0L, quantity, SAVED_PLAN_CREATURE_ROLE);
    }

    private static EncounterCreatureData fromDetail(CreatureDetailData detail, long worldNpcId, int quantity, String role) {
        return new EncounterCreatureData(
                worldNpcId > 0L ? "world-npc-" + worldNpcId : "monster-" + detail.id(),
                detail.id(),
                worldNpcId,
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
