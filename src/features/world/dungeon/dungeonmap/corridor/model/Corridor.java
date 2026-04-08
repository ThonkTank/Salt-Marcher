package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungeonmap.structure.model.room.StructureRoomTopology;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.dungeonmap.connections.ConnectionEndpoint;
import features.world.dungeon.dungeonmap.connections.ConnectionKind;
import features.world.dungeon.dungeonmap.connections.DoorConnectionCarrier;
import features.world.dungeon.dungeonmap.connections.DungeonConnection;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Corridor persists only authored network input plus final structure. Routed traces stay transient.
 */
public final class Corridor extends Structure {

    private final CorridorInput input;
    private final List<CorridorPathTrace> pathTraces;
    private final List<DungeonConnection> connections;
    private final GridBoundary boundaryDoorBoundary;
    private final Map<Long, GridBoundary> roomAnchorBoundariesByRoomId;
    private final Map<GridSegment, Long> doorNodeIdsByBoundarySegment;

    public static Corridor fromInput(
            CorridorInput input,
            CorridorResolutionInput resolutionInput
    ) {
        CorridorInput resolvedInput = normalizeInput(Objects.requireNonNull(input, "input"));
        CorridorResolutionInput resolvedResolution = requireResolutionInput(resolvedInput.levelZ(), resolutionInput);
        return new Corridor(
                resolvedInput,
                deriveState(resolvedInput, resolvedResolution, List.of(), List.of(), resolvedInput),
                resolvedResolution);
    }

    public static Corridor rehydrated(
            CorridorInput input,
            Structure structure,
            CorridorResolutionInput resolutionInput
    ) {
        CorridorInput resolvedInput = normalizeInput(Objects.requireNonNull(input, "input"));
        CorridorResolutionInput resolvedResolution = requireResolutionInput(resolvedInput.levelZ(), resolutionInput);
        return new Corridor(
                resolvedInput,
                rehydratedState(resolvedInput, Objects.requireNonNull(structure, "structure"), resolvedResolution),
                resolvedResolution);
    }

    private Corridor(
            CorridorInput input,
            CorridorState state,
            CorridorResolutionInput resolutionInput
    ) {
        super(state.structure());
        CorridorInput resolvedInput = normalizeInput(Objects.requireNonNull(input, "input"));
        requireResolutionInput(resolvedInput.levelZ(), resolutionInput);
        this.input = resolvedInput;
        this.pathTraces = state.pathTraces();
        this.connections = state.connections();
        this.boundaryDoorBoundary = state.boundaryDoorBoundary();
        this.roomAnchorBoundariesByRoomId = state.roomAnchorBoundariesByRoomId();
        this.doorNodeIdsByBoundarySegment = state.doorNodeIdsByBoundarySegment();
    }

    private Corridor(
            CorridorInput input,
            Structure structure,
            List<CorridorPathTrace> pathTraces,
            List<DungeonConnection> connections,
            GridBoundary boundaryDoorBoundary,
            Map<Long, GridBoundary> roomAnchorBoundariesByRoomId,
            Map<GridSegment, Long> doorNodeIdsByBoundarySegment
    ) {
        super(structure);
        this.input = input;
        this.pathTraces = pathTraces == null ? List.of() : List.copyOf(pathTraces);
        this.connections = connections == null ? List.of() : List.copyOf(connections);
        this.boundaryDoorBoundary = boundaryDoorBoundary == null ? GridBoundary.empty() : boundaryDoorBoundary;
        this.roomAnchorBoundariesByRoomId = roomAnchorBoundariesByRoomId == null ? Map.of() : Map.copyOf(roomAnchorBoundariesByRoomId);
        this.doorNodeIdsByBoundarySegment = doorNodeIdsByBoundarySegment == null ? Map.of() : Map.copyOf(doorNodeIdsByBoundarySegment);
    }

    private Corridor(
            CorridorInput input,
            Map<Integer, Structure.LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology,
            List<CorridorPathTrace> pathTraces,
            List<DungeonConnection> connections,
            GridBoundary boundaryDoorBoundary,
            Map<Long, GridBoundary> roomAnchorBoundariesByRoomId,
            Map<GridSegment, Long> doorNodeIdsByBoundarySegment
    ) {
        super(levelsByZ, roomTopology);
        this.input = input;
        this.pathTraces = pathTraces == null ? List.of() : List.copyOf(pathTraces);
        this.connections = connections == null ? List.of() : List.copyOf(connections);
        this.boundaryDoorBoundary = boundaryDoorBoundary == null ? GridBoundary.empty() : boundaryDoorBoundary;
        this.roomAnchorBoundariesByRoomId = roomAnchorBoundariesByRoomId == null ? Map.of() : Map.copyOf(roomAnchorBoundariesByRoomId);
        this.doorNodeIdsByBoundarySegment = doorNodeIdsByBoundarySegment == null ? Map.of() : Map.copyOf(doorNodeIdsByBoundarySegment);
    }

    @Override
    protected Corridor recreate(Map<Integer, Structure.LevelStructure> levelsByZ, StructureRoomTopology roomTopology) {
        return new Corridor(
                input,
                levelsByZ,
                roomTopology,
                pathTraces,
                connections,
                boundaryDoorBoundary,
                roomAnchorBoundariesByRoomId,
                doorNodeIdsByBoundarySegment);
    }

    public CorridorInput input() {
        return input;
    }

    public Long corridorId() {
        return input.corridorId();
    }

    public Long structureObjectId() {
        return input.structureObjectId();
    }

    public long mapId() {
        return input.mapId();
    }

    public int levelZ() {
        return input.levelZ();
    }

    public List<CorridorInputNode> nodes() {
        return input.nodes();
    }

    public List<CorridorSegment> segments() {
        return input.segments();
    }

    public List<CorridorPathTrace> pathTraces() {
        return pathTraces;
    }

    public List<DungeonConnection> connections() {
        return connections;
    }

    public GridBoundary boundaryDoorBoundary() {
        return boundaryDoorBoundary;
    }

    public List<CorridorInputNode> fixedNodes() {
        return input.nodes().stream()
                .filter(node -> node != null && !node.isDoorBound())
                .sorted(Comparator.comparing(node -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId()))
                .toList();
    }

    public CorridorPathTrace traceForSegment(Long segmentId) {
        if (segmentId == null) {
            return null;
        }
        return pathTraces.stream()
                .filter(trace -> trace != null && Objects.equals(trace.segmentId(), segmentId))
                .findFirst()
                .orElse(null);
    }

    public Long segmentIdAtCell(GridPoint cell) {
        if (cell == null) {
            return null;
        }
        return pathTraces.stream()
                .filter(trace -> trace != null && trace.path().cellFootprint().cells().contains(cell))
                .sorted(Comparator.comparing(trace -> trace.segmentId() == null ? Long.MAX_VALUE : trace.segmentId()))
                .map(CorridorPathTrace::segmentId)
                .findFirst()
                .orElse(null);
    }

    public Long doorNodeIdAtBoundary(GridSegment boundarySegment) {
        return boundarySegment == null ? null : doorNodeIdsByBoundarySegment.get(boundarySegment);
    }

    public List<Long> connectedRoomIds() {
        return connections.stream()
                .filter(Objects::nonNull)
                .flatMap(connection -> connection.endpoints().stream())
                .filter(Objects::nonNull)
                .filter(endpoint -> endpoint.type() == features.world.dungeon.dungeonmap.connections.ConnectionEndpointType.ROOM)
                .map(ConnectionEndpoint::id)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    public boolean touchesRoomAnchorCells(Long roomId, GridArea cells) {
        if (roomId == null || cells == null || cells.isEmpty()) {
            return false;
        }
        GridBoundary roomAnchorBoundary = roomAnchorBoundariesByRoomId.get(roomId);
        if (roomAnchorBoundary == null || roomAnchorBoundary.isEmpty()) {
            return false;
        }
        return roomAnchorBoundary.segments().stream()
                .flatMap(segment -> segment.cellFootprint().cells().stream())
                .anyMatch(cells.cells()::contains);
    }

    public boolean connectsRoom(Long roomId) {
        return roomId != null && connectedRoomIds().contains(roomId);
    }

    public Corridor withInput(CorridorInput updatedInput, CorridorResolutionInput resolutionInput) {
        CorridorInput normalizedInput = normalizeInput(Objects.requireNonNull(updatedInput, "updatedInput"));
        return new Corridor(
                normalizedInput,
                deriveState(
                        normalizedInput,
                        requireResolutionInput(normalizedInput.levelZ(), resolutionInput),
                        boundaryAtLevel(levelZ()).doors(),
                        pathTraces,
                        input),
                resolutionInput);
    }

    public void validateReconcile(CorridorReconcileInput input) {
        if (input == null || !input.hasAffectedRooms()) {
            return;
        }
        for (CorridorInputNode node : this.input.nodes()) {
            validateDoorRebind(input, node);
        }
    }

    public Corridor reconciled(CorridorReconcileInput input) {
        if (input == null || !input.hasAffectedRooms()) {
            return this;
        }
        ArrayList<CorridorInputNode> updatedNodes = new ArrayList<>(this.input.nodes().size());
        boolean changed = false;
        for (CorridorInputNode node : this.input.nodes()) {
            CorridorInputNode updatedNode = reboundNode(input, node);
            updatedNodes.add(updatedNode);
            changed |= !Objects.equals(updatedNode, node);
        }
        if (!changed) {
            return this;
        }
        Corridor rebound = withInput(
                new CorridorInput(
                        this.input.corridorId(),
                        this.input.structureObjectId(),
                        this.input.mapId(),
                        this.input.levelZ(),
                        updatedNodes,
                        this.input.segments()),
                input.updatedResolution());
        if (input.translation().isZero() && !rebound.pathTraces().equals(pathTraces)) {
            throw new IllegalArgumentException("Corridor room rewrite may not reroute corridor");
        }
        return rebound;
    }

    private static CorridorState deriveState(
            CorridorInput input,
            CorridorResolutionInput resolutionInput,
            Collection<Door> retainedDoors,
            List<CorridorPathTrace> previousTraces,
            CorridorInput previousInput
    ) {
        CorridorInput normalizedInput = normalizeInput(input);
        validateInput(normalizedInput, resolutionInput);
        List<CorridorPathTrace> traces = routeSegmentTraces(
                normalizedInput,
                resolutionInput,
                previousTraces == null ? List.of() : previousTraces,
                previousInput == null ? normalizedInput : previousInput);
        Structure structure = assembleStructure(normalizedInput.levelZ(), retainedDoors, traces);
        return new CorridorState(
                structure,
                traces,
                materializeConnections(resolutionInput, normalizedInput.corridorId(), normalizedInput.mapId(), normalizedInput.levelZ(), normalizedInput.nodes()),
                materializeBoundaryDoorBoundary(structure, normalizedInput.levelZ(), normalizedInput.nodes(), resolutionInput),
                materializeRoomAnchorBoundaries(normalizedInput.nodes(), resolutionInput),
                materializeDoorNodeIdsByBoundarySegment(normalizedInput.nodes(), resolutionInput));
    }

    private static CorridorState rehydratedState(
            CorridorInput input,
            Structure structure,
            CorridorResolutionInput resolutionInput
    ) {
        CorridorInput normalizedInput = normalizeInput(input);
        if (structure.surfaceAtLevel(normalizedInput.levelZ()).isEmpty()) {
            throw new IllegalArgumentException("Persisted corridor structure must exist at the corridor level");
        }
        validateInput(normalizedInput, resolutionInput);
        return new CorridorState(
                structure,
                recoverSegmentTraces(normalizedInput, structure, resolutionInput),
                materializeConnections(resolutionInput, normalizedInput.corridorId(), normalizedInput.mapId(), normalizedInput.levelZ(), normalizedInput.nodes()),
                materializeBoundaryDoorBoundary(structure, normalizedInput.levelZ(), normalizedInput.nodes(), resolutionInput),
                materializeRoomAnchorBoundaries(normalizedInput.nodes(), resolutionInput),
                materializeDoorNodeIdsByBoundarySegment(normalizedInput.nodes(), resolutionInput));
    }

    private static CorridorInput normalizeInput(CorridorInput input) {
        CorridorInput resolvedInput = Objects.requireNonNull(input, "input");
        List<CorridorInputNode> nodes = resolvedInput.nodes().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(node -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId()))
                .toList();
        List<CorridorSegment> segments = resolvedInput.segments().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(segment -> segment.segmentId() == null ? Long.MAX_VALUE : segment.segmentId()))
                .toList();
        return new CorridorInput(
                resolvedInput.corridorId(),
                resolvedInput.structureObjectId(),
                resolvedInput.mapId(),
                resolvedInput.levelZ(),
                nodes,
                segments);
    }

    private static CorridorResolutionInput requireResolutionInput(int levelZ, CorridorResolutionInput input) {
        CorridorResolutionInput resolvedInput = Objects.requireNonNull(input, "input");
        if (resolvedInput.levelZ() != levelZ) {
            throw new IllegalArgumentException("Corridor resolution input level must match corridor level");
        }
        return resolvedInput;
    }

    private static void validateInput(
            CorridorInput input,
            CorridorResolutionInput resolutionInput
    ) {
        if (input.nodes().size() < 2) {
            throw new IllegalArgumentException("Corridor requires at least two nodes");
        }
        if (input.segments().isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least one segment");
        }
        Map<Long, CorridorInputNode> nodesById = nodesById(input.nodes());
        if (nodesById.size() != input.nodes().size()) {
            throw new IllegalArgumentException("Corridor node ids must stay unique");
        }
        Map<Long, CorridorSegment> segmentsById = segmentsById(input.segments());
        if (segmentsById.size() != input.segments().size()) {
            throw new IllegalArgumentException("Corridor segment ids must stay unique");
        }
        LinkedHashMap<Long, Integer> degreeByNodeId = new LinkedHashMap<>();
        for (CorridorInputNode node : input.nodes()) {
            if (node.nodeId() == null) {
                throw new IllegalArgumentException("Corridor input nodes require stable ids");
            }
            degreeByNodeId.put(node.nodeId(), 0);
        }
        for (CorridorSegment segment : input.segments()) {
            if (!nodesById.containsKey(segment.startNodeId()) || !nodesById.containsKey(segment.endNodeId())) {
                throw new IllegalArgumentException("Corridor segment references missing node");
            }
            degreeByNodeId.computeIfPresent(segment.startNodeId(), (ignored, degree) -> degree + 1);
            degreeByNodeId.computeIfPresent(segment.endNodeId(), (ignored, degree) -> degree + 1);
        }
        for (CorridorInputNode node : input.nodes()) {
            int degree = degreeByNodeId.getOrDefault(node.nodeId(), 0);
            if (degree <= 0) {
                throw new IllegalArgumentException("Corridor nodes may not be isolated");
            }
            if (node.isDoorBound()) {
                CorridorResolutionInput.ExteriorDoorInput door = requiredExteriorDoor(resolutionInput, node.doorRef());
                if (door.anchorSegment().start().z() != input.levelZ()) {
                    throw new IllegalArgumentException("Corridor door node must stay on the corridor level");
                }
                if (degree != 1) {
                    throw new IllegalArgumentException("Door-bound corridor nodes must have degree 1");
                }
            }
        }
        validateConnectedGraph(input.nodes(), input.segments());
    }

    private static void validateConnectedGraph(List<CorridorInputNode> nodes, List<CorridorSegment> segments) {
        if (nodes.isEmpty() || segments.isEmpty()) {
            return;
        }
        Map<Long, List<Long>> adjacency = new LinkedHashMap<>();
        for (CorridorInputNode node : nodes) {
            adjacency.put(node.nodeId(), new ArrayList<>());
        }
        for (CorridorSegment segment : segments) {
            adjacency.computeIfAbsent(segment.startNodeId(), ignored -> new ArrayList<>()).add(segment.endNodeId());
            adjacency.computeIfAbsent(segment.endNodeId(), ignored -> new ArrayList<>()).add(segment.startNodeId());
        }
        Long startNodeId = nodes.getFirst().nodeId();
        LinkedHashSet<Long> visitedNodeIds = new LinkedHashSet<>();
        ArrayDeque<Long> frontier = new ArrayDeque<>();
        frontier.add(startNodeId);
        visitedNodeIds.add(startNodeId);
        while (!frontier.isEmpty()) {
            Long nodeId = frontier.removeFirst();
            for (Long neighborNodeId : adjacency.getOrDefault(nodeId, List.of())) {
                if (visitedNodeIds.add(neighborNodeId)) {
                    frontier.addLast(neighborNodeId);
                }
            }
        }
        if (visitedNodeIds.size() != nodes.size()) {
            throw new IllegalArgumentException("Corridor graph must stay connected");
        }
    }

    private static Structure assembleStructure(
            int levelZ,
            Collection<Door> doors,
            List<CorridorPathTrace> traces
    ) {
        return Structure.fromSurfaceLevel(levelZ, CorridorRouting.surfaceAreaForTraces(traces), doors);
    }

    private static List<CorridorPathTrace> routeSegmentTraces(
            CorridorInput input,
            CorridorResolutionInput resolutionInput,
            List<CorridorPathTrace> previousTraces,
            CorridorInput previousInput
    ) {
        Map<Long, CorridorInputNode> nodesById = nodesById(input.nodes());
        Map<Long, CorridorInputNode> previousNodesById = nodesById(previousInput.nodes());
        Map<Long, CorridorPathTrace> previousTracesBySegmentId = tracesBySegmentId(previousTraces);
        Map<Long, CorridorSegment> previousSegmentsById = segmentsById(previousInput.segments());
        List<CorridorSegment> orderedSegments = input.segments().stream()
                .sorted(Comparator.comparing(CorridorSegment::segmentId))
                .toList();
        LinkedHashMap<Long, CorridorPathTrace> tracesBySegmentId = new LinkedHashMap<>();
        GridArea reservedArea = GridArea.empty();

        for (CorridorSegment segment : orderedSegments) {
            CorridorSegment.ResolvedSegment currentSegment = segment.resolve(nodesById, resolutionInput);
            CorridorSegment previousSegment = previousSegmentsById.get(segment.segmentId());
            CorridorSegment.ResolvedSegment previousResolvedSegment = previousSegment == null
                    ? null
                    : previousSegment.resolve(previousNodesById, resolutionInput);
            CorridorPathTrace trace = segment.traceFrom(
                    previousResolvedSegment,
                    previousTracesBySegmentId.get(segment.segmentId()),
                    currentSegment,
                    new CorridorSegment.RoutingContext(
                            resolutionInput.blockedArea(),
                            reservedArea));
            tracesBySegmentId.put(segment.segmentId(), trace);
            reservedArea = GridArea.of(unionCells(reservedArea, trace.path().cellFootprint()));
        }

        return orderedSegments.stream()
                .map(segment -> tracesBySegmentId.get(segment.segmentId()))
                .filter(Objects::nonNull)
                .toList();
    }

    private static List<CorridorPathTrace> recoverSegmentTraces(
            CorridorInput input,
            Structure structure,
            CorridorResolutionInput resolutionInput
    ) {
        Map<Long, CorridorInputNode> nodesById = nodesById(input.nodes());
        List<CorridorSegment> orderedSegments = input.segments().stream()
                .sorted(Comparator.comparing(CorridorSegment::segmentId))
                .toList();
        GridArea surfaceArea = structure.surfaceAtLevel(input.levelZ()).surface().cellFootprint();
        LinkedHashSet<GridPoint> fixedNodeCells = new LinkedHashSet<>();
        for (CorridorInputNode node : input.nodes()) {
            if (node != null && !node.isDoorBound() && node.fixedPoint() != null && node.fixedPoint().kind() == GridPoint.Kind.CELL) {
                fixedNodeCells.add(node.fixedPoint());
            }
        }
        GridArea fixedNodeArea = fixedNodeCells.isEmpty() ? GridArea.empty() : GridArea.of(fixedNodeCells);

        LinkedHashSet<GridPoint> consumedNonNodeCells = new LinkedHashSet<>();
        LinkedHashSet<GridPoint> coveredSurfaceCells = new LinkedHashSet<>();
        ArrayList<CorridorPathTrace> traces = new ArrayList<>();
        for (CorridorSegment segment : orderedSegments) {
            CorridorPathTrace trace = segment.recoverTrace(
                    segment.resolve(nodesById, resolutionInput),
                    surfaceArea,
                    consumedNonNodeCells.isEmpty() ? GridArea.empty() : GridArea.of(consumedNonNodeCells),
                    fixedNodeArea);
            traces.add(trace);
            Set<GridPoint> traceCells = trace.path().cellFootprint().cells();
            coveredSurfaceCells.addAll(traceCells);
            CorridorInputNode startNode = nodesById.get(segment.startNodeId());
            CorridorInputNode endNode = nodesById.get(segment.endNodeId());
            Set<GridPoint> startCells = resolvedPointCells(startNode, resolutionInput);
            Set<GridPoint> endCells = resolvedPointCells(endNode, resolutionInput);
            for (GridPoint cell : traceCells) {
                if (!startCells.contains(cell) && !endCells.contains(cell) && !fixedNodeCells.contains(cell)) {
                    consumedNonNodeCells.add(cell);
                }
            }
        }
        if (!coveredSurfaceCells.equals(surfaceArea.cells())) {
            throw new IllegalArgumentException("Persisted corridor surface cannot be reconstructed from corridor metadata");
        }
        return List.copyOf(traces);
    }

    private static Set<GridPoint> resolvedPointCells(
            CorridorInputNode node,
            CorridorResolutionInput resolutionInput
    ) {
        if (node == null) {
            return Set.of();
        }
        GridPoint point = node.isDoorBound()
                ? requiredExteriorDoor(resolutionInput, node.doorRef()).anchorPoint()
                : node.fixedPoint();
        return point == null ? Set.of() : point.cellFootprint().cells();
    }

    private static List<DungeonConnection> materializeConnections(
            CorridorResolutionInput input,
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorInputNode> nodes
    ) {
        if (corridorId == null) {
            return List.of();
        }
        ArrayList<DungeonConnection> result = new ArrayList<>();
        for (CorridorInputNode node : nodes) {
            if (node == null || !node.isDoorBound()) {
                continue;
            }
            CorridorResolutionInput.ExteriorDoorInput description = requiredExteriorDoor(input, node.doorRef());
            result.add(new DungeonConnection(
                    ConnectionKind.CORRIDOR,
                    corridorId,
                    mapId,
                    levelZ,
                    new DoorConnectionCarrier(description.ref()),
                    List.of(ConnectionEndpoint.room(description.roomId()), ConnectionEndpoint.corridor(corridorId))));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static GridBoundary materializeBoundaryDoorBoundary(
            Structure structure,
            int levelZ,
            List<CorridorInputNode> nodes,
            CorridorResolutionInput input
    ) {
        StructureBoundary boundary = Objects.requireNonNull(structure, "structure").boundaryAtLevel(levelZ);
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>(boundary.doorBoundary().segments());
        for (CorridorInputNode node : nodes) {
            if (node == null || !node.isDoorBound()) {
                continue;
            }
            CorridorResolutionInput.ExteriorDoorInput description = requiredExteriorDoor(input, node.doorRef());
            result.addAll(description.door().boundary().segments().stream()
                    .filter(boundary.boundary().segments()::contains)
                    .toList());
        }
        return result.isEmpty() ? GridBoundary.empty() : GridBoundary.of(result);
    }

    private static Map<GridSegment, Long> materializeDoorNodeIdsByBoundarySegment(
            List<CorridorInputNode> nodes,
            CorridorResolutionInput input
    ) {
        LinkedHashMap<GridSegment, Long> result = new LinkedHashMap<>();
        for (CorridorInputNode node : nodes) {
            if (node == null || !node.isDoorBound()) {
                continue;
            }
            CorridorResolutionInput.ExteriorDoorInput description = requiredExteriorDoor(input, node.doorRef());
            result.put(description.anchorSegment(), node.nodeId());
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Long, GridBoundary> materializeRoomAnchorBoundaries(
            List<CorridorInputNode> nodes,
            CorridorResolutionInput input
    ) {
        LinkedHashMap<Long, List<GridSegment>> segmentsByRoomId = new LinkedHashMap<>();
        for (CorridorInputNode node : nodes) {
            if (node == null || !node.isDoorBound()) {
                continue;
            }
            CorridorResolutionInput.ExteriorDoorInput description = requiredExteriorDoor(input, node.doorRef());
            if (description.roomId() == null) {
                continue;
            }
            segmentsByRoomId.computeIfAbsent(description.roomId(), ignored -> new ArrayList<>()).add(description.anchorSegment());
        }
        if (segmentsByRoomId.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<Long, GridBoundary> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<GridSegment>> entry : segmentsByRoomId.entrySet()) {
            result.put(entry.getKey(), GridBoundary.of(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Set<GridPoint> unionCells(GridArea left, GridArea right) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>(left == null ? Set.<GridPoint>of() : left.cells());
        result.addAll(right == null ? Set.of() : right.cells());
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Map<Long, CorridorInputNode> nodesById(List<CorridorInputNode> nodes) {
        LinkedHashMap<Long, CorridorInputNode> result = new LinkedHashMap<>();
        for (CorridorInputNode node : nodes == null ? List.<CorridorInputNode>of() : nodes) {
            if (node == null || node.nodeId() == null) {
                throw new IllegalArgumentException("Corridor input nodes require stable ids");
            }
            if (result.put(node.nodeId(), node) != null) {
                throw new IllegalArgumentException("Duplicate corridor node id " + node.nodeId());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, CorridorSegment> segmentsById(List<CorridorSegment> segments) {
        LinkedHashMap<Long, CorridorSegment> result = new LinkedHashMap<>();
        for (CorridorSegment segment : segments == null ? List.<CorridorSegment>of() : segments) {
            if (segment == null || segment.segmentId() == null) {
                throw new IllegalArgumentException("Corridor segments require stable ids");
            }
            if (result.put(segment.segmentId(), segment) != null) {
                throw new IllegalArgumentException("Duplicate corridor segment id " + segment.segmentId());
            }
        }
        return Map.copyOf(result);
    }

    private void validateDoorRebind(CorridorReconcileInput input, CorridorInputNode node) {
        if (node == null || !node.isDoorBound()) {
            return;
        }
        CorridorResolutionInput.ExteriorDoorInput description = input.originalDoorsByRef().get(node.doorRef());
        if (description == null || description.roomId() == null || !input.affectedRoomIds().contains(description.roomId())) {
            return;
        }
        if (input.translation().dzLevels() == 0 && !input.updatedDoorsByRef().containsKey(node.doorRef())) {
            throw new IllegalArgumentException("Corridor room rewrite requires an existing exterior room door");
        }
    }

    private CorridorInputNode reboundNode(CorridorReconcileInput input, CorridorInputNode node) {
        if (node == null || !node.isDoorBound()) {
            return node;
        }
        CorridorResolutionInput.ExteriorDoorInput originalDoor = input.originalDoorsByRef().get(node.doorRef());
        if (originalDoor == null || originalDoor.roomId() == null || !input.affectedRoomIds().contains(originalDoor.roomId())) {
            return node;
        }
        if (input.translation().dzLevels() != 0) {
            return new CorridorInputNode(node.nodeId(), null, originalDoor.anchorPoint());
        }
        CorridorResolutionInput.ExteriorDoorInput reboundDoor = input.updatedDoorsByRef().get(node.doorRef());
        return reboundDoor == null
                ? new CorridorInputNode(node.nodeId(), null, originalDoor.anchorPoint())
                : new CorridorInputNode(node.nodeId(), reboundDoor.ref(), null);
    }

    private static CorridorResolutionInput.ExteriorDoorInput requiredExteriorDoor(
            CorridorResolutionInput input,
            DoorRef doorRef
    ) {
        return Objects.requireNonNull(input, "input").requiredExteriorDoor(doorRef);
    }

    /**
     * Repository-only persistence seam: keep the already resolved corridor and remap owner-local ids after save.
     */
    public Corridor persistedAs(
            CorridorInput persistedInput,
            Structure persistedStructure,
            Map<Long, Long> nodeIdRemap,
            Map<Long, Long> segmentIdRemap,
            CorridorResolutionInput resolutionInput
    ) {
        CorridorInput resolvedPersistedInput = normalizeInput(Objects.requireNonNull(persistedInput, "persistedInput"));
        Map<Long, Long> resolvedNodeIdRemap = nodeIdRemap == null ? Map.of() : Map.copyOf(nodeIdRemap);
        Map<Long, Long> resolvedSegmentIdRemap = segmentIdRemap == null ? Map.of() : Map.copyOf(segmentIdRemap);
        CorridorResolutionInput resolvedResolutionInput = requireResolutionInput(
                resolvedPersistedInput.levelZ(),
                resolutionInput);
        List<CorridorPathTrace> remappedTraces = pathTraces.stream()
                .filter(Objects::nonNull)
                .map(trace -> new CorridorPathTrace(
                        remapId(trace.segmentId(), resolvedSegmentIdRemap),
                        remapId(trace.startNodeId(), resolvedNodeIdRemap),
                        remapId(trace.endNodeId(), resolvedNodeIdRemap),
                        trace.path()))
                .toList();
        return new Corridor(
                resolvedPersistedInput,
                Objects.requireNonNull(persistedStructure, "persistedStructure"),
                remappedTraces,
                materializeConnections(
                        resolvedResolutionInput,
                        resolvedPersistedInput.corridorId(),
                        resolvedPersistedInput.mapId(),
                        resolvedPersistedInput.levelZ(),
                        resolvedPersistedInput.nodes()),
                materializeBoundaryDoorBoundary(
                        persistedStructure,
                        resolvedPersistedInput.levelZ(),
                        resolvedPersistedInput.nodes(),
                        resolvedResolutionInput),
                materializeRoomAnchorBoundaries(resolvedPersistedInput.nodes(), resolvedResolutionInput),
                materializeDoorNodeIdsByBoundarySegment(resolvedPersistedInput.nodes(), resolvedResolutionInput));
    }

    private static Map<Long, CorridorPathTrace> tracesBySegmentId(List<CorridorPathTrace> traces) {
        LinkedHashMap<Long, CorridorPathTrace> result = new LinkedHashMap<>();
        for (CorridorPathTrace trace : traces == null ? List.<CorridorPathTrace>of() : traces) {
            if (trace != null && trace.segmentId() != null) {
                result.put(trace.segmentId(), trace);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Long remapId(Long id, Map<Long, Long> remap) {
        if (id == null) {
            return null;
        }
        return remap.getOrDefault(id, id);
    }

    private record CorridorState(
            Structure structure,
            List<CorridorPathTrace> pathTraces,
            List<DungeonConnection> connections,
            GridBoundary boundaryDoorBoundary,
            Map<Long, GridBoundary> roomAnchorBoundariesByRoomId,
            Map<GridSegment, Long> doorNodeIdsByBoundarySegment
    ) {
        private CorridorState {
            structure = Objects.requireNonNull(structure, "structure");
            pathTraces = pathTraces == null ? List.of() : List.copyOf(pathTraces);
            connections = connections == null ? List.of() : List.copyOf(connections);
            boundaryDoorBoundary = boundaryDoorBoundary == null ? GridBoundary.empty() : boundaryDoorBoundary;
            roomAnchorBoundariesByRoomId = roomAnchorBoundariesByRoomId == null ? Map.of() : Map.copyOf(roomAnchorBoundariesByRoomId);
            doorNodeIdsByBoundarySegment = doorNodeIdsByBoundarySegment == null ? Map.of() : Map.copyOf(doorNodeIdsByBoundarySegment);
        }
    }
}
