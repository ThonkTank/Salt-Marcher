package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.policy.DungeonCorridorSemanticsPolicy;
import src.domain.dungeon.map.value.ConnectionCatalog;
import src.domain.dungeon.map.value.DungeonCorridorBindings;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;

final class DungeonCorridorCreationService {

    private static final DungeonCorridorConnectionNormalizationService CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationService();
    private static final DungeonCorridorEndpointResolutionService ENDPOINT_RESOLUTION_SERVICE =
            new DungeonCorridorEndpointResolutionService();
    private static final DungeonCorridorSemanticsPolicy CORRIDOR_SEMANTICS_POLICY =
            new DungeonCorridorSemanticsPolicy();
    private static final DungeonCorridorMutationRules MUTATION_RULES = new DungeonCorridorMutationRules();

    DungeonMap createCorridor(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        Objects.requireNonNull(dungeonMap, "dungeonMap");
        if (!validCreateEndpoints(start, end) || MUTATION_RULES.sameClusterOnly(dungeonMap, start, end)) {
            return dungeonMap;
        }
        DungeonCorridorEndpointResolutionService.ResolvedEndpointResult startResolved =
                ENDPOINT_RESOLUTION_SERVICE.resolve(dungeonMap, start);
        if (startResolved == null) {
            return dungeonMap;
        }
        DungeonCorridorEndpointResolutionService.ResolvedEndpointResult endResolved =
                ENDPOINT_RESOLUTION_SERVICE.resolve(startResolved.map(), end);
        if (endResolved == null || CORRIDOR_SEMANTICS_POLICY.sameEndpoint(startResolved.endpoint(), endResolved.endpoint())) {
            return dungeonMap;
        }
        if (corridorAlreadyExists(endResolved, startResolved)) {
            return dungeonMap;
        }
        DungeonCorridor corridor = bindEndpoints(startResolved, endResolved, start.level());
        List<DungeonCorridor> nextCorridors = new ArrayList<>(endResolved.map().connections().corridors());
        nextCorridors.add(corridor);
        return CONNECTION_NORMALIZATION_SERVICE.copyWithConnections(
                endResolved.map(),
                new ConnectionCatalog(
                        List.copyOf(nextCorridors),
                        endResolved.map().connections().stairs(),
                        endResolved.map().connections().transitions()));
    }

    private boolean validCreateEndpoints(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        return start != null && end != null && start.present() && end.present() && start.sameLevelAs(end);
    }

    private boolean corridorAlreadyExists(
            DungeonCorridorEndpointResolutionService.ResolvedEndpointResult endResolved,
            DungeonCorridorEndpointResolutionService.ResolvedEndpointResult startResolved
    ) {
        return CORRIDOR_SEMANTICS_POLICY.matchingCorridorExists(
                endResolved.map().connections().corridors(),
                startResolved.endpoint(),
                endResolved.endpoint());
    }

    private DungeonCorridor bindEndpoints(
            DungeonCorridorEndpointResolutionService.ResolvedEndpointResult startResolved,
            DungeonCorridorEndpointResolutionService.ResolvedEndpointResult endResolved,
            int level
    ) {
        DungeonCorridor corridor = new DungeonCorridor(
                MUTATION_RULES.nextCorridorId(endResolved.map()),
                endResolved.map().metadata().mapId().value(),
                level,
                roomIds(startResolved, endResolved),
                DungeonCorridorBindings.empty());
        corridor = startResolved.endpoint().applyTo(corridor);
        return endResolved.endpoint().applyTo(corridor);
    }

    private List<Long> roomIds(
            DungeonCorridorEndpointResolutionService.ResolvedEndpointResult startResolved,
            DungeonCorridorEndpointResolutionService.ResolvedEndpointResult endResolved
    ) {
        List<Long> roomIds = new ArrayList<>();
        addRoomId(roomIds, startResolved.endpoint().roomId());
        addRoomId(roomIds, endResolved.endpoint().roomId());
        return List.copyOf(roomIds);
    }

    private void addRoomId(List<Long> roomIds, @Nullable Long roomId) {
        if (roomId != null && MUTATION_RULES.hasPersistedRoomId(roomId) && !roomIds.contains(roomId)) {
            roomIds.add(roomId);
        }
    }
}
