package features.encounter.combat.ui;

import features.encounter.combat.service.CombatTurnGrouper;
import features.creatures.api.StatBlockRequest;

final class CombatStatBlockRequestMapper {
    private CombatStatBlockRequestMapper() {
        throw new AssertionError("No instances");
    }

    static StatBlockRequest fromTurnEntry(CombatTurnGrouper.GroupedTurnEntry entry) {
        Long creatureId = entry.creatureId();
        if (creatureId == null) {
            throw new IllegalArgumentException("creatureId must not be null");
        }
        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.MOB) {
            return StatBlockRequest.forMob(creatureId, Math.max(1, entry.monsters().size()));
        }
        return StatBlockRequest.forCreature(creatureId);
    }
}
