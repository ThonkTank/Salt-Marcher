package features.world.dungeonmap.service.editing.connection;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonConnectionPoint;
import features.world.dungeonmap.repository.connection.DungeonConnectionPointRepository;
import features.world.dungeonmap.repository.connection.DungeonConnectionRepository;
import features.world.dungeonmap.service.editing.DungeonEditingTransactions;
import features.world.dungeonmap.service.projection.DungeonMapStateLoader;
import features.world.dungeonmap.service.room.DungeonRoomConnectionRoutes;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

public final class DungeonConnectionEditingService {

    private DungeonConnectionEditingService() {
        throw new AssertionError("No instances");
    }

    public static void replaceConnectionPoints(long connectionId, List<DungeonConnectionPoint> points) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonConnection connection = DungeonConnectionRepository.findConnection(conn, connectionId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown connection: " + connectionId));
            List<DungeonConnectionPoint> normalizedPoints = normalizePoints(connectionId, points);
            validateConnectionPoints(conn, connection, normalizedPoints);
            DungeonConnectionPointRepository.replacePoints(conn, connectionId, normalizedPoints);
        });
    }

    private static List<DungeonConnectionPoint> normalizePoints(long connectionId, List<DungeonConnectionPoint> points) {
        return DungeonRoomConnectionRoutes.normalizeControlPoints(connectionId, points);
    }

    private static void validateConnectionPoints(Connection conn, DungeonConnection connection, List<DungeonConnectionPoint> points) throws SQLException {
        var state = DungeonMapStateLoader.load(conn, connection.mapId());
        for (DungeonConnectionPoint point : points == null ? List.<DungeonConnectionPoint>of() : points) {
            if (point == null) {
                continue;
            }
            if (point.x() < 0 || point.y() < 0 || point.x() >= state.map().width() || point.y() >= state.map().height()) {
                throw new IllegalArgumentException("Connection point lies outside map bounds");
            }
            if (state.index().squareAt(point.x(), point.y()) != null) {
                throw new IllegalArgumentException("Connection point must stay on empty map cells");
            }
        }
        if (DungeonRoomConnectionRoutes.projectConnection(state.map(), state.index(), connection, points).isEmpty()) {
            throw new IllegalArgumentException("Connection route is blocked on the current map");
        }
    }
}
