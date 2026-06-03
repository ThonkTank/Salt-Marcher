package src.domain.dungeon.model.runtime.travel.projection;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonMapFacts;

public final class TraversalLinkProjection {

    private final src.domain.dungeon.model.worldspace.DungeonTraversalLinkProjection authoredProjection =
            new src.domain.dungeon.model.worldspace.DungeonTraversalLinkProjection();

    public List<TraversalLink> project(@Nullable DungeonMap dungeonMap, DungeonMapFacts map) {
        List<TraversalLink> result = new ArrayList<>();
        for (src.domain.dungeon.model.worldspace.DungeonTraversalLink link
                : authoredProjection.project(dungeonMap, map)) {
            result.add(toRuntime(link));
        }
        return List.copyOf(result);
    }

    private static TraversalLink toRuntime(src.domain.dungeon.model.worldspace.DungeonTraversalLink link) {
        return new TraversalLink(
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
