package src.domain.dungeon.model.runtime.travel.projection;

import java.util.ArrayList;
import java.util.List;

public final class TraversalLinkProjection {

    public List<TraversalLink> project(TravelAuthoredSurface authoredSurface) {
        List<TraversalLink> result = new ArrayList<>();
        if (authoredSurface == null) {
            return List.of();
        }
        for (TravelAuthoredSurface.TraversalLinkInput link : authoredSurface.traversalLinks()) {
            result.add(toRuntime(link));
        }
        return List.copyOf(result);
    }

    private static TraversalLink toRuntime(TravelAuthoredSurface.TraversalLinkInput link) {
        return new TraversalLink(
                link.key(),
                link.source(),
                link.firstEndpoint(),
                link.secondEndpoint());
    }
}
