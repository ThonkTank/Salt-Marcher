package src.domain.dungeon.model.runtime.travel.projection;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;

final class TravelGeometryProjectionMapper {

    private TravelGeometryProjectionMapper() {
    }

    static Cell cellOrOrigin(@Nullable Cell cell) {
        return cell == null ? new Cell(0, 0, 0) : cell;
    }

    static Edge edgeOrOrigin(@Nullable Edge edge) {
        return edge == null
                ? new Edge(new Cell(0, 0, 0), new Cell(0, 0, 0))
                : edge;
    }
}
