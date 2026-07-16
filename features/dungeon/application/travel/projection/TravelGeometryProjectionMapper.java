package features.dungeon.application.travel.projection;

import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;

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
