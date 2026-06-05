package src.domain.dungeon.model.runtime.travel.projection;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;

final class TravelAuthoredSurfaceRelationProjectionMapper {

    private TravelAuthoredSurfaceRelationProjectionMapper() {
    }

    static List<TravelAuthoredSurface.CorridorConnection> toConnections(@Nullable DungeonRelationGraph relations) {
        List<TravelAuthoredSurface.CorridorConnection> result = new ArrayList<>();
        if (relations != null) {
            for (DungeonRelationGraph.ConnectionRelation connection : relations.connections()) {
                if (connection != null) {
                    result.add(new TravelAuthoredSurface.CorridorConnection(
                            connection.corridorId(),
                            connection.roomId()));
                }
            }
        }
        return List.copyOf(result);
    }
}
