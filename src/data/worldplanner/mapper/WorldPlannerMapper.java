package src.data.worldplanner.mapper;

import src.data.worldplanner.model.WorldFactionInventoryLimitRecord;
import src.data.worldplanner.model.WorldFactionRecord;
import src.data.worldplanner.model.WorldLocationRecord;
import src.data.worldplanner.model.WorldNpcRecord;
import src.data.worldplanner.model.WorldPlannerSnapshotRecord;
import src.domain.worldplanner.model.world.WorldFaction;
import src.domain.worldplanner.model.world.WorldFactionInventoryLimit;
import src.domain.worldplanner.model.world.WorldLocation;
import src.domain.worldplanner.model.world.WorldNpc;
import src.domain.worldplanner.model.world.WorldNpcLifecycleState;
import src.domain.worldplanner.model.world.WorldPlannerState;

public final class WorldPlannerMapper {

    public static WorldPlannerState toDomain(WorldPlannerSnapshotRecord snapshot) {
        try {
            return toDomainRecord(snapshot);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("World Planner persistence record is malformed.", exception);
        }
    }

    private static WorldPlannerState toDomainRecord(WorldPlannerSnapshotRecord snapshot) {
        if (snapshot == null) {
            return WorldPlannerState.empty();
        }
        var npcs = snapshot.npcs().stream()
                .map(WorldPlannerMapper::toDomain)
                .toList();
        var factions = snapshot.factions().stream()
                .map(WorldPlannerMapper::toDomain)
                .toList();
        var locations = snapshot.locations().stream()
                .map(WorldPlannerMapper::toDomain)
                .toList();
        long nextNpcId = npcs.stream().mapToLong(WorldNpc::npcId).max().orElse(0L) + 1L;
        long nextFactionId = factions.stream().mapToLong(WorldFaction::factionId).max().orElse(0L) + 1L;
        long nextLocationId = locations.stream().mapToLong(WorldLocation::locationId).max().orElse(0L) + 1L;
        return new WorldPlannerState(npcs, factions, locations, nextNpcId, nextFactionId, nextLocationId, "");
    }

    public static WorldPlannerSnapshotRecord toRecord(WorldPlannerState state) {
        WorldPlannerState safeState = state == null ? WorldPlannerState.empty() : state;
        return new WorldPlannerSnapshotRecord(
                safeState.npcs().stream().map(WorldPlannerMapper::toRecord).toList(),
                safeState.factions().stream().map(WorldPlannerMapper::toRecord).toList(),
                safeState.locations().stream().map(WorldPlannerMapper::toRecord).toList());
    }

    private static WorldNpc toDomain(WorldNpcRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("npc record must be present");
        }
        return new WorldNpc(
                record.npcId(),
                record.displayName(),
                record.creatureStatblockId(),
                record.appearanceNotes(),
                record.behaviorNotes(),
                record.historyNotes(),
                record.generalNotes(),
                record.dispositionModifier(),
                toStatus(record.status()));
    }

    private static WorldFaction toDomain(WorldFactionRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("faction record must be present");
        }
        return new WorldFaction(
                record.factionId(),
                record.displayName(),
                record.notes(),
                record.primaryEncounterTableId(),
                record.disposition(),
                record.npcIds(),
                record.inventoryLimits().stream()
                        .map(limit -> new WorldFactionInventoryLimit(
                                limit.creatureStatblockId(),
                                limit.finite(),
                                limit.quantity()))
                        .toList());
    }

    private static WorldLocation toDomain(WorldLocationRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("location record must be present");
        }
        return new WorldLocation(
                record.locationId(),
                record.displayName(),
                record.notes(),
                record.factionIds(),
                record.encounterTableIds());
    }

    private static WorldNpcRecord toRecord(WorldNpc npc) {
        return new WorldNpcRecord(
                npc.npcId(),
                npc.displayName(),
                npc.creatureStatblockId(),
                npc.appearanceNotes(),
                npc.behaviorNotes(),
                npc.historyNotes(),
                npc.generalNotes(),
                npc.dispositionModifier(),
                npc.status().name());
    }

    private static WorldFactionRecord toRecord(WorldFaction faction) {
        if (faction == null) {
            throw new IllegalArgumentException("faction must be present");
        }
        return new WorldFactionRecord(
                faction.factionId(),
                faction.displayName(),
                faction.notes(),
                faction.primaryEncounterTableId(),
                faction.disposition(),
                faction.npcIds(),
                faction.inventoryLimits().stream()
                        .map(limit -> new WorldFactionInventoryLimitRecord(
                                limit.creatureStatblockId(),
                                limit.finite(),
                                limit.quantity()))
                        .toList());
    }

    private static WorldLocationRecord toRecord(WorldLocation location) {
        return new WorldLocationRecord(
                location.locationId(),
                location.displayName(),
                location.notes(),
                location.factionIds(),
                location.encounterTableIds());
    }

    private static WorldNpcLifecycleState toStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException("npc status must be present");
        }
        try {
            return WorldNpcLifecycleState.valueOf(status);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("npc status must be valid", exception);
        }
    }

    private WorldPlannerMapper() {
    }
}
