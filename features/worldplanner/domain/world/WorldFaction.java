package features.worldplanner.domain.world;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public record WorldFaction(
        long factionId,
        String displayName,
        String notes,
        long primaryEncounterTableId,
        List<Long> npcIds,
        List<WorldFactionInventoryLimit> inventoryLimits
) {
    public WorldFaction {
        if (!WorldPlannerIds.isPositive(factionId)) {
            throw new IllegalArgumentException("factionId must be positive");
        }
        if (!WorldPlannerIds.isPositive(primaryEncounterTableId)) {
            throw new IllegalArgumentException("primaryEncounterTableId must be positive");
        }
        displayName = WorldNpc.normalize(displayName, "Faction #" + factionId);
        notes = WorldNpc.text(notes);
        npcIds = WorldPlannerIds.normalize(npcIds);
        inventoryLimits = normalizeInventoryLimits(inventoryLimits);
    }

    @Override
    public List<Long> npcIds() {
        return List.copyOf(npcIds);
    }

    @Override
    public List<WorldFactionInventoryLimit> inventoryLimits() {
        return List.copyOf(inventoryLimits);
    }

    public WorldFaction addNpc(long npcId) {
        if (!WorldPlannerIds.isPositive(npcId)) {
            throw new IllegalArgumentException("npcId must be positive");
        }
        if (npcIds.contains(npcId)) {
            throw new IllegalArgumentException("npcId already linked");
        }
        return new WorldFaction(
                factionId,
                displayName,
                notes,
                primaryEncounterTableId,
                WorldPlannerIds.addUnique(npcIds, npcId),
                inventoryLimits);
    }

    public WorldFaction setInventoryLimit(WorldFactionInventoryLimit limit) {
        WorldFactionInventoryLimit safeLimit = Objects.requireNonNull(limit, "limit");
        List<WorldFactionInventoryLimit> nextLimits = new ArrayList<>();
        for (WorldFactionInventoryLimit existing : inventoryLimits) {
            if (existing.creatureStatblockId() != safeLimit.creatureStatblockId()) {
                nextLimits.add(existing);
            }
        }
        nextLimits.add(safeLimit);
        return new WorldFaction(
                factionId,
                displayName,
                notes,
                primaryEncounterTableId,
                npcIds,
                nextLimits);
    }

    private static List<WorldFactionInventoryLimit> normalizeInventoryLimits(
            List<WorldFactionInventoryLimit> inventoryLimits
    ) {
        if (inventoryLimits == null) {
            return List.of();
        }
        List<WorldFactionInventoryLimit> normalizedLimits = new ArrayList<>();
        for (WorldFactionInventoryLimit limit : inventoryLimits) {
            WorldFactionInventoryLimit safeLimit = Objects.requireNonNull(limit, "limit");
            boolean duplicate = normalizedLimits.stream()
                    .anyMatch(existing -> existing.creatureStatblockId() == safeLimit.creatureStatblockId());
            if (duplicate) {
                throw new IllegalArgumentException("inventory limits must be unique");
            }
            normalizedLimits.add(safeLimit);
        }
        return List.copyOf(normalizedLimits);
    }
}
