package src.domain.dungeon.model.runtime.travel.projection;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.graph.DungeonTraversalLink;
import src.domain.dungeon.model.core.graph.DungeonTraversalSourceKind;

final class TravelAuthoredSurfaceTraversalProjectionMapper {

    private TravelAuthoredSurfaceTraversalProjectionMapper() {
    }

    static List<TravelAuthoredSurface.TraversalLinkInput> toTraversalLinks(
            List<DungeonTraversalLink> traversalLinks
    ) {
        List<TravelAuthoredSurface.TraversalLinkInput> result = new ArrayList<>();
        for (DungeonTraversalLink link : traversalLinks == null ? List.<DungeonTraversalLink>of() : traversalLinks) {
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
                        toRuntimeSourceKind(link.source().kind()),
                        link.source().id(),
                        link.source().label()),
                new TraversalEndpoint(
                        TravelGeometryProjectionMapper.cellOrOrigin(link.firstEndpoint().tile()),
                        link.firstEndpoint().areaId(),
                        link.firstEndpoint().areaLabel()),
                new TraversalEndpoint(
                        TravelGeometryProjectionMapper.cellOrOrigin(link.secondEndpoint().tile()),
                        link.secondEndpoint().areaId(),
                        link.secondEndpoint().areaLabel()));
    }

    private static TraversalSourceKind toRuntimeSourceKind(DungeonTraversalSourceKind kind) {
        if (kind == null) {
            return TraversalSourceKind.DOOR;
        }
        return switch (kind) {
            case DOOR -> TraversalSourceKind.door();
            case CORRIDOR -> TraversalSourceKind.corridor();
            case STAIR -> TraversalSourceKind.stair();
        };
    }
}
