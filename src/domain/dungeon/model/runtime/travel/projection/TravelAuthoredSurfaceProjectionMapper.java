package src.domain.dungeon.model.runtime.travel.projection;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonMapAuthoring;
import src.domain.dungeon.model.core.projection.DungeonMapFacts;
import src.domain.dungeon.model.worldspace.DungeonMapIdentity;

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
                        TravelAuthoredSurfaceTransitionProjectionMapper.toTransitions(safeMap.connections().transitions()),
                        TravelAuthoredSurfaceTraversalProjectionMapper.toTraversalLinks(safeMap, safeFacts),
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
