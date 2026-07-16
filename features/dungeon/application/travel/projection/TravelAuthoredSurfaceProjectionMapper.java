package features.dungeon.application.travel.projection;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.DungeonMapAuthoring;
import features.dungeon.domain.core.projection.DungeonMapFacts;
import features.dungeon.domain.core.structure.DungeonMapIdentity;

public final class TravelAuthoredSurfaceProjectionMapper {

    private TravelAuthoredSurfaceProjectionMapper() {
    }

    public static TravelAuthoredSurface from(
            @Nullable DungeonMap dungeonMap,
            @Nullable DungeonDerivedState derived
    ) {
        DungeonMap safeMap = dungeonMap == null
                ? DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Dungeon")
                : dungeonMap;
        DungeonMapFacts safeFacts = safeFacts(safeMap, derived);
        return new TravelAuthoredSurface(
                new TravelAuthoredSurface.Header(
                        safeMap.metadata().mapId().value(),
                        safeMap.metadata().mapName(),
                        safeMap.revision()),
                new TravelAuthoredSurface.Content(
                        TravelSurfaceMapProjectionMapper.toRuntimeMap(safeFacts),
                        TravelAuthoredSurfaceTransitionProjectionMapper.toTransitions(
                                safeMap.transitionCatalog().transitions()),
                        TravelAuthoredSurfaceTraversalProjectionMapper.toTraversalLinks(
                                derived == null ? null : derived.traversalLinks()),
                        TravelAuthoredSurfaceRelationProjectionMapper.toConnections(
                                derived == null ? null : derived.relations()),
                        TravelAuthoredSurfaceNarrationProjectionMapper.toRoomNarrations(safeMap.rooms().rooms())));
    }

    private static DungeonMapFacts safeFacts(DungeonMap dungeonMap, @Nullable DungeonDerivedState derived) {
        DungeonMapFacts mapFacts = derived == null ? null : derived.map();
        return mapFacts == null
                ? new DungeonMapFacts(dungeonMap.topology().topology(), 1, 1, List.of(), List.of())
                : mapFacts;
    }
}
