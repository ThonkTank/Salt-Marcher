package src.domain.worldplanner;

import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.published.WorldFactionInventoryLimitSummary;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldNpcSummary;
import src.domain.worldplanner.published.WorldPlannerReadStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;

final class WorldPlannerSnapshotProjection {

    static WorldPlannerSnapshot from(WorldPlannerState state) {
        WorldPlannerState safeState = state == null ? WorldPlannerState.empty() : state;
        return new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                safeState.npcs().stream()
                        .map(npc -> new WorldNpcSummary(
                                npc.npcId(),
                                npc.displayName(),
                                npc.creatureStatblockId(),
                                npc.appearanceNotes(),
                                npc.behaviorNotes(),
                                npc.historyNotes(),
                                npc.generalNotes(),
                                WorldNpcLifecycleStatus.fromName(npc.status().name())))
                        .toList(),
                safeState.factions().stream()
                        .map(faction -> new WorldFactionSummary(
                                faction.factionId(),
                                faction.displayName(),
                                faction.notes(),
                                faction.primaryEncounterTableId(),
                                faction.npcIds(),
                                faction.inventoryLimits().stream()
                                        .map(limit -> new WorldFactionInventoryLimitSummary(
                                                limit.creatureStatblockId(),
                                                limit.finite(),
                                                limit.quantity()))
                                        .toList()))
                        .toList(),
                safeState.locations().stream()
                        .map(location -> new WorldLocationSummary(
                                location.locationId(),
                                location.displayName(),
                                location.notes(),
                                location.factionIds(),
                                location.encounterTableIds()))
                        .toList(),
                safeState.statusText());
    }

    private WorldPlannerSnapshotProjection() {
    }
}
