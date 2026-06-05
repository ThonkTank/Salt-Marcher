package src.domain.dungeon.model.runtime.travel.projection;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.core.projection.DungeonMapFacts;
import src.domain.dungeon.model.worldspace.DungeonTraversalLink;

final class TravelAuthoredSurfaceTraversalProjectionMapper {

    private TravelAuthoredSurfaceTraversalProjectionMapper() {
    }

    static List<TravelAuthoredSurface.TraversalLinkInput> toTraversalLinks(
            DungeonMap dungeonMap,
            DungeonMapFacts mapFacts
    ) {
        List<TravelAuthoredSurface.TraversalLinkInput> result = new ArrayList<>();
        for (DungeonTraversalLink link
                : new src.domain.dungeon.model.worldspace.DungeonTraversalLinkProjection().project(dungeonMap, mapFacts)) {
            if (link != null) {
                result.add(toTraversalLink(link));
            }
        }
        return List.copyOf(result);
    }

    private static TravelAuthoredSurface.TraversalLinkInput toTraversalLink(DungeonTraversalLink link) {
        return new TravelAuthoredSurface.TraversalLinkInput(
                link.key(),
                new TraversalSource(
                        TraversalSourceKind.valueOf(link.source().kind().name()),
                        link.source().id(),
                        link.source().label()),
                new TraversalEndpoint(
                        TravelGeometryProjectionMapper.toCoreCell(link.firstEndpoint().tile()),
                        link.firstEndpoint().areaId(),
                        link.firstEndpoint().areaLabel()),
                new TraversalEndpoint(
                        TravelGeometryProjectionMapper.toCoreCell(link.secondEndpoint().tile()),
                        link.secondEndpoint().areaId(),
                        link.secondEndpoint().areaLabel()));
    }
}
