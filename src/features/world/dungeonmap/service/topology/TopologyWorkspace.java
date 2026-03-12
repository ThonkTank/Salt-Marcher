package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;
import features.world.dungeonmap.repository.DungeonWallRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class TopologyWorkspace {

    private final long mapId;
    private final List<DungeonSquare> previousSquares;
    private final Map<String, DungeonSquare> previousSquaresByCoord;
    private List<DungeonSquare> currentSquares = List.of();
    private Map<String, DungeonSquare> currentSquaresByCoord = Map.of();
    private List<DungeonRoom> rooms = List.of();
    private Map<Long, DungeonRoom> roomsById = Map.of();
    private Map<String, DungeonWall> wallsByEdge = Map.of();
    private Map<String, DungeonPassage> passagesByEdge = Map.of();
    private Map<Long, Integer> currentRoomSquareCounts = Map.of();

    private TopologyWorkspace(long mapId, List<DungeonSquare> previousSquares) {
        this.mapId = mapId;
        this.previousSquares = previousSquares == null ? List.of() : List.copyOf(previousSquares);
        this.previousSquaresByCoord = squaresByCoord(this.previousSquares);
    }

    static TopologyWorkspace load(Connection conn, long mapId, List<DungeonSquare> previousSquares) throws SQLException {
        TopologyWorkspace workspace = new TopologyWorkspace(mapId, previousSquares);
        workspace.reload(conn);
        return workspace;
    }

    void reload(Connection conn) throws SQLException {
        currentSquares = DungeonSquareRepository.getSquares(conn, mapId);
        currentSquaresByCoord = squaresByCoord(currentSquares);
        rooms = DungeonRoomRepository.getRooms(conn, mapId);
        roomsById = roomsById(rooms);
        wallsByEdge = wallsByEdge(DungeonWallRepository.getWalls(conn, mapId));
        passagesByEdge = passagesByEdge(DungeonPassageRepository.getPassages(conn, mapId));
        currentRoomSquareCounts = roomSquareCounts(currentSquares);
    }

    List<DungeonSquare> previousSquares() {
        return previousSquares;
    }

    Map<String, DungeonSquare> previousSquaresByCoord() {
        return previousSquaresByCoord;
    }

    List<DungeonSquare> currentSquares() {
        return currentSquares;
    }

    Map<String, DungeonSquare> currentSquaresByCoord() {
        return currentSquaresByCoord;
    }

    List<DungeonRoom> rooms() {
        return rooms;
    }

    Map<Long, DungeonRoom> roomsById() {
        return roomsById;
    }

    Map<String, DungeonWall> wallsByEdge() {
        return wallsByEdge;
    }

    Map<String, DungeonPassage> passagesByEdge() {
        return passagesByEdge;
    }

    Map<Long, Integer> currentRoomSquareCounts() {
        return currentRoomSquareCounts;
    }

    static String coordKey(int x, int y) {
        return x + ":" + y;
    }

    private static Map<String, DungeonSquare> squaresByCoord(List<DungeonSquare> squares) {
        Map<String, DungeonSquare> result = new HashMap<>();
        if (squares == null) {
            return result;
        }
        for (DungeonSquare square : squares) {
            result.put(coordKey(square.x(), square.y()), square);
        }
        return result;
    }

    private static Map<Long, DungeonRoom> roomsById(List<DungeonRoom> rooms) {
        Map<Long, DungeonRoom> result = new HashMap<>();
        for (DungeonRoom room : rooms) {
            result.put(room.roomId(), room);
        }
        return result;
    }

    private static Map<String, DungeonWall> wallsByEdge(List<DungeonWall> walls) {
        Map<String, DungeonWall> result = new HashMap<>();
        for (DungeonWall wall : walls) {
            result.put(wall.edgeKey(), wall);
        }
        return result;
    }

    private static Map<String, DungeonPassage> passagesByEdge(List<DungeonPassage> passages) {
        Map<String, DungeonPassage> result = new HashMap<>();
        for (DungeonPassage passage : passages) {
            result.put(passage.edgeKey(), passage);
        }
        return result;
    }

    private static Map<Long, Integer> roomSquareCounts(List<DungeonSquare> squares) {
        Map<Long, Integer> result = new HashMap<>();
        for (DungeonSquare square : squares) {
            if (square.roomId() != null) {
                result.merge(square.roomId(), 1, Integer::sum);
            }
        }
        return result;
    }
}
