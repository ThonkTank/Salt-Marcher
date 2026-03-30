package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.TargetKey;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class Corridor {

    private static final String TARGET_KEY_PREFIX = "corridor:";

    private final Long corridorId;
    private final long mapId;
    private final List<Long> roomIds;
    private final int levelZ;
    private final List<GridAnchor> points;
    private final List<CorridorEndpointBinding> endpointBindings;
    private final CorridorPath path;
    private final List<CorridorConnection> connections;

    public static Corridor planned(
            long mapId,
            List<Long> roomIds,
            int levelZ,
            List<? extends GridAnchor> points,
            List<CorridorEndpointBinding> endpointBindings
    ) {
        return new Corridor(null, mapId, roomIds, levelZ, points, endpointBindings);
    }

    public static Corridor plannedFromPathCells(
            long mapId,
            List<CubePoint> pathCells,
            List<CorridorEndpointPlan> endpointPlans
    ) {
        List<GridAnchor> points = pointsForPathCells(pathCells);
        if (points.size() < 2) {
            return null;
        }
        List<CorridorEndpointBinding> bindings = bindingsForPlans(endpointPlans);
        return planned(
                mapId,
                List.of(),
                levelForPathCells(pathCells),
                points,
                bindings);
    }

    public static Corridor plannedDirectAdjacency(
            long mapId,
            CorridorEndpointPlan startPlan,
            CorridorEndpointPlan endPlan
    ) {
        CorridorEndpointBinding startBinding = bindingForPlan(startPlan);
        CorridorEndpointBinding endBinding = bindingForPlan(endPlan);
        VertexEdge sharedEdge = sharedBoundaryEdge(startBinding, endBinding);
        return planned(
                mapId,
                List.of(),
                startPlan.roomCell().z(),
                List.of(
                        GridAnchor.atVertex(sharedEdge.start()),
                        GridAnchor.atVertex(sharedEdge.end())),
                List.of(startBinding, endBinding));
    }

    public static Corridor resolved(
            Long corridorId,
            long mapId,
            List<Long> roomIds,
            int levelZ,
            List<? extends GridAnchor> points,
            List<CorridorEndpointBinding> endpointBindings
    ) {
        return new Corridor(corridorId, mapId, roomIds, levelZ, points, endpointBindings);
    }

    private Corridor(
            Long corridorId,
            long mapId,
            List<Long> roomIds,
            int levelZ,
            List<? extends GridAnchor> points,
            List<CorridorEndpointBinding> endpointBindings
    ) {
        this.corridorId = corridorId;
        this.mapId = mapId;
        this.levelZ = levelZ;
        GridRoute route = validatePoints(points);
        this.points = route.anchors();
        this.endpointBindings = normalizeBindings(endpointBindings);
        this.roomIds = normalizeRoomIds(roomIds, this.endpointBindings);
        this.path = CorridorPath.fromPoints(levelZ, this.points);
        this.connections = materializeConnections(corridorId, mapId, levelZ, this.endpointBindings);
    }

    public Corridor withIdentity(Long corridorId, long mapId) {
        return new Corridor(corridorId, mapId, roomIds, levelZ, points, endpointBindings);
    }

    public Long corridorId() {
        return corridorId;
    }

    public String targetKey() {
        return targetKey(corridorId);
    }

    public static String targetKey(Long corridorId) {
        return TargetKey.of(TARGET_KEY_PREFIX, corridorId).value();
    }

    public static boolean isTargetKey(String targetKey) {
        return TargetKey.matches(targetKey, TARGET_KEY_PREFIX);
    }

    public static Long corridorIdFromKey(String targetKey) {
        return TargetKey.parseId(targetKey, TARGET_KEY_PREFIX);
    }

    public long mapId() {
        return mapId;
    }

    public List<Long> roomIds() {
        return roomIds;
    }

    public int levelZ() {
        return levelZ;
    }

    public List<GridAnchor> points() {
        return points;
    }

    public List<CorridorEndpointBinding> endpointBindings() {
        return endpointBindings;
    }

    public CorridorPath path() {
        return path;
    }

    public Set<CubePoint> occupiedCells() {
        return path.cells();
    }

    public Floor floor() {
        return path.floor();
    }

    public Floor floorAtLevel(int levelZ) {
        return levelZ == this.levelZ ? path.floorAtLevel(levelZ) : new Floor(features.world.dungeonmap.model.geometry.TileShape.empty());
    }

    public boolean isDirectlyAdjacent() {
        return !points.isEmpty() && path.cells().isEmpty();
    }

    public List<CorridorConnection> connections() {
        return connections;
    }

    public boolean connectsRoom(Long roomId) {
        return roomId != null && roomIds.contains(roomId);
    }

    private static GridRoute validatePoints(List<? extends GridAnchor> points) {
        if (points == null || points.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least two ordered points");
        }
        ArrayList<GridAnchor> rawPoints = new ArrayList<>();
        for (GridAnchor point : points) {
            if (point == null) {
                throw new IllegalArgumentException("Corridor points must not contain null entries");
            }
            rawPoints.add(point);
        }
        GridRoute route = new GridRoute(rawPoints);
        if (route.anchorCount() != rawPoints.size()) {
            throw new IllegalArgumentException("Corridor points must not contain repeated consecutive points");
        }
        if (route.anchorCount() < 2) {
            throw new IllegalArgumentException("Corridor requires at least two different points");
        }
        for (GridRoute.Segment segment : route.segments()) {
            if (!segment.isAxisAligned()) {
                throw new IllegalArgumentException("Corridor segments must be horizontal or vertical");
            }
            if (segment.manhattanLengthOnDoubledGrid() <= 0) {
                throw new IllegalArgumentException("Corridor segments must have positive length");
            }
        }
        return route;
    }

    private static int levelForPathCells(List<CubePoint> pathCells) {
        if (pathCells == null || pathCells.isEmpty()) {
            throw new IllegalArgumentException("Corridor path cells must not be empty");
        }
        for (CubePoint pathCell : pathCells) {
            if (pathCell != null) {
                return pathCell.z();
            }
        }
        throw new IllegalArgumentException("Corridor path cells must not be empty");
    }

    private static List<GridAnchor> pointsForPathCells(List<CubePoint> pathCells) {
        if (pathCells == null || pathCells.isEmpty()) {
            return List.of();
        }
        ArrayList<GridAnchor> result = new ArrayList<>();
        for (CubePoint pathCell : pathCells) {
            if (pathCell != null) {
                result.add(GridAnchor.atTile(pathCell.projectedCell()));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<CorridorEndpointBinding> bindingsForPlans(List<CorridorEndpointPlan> endpointPlans) {
        if (endpointPlans == null || endpointPlans.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorEndpointBinding> result = new ArrayList<>();
        for (CorridorEndpointPlan endpointPlan : endpointPlans) {
            if (endpointPlan != null) {
                result.add(bindingForPlan(endpointPlan));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static CorridorEndpointBinding bindingForPlan(CorridorEndpointPlan endpointPlan) {
        Objects.requireNonNull(endpointPlan, "endpointPlan");
        return new CorridorEndpointBinding(
                endpointPlan.terminal(),
                endpointPlan.boundaryEdge(),
                List.of(ConnectionEndpoint.room(endpointPlan.roomId())));
    }

    private static VertexEdge sharedBoundaryEdge(
            CorridorEndpointBinding startBinding,
            CorridorEndpointBinding endBinding
    ) {
        Objects.requireNonNull(startBinding, "startBinding");
        Objects.requireNonNull(endBinding, "endBinding");
        VertexEdge startEdge = startBinding.boundaryEdge();
        VertexEdge endEdge = endBinding.boundaryEdge();
        if (!Objects.equals(startEdge, endEdge)) {
            throw new IllegalArgumentException("Direct adjacency corridor endpoints must share one boundary edge");
        }
        return startEdge;
    }

    private static List<CorridorEndpointBinding> normalizeBindings(List<CorridorEndpointBinding> endpointBindings) {
        if (endpointBindings == null || endpointBindings.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorEndpointBinding> result = new ArrayList<>();
        LinkedHashSet<CorridorTerminal> seenTerminals = new LinkedHashSet<>();
        for (CorridorEndpointBinding binding : endpointBindings) {
            if (binding == null) {
                continue;
            }
            if (!seenTerminals.add(binding.terminal())) {
                throw new IllegalArgumentException("Corridor terminal " + binding.terminal() + " may only be bound once");
            }
            result.add(binding);
        }
        result.sort(java.util.Comparator.comparing(CorridorEndpointBinding::terminal));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<CorridorConnection> materializeConnections(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorEndpointBinding> endpointBindings
    ) {
        if (endpointBindings == null || endpointBindings.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorConnection> result = new ArrayList<>();
        for (CorridorEndpointBinding endpointBinding : endpointBindings) {
            if (endpointBinding != null) {
                result.add(endpointBinding.materialize(corridorId, mapId, levelZ));
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static List<Long> normalizeRoomIds(List<Long> roomIds, List<CorridorEndpointBinding> endpointBindings) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        if (roomIds != null) {
            for (Long roomId : roomIds) {
                if (roomId != null) {
                    result.add(roomId);
                }
            }
        }
        if (result.isEmpty()) {
            for (CorridorEndpointBinding endpointBinding : endpointBindings == null ? List.<CorridorEndpointBinding>of() : endpointBindings) {
                if (endpointBinding == null) {
                    continue;
                }
                result.addAll(endpointBinding.roomIds());
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}
