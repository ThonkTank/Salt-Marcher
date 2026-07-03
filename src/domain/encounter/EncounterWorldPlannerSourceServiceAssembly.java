package src.domain.encounter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.generation.EncounterGenerationRequest;
import src.domain.worldplanner.published.WorldFactionInventoryLimitSummary;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

final class EncounterWorldPlannerSourceServiceAssembly {

    private static final long NO_MATCHING_TABLE_ID = -1L;
    private static final long UNRESOLVED_ID = 0L;

    private EncounterWorldPlannerSourceServiceAssembly() {
    }

    static EncounterGenerationRequest resolve(
            EncounterGenerationRequest request,
            WorldPlannerSnapshotModel snapshots
    ) {
        if (request == null || snapshots == null || !hasWorldSource(request)) {
            return request;
        }
        SourceState source = SourceState.from(request, snapshots.current());
        EncounterGenerationInputs original = request.inputs();
        EncounterGenerationInputs resolvedInputs = new EncounterGenerationInputs(
                original.creatureTypes(),
                original.creatureSubtypes(),
                original.biomes(),
                original.targetDifficulty(),
                original.tuning(),
                source.effectiveEncounterTableIds(original.encounterTableIds()),
                original.worldFactionIds(),
                original.worldLocationId(),
                source.invalid() ? Map.of() : source.finiteStockCaps());
        return new EncounterGenerationRequest(
                resolvedInputs,
                request.alternativeCount(),
                request.generationSeed(),
                request.excludedCreatureIds(),
                request.lockedCreatures());
    }

    private static boolean hasWorldSource(EncounterGenerationRequest request) {
        return request.worldLocationId() > UNRESOLVED_ID || !request.worldFactionIds().isEmpty();
    }

    private record SourceState(
            boolean invalid,
            Set<Long> encounterTableIds,
            Map<Long, Integer> finiteStockCaps
    ) {

        static SourceState from(EncounterGenerationRequest request, WorldPlannerSnapshot snapshot) {
            Map<Long, WorldFactionSummary> factions = factionsById(snapshot.factions());
            Map<Long, WorldLocationSummary> locations = locationsById(snapshot.locations());
            Set<Long> selectedFactionIds = new LinkedHashSet<>(request.worldFactionIds());
            Set<Long> sourceTableIds = new LinkedHashSet<>();
            boolean invalid = false;

            if (request.worldLocationId() > UNRESOLVED_ID) {
                WorldLocationSummary location = locations.get(request.worldLocationId());
                invalid = location == null;
                if (location != null) {
                    selectedFactionIds.addAll(location.factionIds());
                    sourceTableIds.addAll(positiveIds(location.encounterTableIds()));
                }
            }

            Map<Long, Integer> finiteCaps = new LinkedHashMap<>();
            Set<Long> unlimitedStatblocks = new LinkedHashSet<>();
            for (Long factionId : selectedFactionIds) {
                WorldFactionSummary faction = factions.get(factionId);
                invalid = invalid || faction == null;
                if (faction == null) {
                    continue;
                }
                if (faction.primaryEncounterTableId() > UNRESOLVED_ID) {
                    sourceTableIds.add(faction.primaryEncounterTableId());
                }
                applyInventoryLimits(finiteCaps, unlimitedStatblocks, faction.inventoryLimits());
            }
            for (Long unlimited : unlimitedStatblocks) {
                finiteCaps.remove(unlimited);
            }
            return new SourceState(invalid, sourceTableIds, finiteCaps);
        }

        List<Long> effectiveEncounterTableIds(List<Long> explicitTableIds) {
            if (invalid) {
                return List.of(NO_MATCHING_TABLE_ID);
            }
            Set<Long> explicit = new LinkedHashSet<>(positiveIds(explicitTableIds));
            if (encounterTableIds.isEmpty()) {
                return List.copyOf(explicit);
            }
            if (explicit.isEmpty()) {
                return List.copyOf(encounterTableIds);
            }
            explicit.retainAll(encounterTableIds);
            return explicit.isEmpty() ? List.of(NO_MATCHING_TABLE_ID) : List.copyOf(explicit);
        }
    }

    private static Map<Long, WorldFactionSummary> factionsById(List<WorldFactionSummary> factions) {
        Map<Long, WorldFactionSummary> byId = new LinkedHashMap<>();
        for (WorldFactionSummary faction : factions == null ? List.<WorldFactionSummary>of() : factions) {
            byId.put(faction.factionId(), faction);
        }
        return byId;
    }

    private static Map<Long, WorldLocationSummary> locationsById(List<WorldLocationSummary> locations) {
        Map<Long, WorldLocationSummary> byId = new LinkedHashMap<>();
        for (WorldLocationSummary location : locations == null ? List.<WorldLocationSummary>of() : locations) {
            byId.put(location.locationId(), location);
        }
        return byId;
    }

    private static void applyInventoryLimits(
            Map<Long, Integer> finiteCaps,
            Set<Long> unlimitedStatblocks,
            List<WorldFactionInventoryLimitSummary> limits
    ) {
        for (WorldFactionInventoryLimitSummary limit : limits == null
                ? List.<WorldFactionInventoryLimitSummary>of()
                : limits) {
            if (!limit.finite()) {
                unlimitedStatblocks.add(limit.creatureStatblockId());
                continue;
            }
            if (!unlimitedStatblocks.contains(limit.creatureStatblockId())) {
                addFiniteCap(finiteCaps, limit.creatureStatblockId(), limit.quantity());
            }
        }
    }

    private static void addFiniteCap(Map<Long, Integer> finiteCaps, long creatureStatblockId, int quantity) {
        Integer current = finiteCaps.get(creatureStatblockId);
        finiteCaps.put(creatureStatblockId, Integer.valueOf((current == null ? 0 : current.intValue()) + quantity));
    }

    private static List<Long> positiveIds(List<Long> ids) {
        List<Long> positive = new ArrayList<>();
        for (Long id : ids == null ? List.<Long>of() : ids) {
            if (id != null && id.longValue() > UNRESOLVED_ID) {
                positive.add(id);
            }
        }
        return List.copyOf(positive);
    }
}
