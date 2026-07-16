package features.worldplanner.application;

import features.worldplanner.domain.world.WorldPlannerState;
import features.worldplanner.api.WorldFactionInventoryLimitSummary;
import features.worldplanner.api.WorldFactionSummary;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcLifecycleStatus;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;

public final class WorldPlannerSnapshotProjection {

    public static WorldPlannerSnapshot from(WorldPlannerState state) {
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
