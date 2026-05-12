package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

final class DungeonCorridorCreationLogic {

    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonCorridorEndpointResolutionLogic ENDPOINT_RESOLUTION_SERVICE =
            new DungeonCorridorEndpointResolutionLogic();
    private static final DungeonCorridorSemanticsRules CORRIDOR_SEMANTICS_POLICY =
            new DungeonCorridorSemanticsRules();
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
        DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved =
                ENDPOINT_RESOLUTION_SERVICE.resolve(dungeonMap, start);
        if (startResolved == null) {
            return dungeonMap;
        }
        DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved =
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
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved
    ) {
        return CORRIDOR_SEMANTICS_POLICY.matchingCorridorExists(
                endResolved.map().connections().corridors(),
                startResolved.endpoint(),
                endResolved.endpoint());
    }

    private DungeonCorridor bindEndpoints(
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved,
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
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult startResolved,
            DungeonCorridorEndpointResolutionLogic.ResolvedEndpointResult endResolved
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
