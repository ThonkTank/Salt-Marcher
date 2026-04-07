package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.StructureSpecification;
import features.world.dungeon.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungeonmap.structure.model.room.StructureRoomTopology;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.model.structures.connection.ConnectionEndpoint;
import features.world.dungeon.model.structures.connection.ConnectionKind;
import features.world.dungeon.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeon.model.structures.connection.DungeonConnection;

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
 * Corridor persists only the authored draft plus final structure. Graph nodes, segments, and traces are derived
 * transiently from the draft so corridor editing stays centered on authored inputs instead of persisted graph state.
 */
public final class Corridor extends Structure {

    private final CorridorDraft draft;
    private final List<CorridorNode> nodes;
    private final List<CorridorSegment> segments;
    private final List<CorridorPathTrace> pathTraces;
    private final List<DungeonConnection> connections;
    private final GridBoundary boundaryDoorBoundary;
    private final Map<Long, GridBoundary> roomAnchorBoundariesByRoomId;
    private final Map<Long, CorridorMember> membersById;
    private final Map<Long, CorridorWaypoint> waypointsById;

    public static Corridor fromDraft(
            CorridorDraft draft,
            CorridorResolutionInput input
    ) {
        CorridorDraft resolvedDraft = Objects.requireNonNull(draft, "draft");
        CorridorResolutionInput resolvedInput = requireInput(resolvedDraft.levelZ(), input);
        return new Corridor(resolvedDraft, deriveState(resolvedDraft, resolvedInput), resolvedInput);
    }

    public static Corridor rehydrated(
            CorridorDraft draft,
            Structure structure,
            CorridorResolutionInput input
    ) {
        CorridorDraft resolvedDraft = Objects.requireNonNull(draft, "draft");
        CorridorResolutionInput resolvedInput = requireInput(resolvedDraft.levelZ(), input);
        return new Corridor(resolvedDraft, rehydratedState(resolvedDraft, structure, resolvedInput), resolvedInput);
    }

    private Corridor(
            CorridorDraft draft,
            CorridorState state,
            CorridorResolutionInput input
    ) {
        super(state.structure());
        CorridorDraft resolvedDraft = Objects.requireNonNull(draft, "draft");
        CorridorResolutionInput resolvedInput = requireInput(resolvedDraft.levelZ(), input);
        this.draft = normalizeDraft(resolvedDraft);
        this.nodes = state.graph().nodes();
        this.segments = state.graph().segments();
        this.pathTraces = state.pathTraces();
        this.connections = state.connections();
        this.boundaryDoorBoundary = state.boundaryDoorBoundary();
        this.roomAnchorBoundariesByRoomId = state.roomAnchorBoundariesByRoomId();
        this.membersById = indexMembers(this.draft.members());
        this.waypointsById = indexWaypoints(this.draft.waypoints());
        validateGraph(this.nodes, this.segments, resolvedInput, this.draft.levelZ());
    }

    private Corridor(
            CorridorDraft draft,
            Map<Integer, Structure.LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            List<CorridorPathTrace> pathTraces,
            List<DungeonConnection> connections,
            GridBoundary boundaryDoorBoundary,
            Map<Long, GridBoundary> roomAnchorBoundariesByRoomId
    ) {
        super(levelsByZ, roomTopology);
        this.draft = draft;
        this.nodes = nodes == null ? List.of() : List.copyOf(nodes);
        this.segments = segments == null ? List.of() : List.copyOf(segments);
        this.pathTraces = pathTraces == null ? List.of() : List.copyOf(pathTraces);
        this.connections = connections == null ? List.of() : List.copyOf(connections);
        this.boundaryDoorBoundary = boundaryDoorBoundary == null ? GridBoundary.empty() : boundaryDoorBoundary;
        this.roomAnchorBoundariesByRoomId = roomAnchorBoundariesByRoomId == null ? Map.of() : Map.copyOf(roomAnchorBoundariesByRoomId);
        this.membersById = indexMembers(draft == null ? List.of() : draft.members());
        this.waypointsById = indexWaypoints(draft == null ? List.of() : draft.waypoints());
    }

    @Override
    protected Corridor recreate(
            Map<Integer, Structure.LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        return new Corridor(
                draft,
                levelsByZ,
                roomTopology,
                nodes,
                segments,
                pathTraces,
                connections,
                boundaryDoorBoundary,
                roomAnchorBoundariesByRoomId);
    }

    public CorridorDraft draft() {
        return draft;
    }

    public Long corridorId() {
        return draft.corridorId();
    }

    public Long structureObjectId() {
        return draft.structureObjectId();
    }

    public long mapId() {
        return draft.mapId();
    }

    public int levelZ() {
        return draft.levelZ();
    }

    public List<CorridorMember> members() {
        return draft.members();
    }

    public List<CorridorWaypoint> waypoints() {
        return draft.waypoints();
    }

    public List<CorridorNode> nodes() {
        return nodes;
    }

    public List<CorridorSegment> segments() {
        return segments;
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

    public List<Long> connectedRoomIds() {
        return connections.stream()
                .filter(Objects::nonNull)
                .flatMap(connection -> connection.endpoints().stream())
                .filter(Objects::nonNull)
                .filter(endpoint -> endpoint.type() == features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM)
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

    public List<CorridorNode> persistedManualNodes() {
        return draft.waypoints().stream()
                .map(waypoint -> new CorridorNode(waypoint.waypointId(), waypoint.point(), null))
                .toList();
    }

    public CorridorPathTrace traceForSegment(Long memberId, int segmentOrdinal) {
        if (memberId == null || segmentOrdinal < 0) {
            return null;
        }
        return pathTraces.stream()
                .filter(trace -> trace != null
                        && Objects.equals(trace.memberId(), memberId)
                        && trace.segmentOrdinal() == segmentOrdinal)
                .findFirst()
                .orElse(null);
    }

    public CorridorNode rootNode() {
        GridPoint rootPoint = switch (draft.rootTerminal()) {
            case CorridorTerminal.PointTerminal pointTerminal -> pointTerminal.point();
            case CorridorTerminal.DoorTerminal doorTerminal -> nodes.stream()
                    .filter(node -> node != null && node.isDoorBound() && Objects.equals(node.doorRef(), doorTerminal.doorRef()))
                    .map(CorridorNode::point)
                    .findFirst()
                    .orElse(null);
        };
        return nodes.stream()
                .filter(node -> node != null && Objects.equals(node.point(), rootPoint))
                .findFirst()
                .orElse(null);
    }

    public CorridorNode doorNodeAtBoundary(GridSegment boundarySegment, CorridorResolutionInput input) {
        if (boundarySegment == null) {
            return null;
        }
        return nodes.stream()
                .filter(CorridorNode::isDoorBound)
                .filter(node -> matchesBoundary(new CorridorTerminal.DoorTerminal(node.doorRef()), boundarySegment, input))
                .findFirst()
                .orElse(null);
    }

    public Corridor mutated(CorridorMutation mutation, CorridorResolutionInput input) {
        if (mutation == null) {
            return this;
        }
        return switch (mutation) {
            case CorridorMutation.NodeMove edit -> movedWaypoint(edit.nodeId(), edit.point(), input);
            case CorridorMutation.TileNodePromotionAndMove edit -> promotedTileWaypointAndMoved(edit.tileCell(), edit.targetPoint(), input);
            case CorridorMutation.AttachRoomDoorAtBoundary edit -> attachedRoomDoorAtBoundary(edit.doorRef(), edit.boundarySegment(), input);
            case CorridorMutation.DoorMove edit -> movedDoor(edit.sourceBoundarySegment(), edit.targetDoorRef(), input);
        };
    }

    public void validateReconcile(CorridorReconcileInput input) {
        if (input == null || !input.hasAffectedRooms()) {
            return;
        }
        validateTerminalRebind(input, draft.rootTerminal());
        for (CorridorMember member : draft.members()) {
            validateTerminalRebind(input, member.terminal());
        }
    }

    public Corridor reconciled(CorridorReconcileInput input) {
        if (input == null || !input.hasAffectedRooms()) {
            return this;
        }
        CorridorTerminal updatedRoot = reboundTerminal(input, draft.rootTerminal(), rootTerminalPoint(input.originalDoorsByRef()));
        ArrayList<CorridorMember> updatedMembers = new ArrayList<>(draft.members().size());
        boolean changed = !Objects.equals(updatedRoot, draft.rootTerminal());
        for (CorridorMember member : draft.members()) {
            CorridorTerminal currentTerminal = member.terminal();
            CorridorTerminal updatedTerminal = reboundTerminal(input, currentTerminal, terminalPointForMember(member, input.originalDoorsByRef()));
            updatedMembers.add(Objects.equals(updatedTerminal, currentTerminal)
                    ? member
                    : new CorridorMember(member.memberId(), updatedTerminal, member.hostMemberId(), member.hostWaypointId()));
            changed |= !Objects.equals(updatedTerminal, currentTerminal);
        }
        if (!changed) {
            return this;
        }
        Corridor rebound = resolvedAgainst(input.updatedResolution(), new CorridorDraft(
                draft.corridorId(),
                draft.structureObjectId(),
                draft.mapId(),
                draft.levelZ(),
                updatedRoot,
                updatedMembers,
                draft.waypoints()));
        if (input.translation().isZero() && !rebound.pathTraces().equals(pathTraces)) {
            throw new IllegalArgumentException("Corridor room rewrite may not reroute corridor");
        }
        return rebound;
    }

    private Corridor movedWaypoint(Long waypointId, GridPoint point2x, CorridorResolutionInput input) {
        if (waypointId == null || point2x == null) {
            return this;
        }
        ArrayList<CorridorWaypoint> updatedWaypoints = new ArrayList<>(draft.waypoints().size());
        boolean changed = false;
        for (CorridorWaypoint waypoint : draft.waypoints()) {
            CorridorWaypoint updatedWaypoint = waypoint;
            if (Objects.equals(waypoint.waypointId(), waypointId)) {
                updatedWaypoint = new CorridorWaypoint(waypoint.waypointId(), waypoint.memberId(), waypoint.waypointOrder(), point2x);
            }
            updatedWaypoints.add(updatedWaypoint);
            changed |= !Objects.equals(updatedWaypoint, waypoint);
        }
        return changed ? resolvedAgainst(input, withWaypoints(updatedWaypoints)) : this;
    }

    private Corridor movedDoor(GridSegment sourceBoundarySegment2x, DoorRef targetDoorRef, CorridorResolutionInput input) {
        if (sourceBoundarySegment2x == null || targetDoorRef == null) {
            return this;
        }
        CorridorResolutionInput.ExteriorDoorInput targetDoor = requiredExteriorDoor(input, targetDoorRef);
        CorridorTerminal rootTerminal = draft.rootTerminal();
        if (matchesBoundary(rootTerminal, sourceBoundarySegment2x, input)) {
            CorridorResolutionInput.ExteriorDoorInput sourceDoor = requiredDoorTerminal(input, rootTerminal);
            if (!Objects.equals(sourceDoor.roomId(), targetDoor.roomId())) {
                throw new IllegalArgumentException("Corridor door move must stay on the same room");
            }
            if (input.hasOccupiedConnection(targetDoor.anchorSegment())) {
                throw new IllegalArgumentException("Corridor door move target is already occupied");
            }
            return resolvedAgainst(input, new CorridorDraft(
                    draft.corridorId(),
                    draft.structureObjectId(),
                    draft.mapId(),
                    draft.levelZ(),
                    new CorridorTerminal.DoorTerminal(targetDoor.ref()),
                    draft.members(),
                    draft.waypoints()));
        }
        ArrayList<CorridorMember> updatedMembers = new ArrayList<>(draft.members().size());
        boolean changed = false;
        for (CorridorMember member : draft.members()) {
            CorridorMember updatedMember = member;
            if (matchesBoundary(member.terminal(), sourceBoundarySegment2x, input)) {
                CorridorResolutionInput.ExteriorDoorInput sourceDoor = requiredDoorTerminal(input, member.terminal());
                if (!Objects.equals(sourceDoor.roomId(), targetDoor.roomId())) {
                    throw new IllegalArgumentException("Corridor door move must stay on the same room");
                }
                if (input.hasOccupiedConnection(targetDoor.anchorSegment())) {
                    throw new IllegalArgumentException("Corridor door move target is already occupied");
                }
                updatedMember = new CorridorMember(member.memberId(), new CorridorTerminal.DoorTerminal(targetDoor.ref()), member.hostMemberId(), member.hostWaypointId());
            }
            updatedMembers.add(updatedMember);
            changed |= !Objects.equals(updatedMember, member);
        }
        return changed ? resolvedAgainst(input, new CorridorDraft(
                draft.corridorId(),
                draft.structureObjectId(),
                draft.mapId(),
                draft.levelZ(),
                draft.rootTerminal(),
                updatedMembers,
                draft.waypoints())) : this;
    }

    private Corridor promotedTileWaypointAndMoved(GridPoint tileCell, GridPoint point2x, CorridorResolutionInput input) {
        if (tileCell == null || point2x == null) {
            return this;
        }
        CorridorPathTrace trace = traceContainingCell(tileCell);
        if (trace == null || trace.memberId() == null) {
            throw new IllegalArgumentException("Corridor tile is not on a routable corridor segment");
        }
        CorridorWaypoint existingWaypoint = waypointAtPoint(trace.memberId(), tileCell);
        if (existingWaypoint != null) {
            return movedWaypoint(existingWaypoint.waypointId(), point2x, input);
        }
        long waypointId = nextSyntheticWaypointId();
        ArrayList<CorridorWaypoint> updatedWaypoints = shiftedWaypointsForInsert(trace.memberId(), trace.segmentOrdinal());
        updatedWaypoints.add(new CorridorWaypoint(waypointId, trace.memberId(), trace.segmentOrdinal(), point2x));
        return resolvedAgainst(input, withWaypoints(updatedWaypoints));
    }

    private Corridor attachedRoomDoorAtBoundary(
            DoorRef doorRef,
            GridSegment boundarySegment2x,
            CorridorResolutionInput input
    ) {
        if (doorRef == null || boundarySegment2x == null) {
            return this;
        }
        CorridorResolutionInput.BoundaryAttachmentInput boundary = requireInput(levelZ(), input).requiredBoundaryAttachment(boundarySegment2x);
        if (!Objects.equals(boundary.corridorId(), corridorId())) {
            throw new IllegalArgumentException("Corridor attachment target must be a free corridor wall");
        }
        CorridorPathTrace trace = traceContainingCell(boundary.corridorCell());
        if (trace == null || trace.memberId() == null) {
            throw new IllegalArgumentException("Corridor attachment target must lie on a routable corridor branch");
        }
        if (containsDoorRef(doorRef)) {
            return this;
        }
        CorridorWaypoint hostWaypoint = waypointAtPoint(trace.memberId(), boundary.corridorCell());
        ArrayList<CorridorWaypoint> updatedWaypoints = new ArrayList<>(draft.waypoints());
        if (hostWaypoint == null) {
            updatedWaypoints = shiftedWaypointsForInsert(trace.memberId(), trace.segmentOrdinal());
            hostWaypoint = new CorridorWaypoint(nextSyntheticWaypointId(), trace.memberId(), trace.segmentOrdinal(), boundary.corridorCell());
            updatedWaypoints.add(hostWaypoint);
        }
        ArrayList<CorridorMember> updatedMembers = new ArrayList<>(draft.members());
        updatedMembers.add(new CorridorMember(
                nextSyntheticMemberId(),
                new CorridorTerminal.DoorTerminal(doorRef),
                trace.memberId(),
                hostWaypoint.waypointId()));
        return resolvedAgainst(input, new CorridorDraft(
                draft.corridorId(),
                draft.structureObjectId(),
                draft.mapId(),
                draft.levelZ(),
                draft.rootTerminal(),
                updatedMembers,
                updatedWaypoints));
    }

    private Corridor resolvedAgainst(CorridorResolutionInput input, CorridorDraft updatedDraft) {
        return Corridor.fromDraft(updatedDraft, requireInput(levelZ(), input).withDoors(boundaryAtLevel(levelZ()).doors()));
    }

    private CorridorDraft withWaypoints(List<CorridorWaypoint> updatedWaypoints) {
        return new CorridorDraft(
                draft.corridorId(),
                draft.structureObjectId(),
                draft.mapId(),
                draft.levelZ(),
                draft.rootTerminal(),
                draft.members(),
                updatedWaypoints);
    }

    private CorridorPathTrace traceContainingCell(GridPoint cell) {
        if (cell == null) {
            return null;
        }
        return pathTraces.stream()
                .filter(trace -> trace != null && trace.path().cellFootprint().cells().contains(cell))
                .sorted(Comparator
                        .comparing((CorridorPathTrace trace) -> trace.memberId() == null ? Long.MAX_VALUE : trace.memberId())
                        .thenComparingInt(CorridorPathTrace::segmentOrdinal))
                .findFirst()
                .orElse(null);
    }

    private CorridorWaypoint waypointAtPoint(Long memberId, GridPoint point) {
        if (memberId == null || point == null) {
            return null;
        }
        return draft.waypoints().stream()
                .filter(waypoint -> Objects.equals(waypoint.memberId(), memberId) && Objects.equals(waypoint.point(), point))
                .findFirst()
                .orElse(null);
    }

    private boolean containsDoorRef(DoorRef doorRef) {
        if (doorRef == null) {
            return false;
        }
        if (draft.rootTerminal() instanceof CorridorTerminal.DoorTerminal rootDoor
                && Objects.equals(rootDoor.doorRef(), doorRef)) {
            return true;
        }
        return draft.members().stream()
                .map(CorridorMember::terminal)
                .filter(CorridorTerminal.DoorTerminal.class::isInstance)
                .map(CorridorTerminal.DoorTerminal.class::cast)
                .anyMatch(terminal -> Objects.equals(terminal.doorRef(), doorRef));
    }

    private ArrayList<CorridorWaypoint> shiftedWaypointsForInsert(Long memberId, int insertOrder) {
        ArrayList<CorridorWaypoint> updatedWaypoints = new ArrayList<>(draft.waypoints().size() + 1);
        for (CorridorWaypoint waypoint : draft.waypoints()) {
            if (Objects.equals(waypoint.memberId(), memberId) && waypoint.waypointOrder() >= insertOrder) {
                updatedWaypoints.add(new CorridorWaypoint(
                        waypoint.waypointId(),
                        waypoint.memberId(),
                        waypoint.waypointOrder() + 1,
                        waypoint.point()));
            } else {
                updatedWaypoints.add(waypoint);
            }
        }
        return updatedWaypoints;
    }

    private long nextSyntheticWaypointId() {
        long min = -1L;
        for (CorridorWaypoint waypoint : draft.waypoints()) {
            if (waypoint != null && waypoint.waypointId() != null) {
                min = Math.min(min, waypoint.waypointId());
            }
        }
        return min <= 0 ? min - 1 : -1L;
    }

    private long nextSyntheticMemberId() {
        long min = -1L;
        for (CorridorMember member : draft.members()) {
            if (member != null && member.memberId() != null) {
                min = Math.min(min, member.memberId());
            }
        }
        return min <= 0 ? min - 1 : -1L;
    }

    private GridPoint rootTerminalPoint(Map<DoorRef, CorridorResolutionInput.ExteriorDoorInput> originalDoorsByRef) {
        return terminalPoint(draft.rootTerminal(), originalDoorsByRef);
    }

    private GridPoint terminalPointForMember(
            CorridorMember member,
            Map<DoorRef, CorridorResolutionInput.ExteriorDoorInput> originalDoorsByRef
    ) {
        return terminalPoint(member == null ? null : member.terminal(), originalDoorsByRef);
    }

    private void validateTerminalRebind(CorridorReconcileInput input, CorridorTerminal terminal) {
        if (!(terminal instanceof CorridorTerminal.DoorTerminal doorTerminal)) {
            return;
        }
        CorridorResolutionInput.ExteriorDoorInput description = input.originalDoorsByRef().get(doorTerminal.doorRef());
        if (description == null || description.roomId() == null || !input.affectedRoomIds().contains(description.roomId())) {
            return;
        }
        if (input.translation().dzLevels() == 0 && !input.updatedDoorsByRef().containsKey(doorTerminal.doorRef())) {
            throw new IllegalArgumentException("Corridor room rewrite requires an existing exterior room door");
        }
    }

    private CorridorTerminal reboundTerminal(
            CorridorReconcileInput input,
            CorridorTerminal terminal,
            GridPoint currentPoint
    ) {
        if (!(terminal instanceof CorridorTerminal.DoorTerminal doorTerminal)) {
            return terminal;
        }
        CorridorResolutionInput.ExteriorDoorInput originalDoor = input.originalDoorsByRef().get(doorTerminal.doorRef());
        if (originalDoor == null || originalDoor.roomId() == null || !input.affectedRoomIds().contains(originalDoor.roomId())) {
            return terminal;
        }
        if (input.translation().dzLevels() != 0) {
            return new CorridorTerminal.PointTerminal(currentPoint);
        }
        CorridorResolutionInput.ExteriorDoorInput reboundDoor = input.updatedDoorsByRef().get(doorTerminal.doorRef());
        return reboundDoor == null
                ? new CorridorTerminal.PointTerminal(currentPoint)
                : new CorridorTerminal.DoorTerminal(reboundDoor.ref());
    }

    private static CorridorState deriveState(
            CorridorDraft draft,
            CorridorResolutionInput input
    ) {
        CorridorDraft resolvedDraft = normalizeDraft(Objects.requireNonNull(draft, "draft"));
        CorridorResolutionInput resolvedInput = requireInput(resolvedDraft.levelZ(), input);
        GraphState graph = deriveGraph(resolvedDraft, resolvedInput);
        DerivedProjection projection = deriveProjection(
                resolvedDraft.corridorId(),
                resolvedDraft.mapId(),
                resolvedDraft.levelZ(),
                graph.nodes(),
                graph.segments(),
                resolvedInput);
        return new CorridorState(
                projection.structure(),
                graph,
                projection.pathTraces(),
                projection.connections(),
                projection.boundaryDoorBoundary(),
                projection.roomAnchorBoundariesByRoomId());
    }

    private static CorridorState rehydratedState(
            CorridorDraft draft,
            Structure structure,
            CorridorResolutionInput input
    ) {
        CorridorDraft resolvedDraft = normalizeDraft(Objects.requireNonNull(draft, "draft"));
        CorridorResolutionInput resolvedInput = requireInput(resolvedDraft.levelZ(), input);
        Structure hydratedStructure = Objects.requireNonNull(structure, "structure");
        if (hydratedStructure.surfaceAtLevel(resolvedDraft.levelZ()).isEmpty()) {
            throw new IllegalArgumentException("Persisted corridor structure must exist at the corridor level");
        }
        GraphState graph = deriveGraph(resolvedDraft, resolvedInput);
        return new CorridorState(
                hydratedStructure,
                graph,
                CorridorRouting.recoverPathTraces(
                        hydratedStructure,
                        resolvedDraft.levelZ(),
                        graph.nodes(),
                        graph.segments()),
                materializeConnections(resolvedInput, resolvedDraft.corridorId(), resolvedDraft.mapId(), resolvedDraft.levelZ(), graph.nodes()),
                materializeBoundaryDoorBoundary(hydratedStructure, resolvedDraft.levelZ(), graph.nodes(), resolvedInput),
                materializeRoomAnchorBoundaries(graph.nodes(), resolvedInput));
    }

    private record CorridorState(
            Structure structure,
            GraphState graph,
            List<CorridorPathTrace> pathTraces,
            List<DungeonConnection> connections,
            GridBoundary boundaryDoorBoundary,
            Map<Long, GridBoundary> roomAnchorBoundariesByRoomId
    ) {
        private CorridorState {
            structure = Objects.requireNonNull(structure, "structure");
            graph = Objects.requireNonNull(graph, "graph");
            pathTraces = pathTraces == null ? List.of() : List.copyOf(pathTraces);
            connections = connections == null ? List.of() : List.copyOf(connections);
            boundaryDoorBoundary = boundaryDoorBoundary == null ? GridBoundary.empty() : boundaryDoorBoundary;
            roomAnchorBoundariesByRoomId = roomAnchorBoundariesByRoomId == null
                    ? Map.of()
                    : Map.copyOf(new LinkedHashMap<>(roomAnchorBoundariesByRoomId));
        }
    }

    private record GraphState(
            List<CorridorNode> nodes,
            List<CorridorSegment> segments
    ) {
        private GraphState {
            nodes = nodes == null ? List.of() : List.copyOf(nodes);
            segments = segments == null ? List.of() : List.copyOf(segments);
        }
    }

    private static CorridorDraft normalizeDraft(CorridorDraft draft) {
        CorridorDraft resolvedDraft = Objects.requireNonNull(draft, "draft");
        if (resolvedDraft.members().isEmpty()) {
            throw new IllegalArgumentException("Corridor draft requires at least one member");
        }
        List<CorridorMember> members = resolvedDraft.members().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(member -> member.memberId() == null ? Long.MAX_VALUE : member.memberId()))
                .toList();
        List<CorridorWaypoint> waypoints = resolvedDraft.waypoints().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing(CorridorWaypoint::memberId)
                        .thenComparingInt(CorridorWaypoint::waypointOrder)
                        .thenComparing(waypoint -> waypoint.waypointId() == null ? Long.MAX_VALUE : waypoint.waypointId()))
                .toList();
        return new CorridorDraft(
                resolvedDraft.corridorId(),
                resolvedDraft.structureObjectId(),
                resolvedDraft.mapId(),
                resolvedDraft.levelZ(),
                resolvedDraft.rootTerminal(),
                members,
                waypoints);
    }

    private static CorridorResolutionInput requireInput(int levelZ, CorridorResolutionInput input) {
        CorridorResolutionInput resolvedInput = Objects.requireNonNull(input, "input");
        if (resolvedInput.levelZ() != levelZ) {
            throw new IllegalArgumentException("Corridor resolution input level must match corridor level");
        }
        return resolvedInput;
    }

    private static GraphState deriveGraph(
            CorridorDraft draft,
            CorridorResolutionInput input
    ) {
        CorridorDraft resolvedDraft = normalizeDraft(draft);
        Map<Long, CorridorMember> membersById = indexMembers(resolvedDraft.members());
        Map<Long, CorridorWaypoint> waypointsById = indexWaypoints(resolvedDraft.waypoints());
        Map<Long, List<CorridorWaypoint>> waypointsByMemberId = waypointsByMember(resolvedDraft.waypoints());

        long rootNodeId = rootNodeId();
        LinkedHashMap<Long, CorridorNode> nodesById = new LinkedHashMap<>();
        nodesById.put(rootNodeId, terminalNode(rootNodeId, resolvedDraft.rootTerminal(), resolvedDraft.levelZ(), input));
        ArrayList<CorridorSegment> segments = new ArrayList<>();

        int rootCount = 0;
        for (CorridorMember member : resolvedDraft.members()) {
            if (member.isRoot()) {
                rootCount++;
            }
            CorridorNode terminalNode = terminalNode(memberTerminalNodeId(member), member.terminal(), resolvedDraft.levelZ(), input);
            nodesById.put(terminalNode.nodeId(), terminalNode);
            List<CorridorWaypoint> memberWaypoints = waypointsByMemberId.getOrDefault(member.memberId(), List.of());
            Long startNodeId;
            if (member.isRoot()) {
                startNodeId = rootNodeId;
            } else {
                if (!membersById.containsKey(member.hostMemberId())) {
                    throw new IllegalArgumentException("Corridor member references missing host member");
                }
                CorridorWaypoint hostWaypoint = waypointsById.get(member.hostWaypointId());
                if (hostWaypoint == null || !Objects.equals(hostWaypoint.memberId(), member.hostMemberId())) {
                    throw new IllegalArgumentException("Corridor member references missing host waypoint");
                }
                nodesById.put(hostWaypoint.waypointId(), new CorridorNode(hostWaypoint.waypointId(), hostWaypoint.point(), null));
                startNodeId = hostWaypoint.waypointId();
            }
            Long previousNodeId = startNodeId;
            for (CorridorWaypoint waypoint : memberWaypoints) {
                nodesById.put(waypoint.waypointId(), new CorridorNode(waypoint.waypointId(), waypoint.point(), null));
                segments.add(new CorridorSegment(member.memberId(), waypoint.waypointOrder(), previousNodeId, waypoint.waypointId()));
                previousNodeId = waypoint.waypointId();
            }
            segments.add(new CorridorSegment(member.memberId(), memberWaypoints.size(), previousNodeId, terminalNode.nodeId()));
        }
        if (rootCount != 1) {
            throw new IllegalArgumentException("Corridor draft requires exactly one root member");
        }
        return new GraphState(List.copyOf(nodesById.values()), List.copyOf(segments));
    }

    private static long rootNodeId() {
        return Long.MIN_VALUE + 1L;
    }

    private static long memberTerminalNodeId(CorridorMember member) {
        long id = member == null || member.memberId() == null ? -1L : member.memberId();
        return Long.MIN_VALUE + 10_000L + Math.abs(id);
    }

    private static CorridorNode terminalNode(
            Long nodeId,
            CorridorTerminal terminal,
            int levelZ,
            CorridorResolutionInput input
    ) {
        if (terminal instanceof CorridorTerminal.DoorTerminal doorTerminal) {
            GridPoint anchorPoint = requiredExteriorDoor(input, doorTerminal.doorRef()).anchorPoint();
            return new CorridorNode(nodeId, anchorPoint, doorTerminal.doorRef());
        }
        GridPoint point = ((CorridorTerminal.PointTerminal) terminal).point();
        return new CorridorNode(nodeId, point, null);
    }

    private static Map<Long, CorridorMember> indexMembers(List<CorridorMember> members) {
        LinkedHashMap<Long, CorridorMember> result = new LinkedHashMap<>();
        for (CorridorMember member : members == null ? List.<CorridorMember>of() : members) {
            if (member == null || member.memberId() == null) {
                throw new IllegalArgumentException("Corridor members require stable ids");
            }
            if (result.put(member.memberId(), member) != null) {
                throw new IllegalArgumentException("Duplicate corridor member id " + member.memberId());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, CorridorWaypoint> indexWaypoints(List<CorridorWaypoint> waypoints) {
        LinkedHashMap<Long, CorridorWaypoint> result = new LinkedHashMap<>();
        for (CorridorWaypoint waypoint : waypoints == null ? List.<CorridorWaypoint>of() : waypoints) {
            if (waypoint == null || waypoint.waypointId() == null) {
                throw new IllegalArgumentException("Corridor waypoints require stable ids");
            }
            if (result.put(waypoint.waypointId(), waypoint) != null) {
                throw new IllegalArgumentException("Duplicate corridor waypoint id " + waypoint.waypointId());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, List<CorridorWaypoint>> waypointsByMember(List<CorridorWaypoint> waypoints) {
        LinkedHashMap<Long, ArrayList<CorridorWaypoint>> result = new LinkedHashMap<>();
        for (CorridorWaypoint waypoint : waypoints == null ? List.<CorridorWaypoint>of() : waypoints) {
            result.computeIfAbsent(waypoint.memberId(), ignored -> new ArrayList<>()).add(waypoint);
        }
        LinkedHashMap<Long, List<CorridorWaypoint>> sorted = new LinkedHashMap<>();
        for (Map.Entry<Long, ArrayList<CorridorWaypoint>> entry : result.entrySet()) {
            entry.getValue().sort(Comparator
                    .comparingInt(CorridorWaypoint::waypointOrder)
                    .thenComparing(waypoint -> waypoint.waypointId() == null ? Long.MAX_VALUE : waypoint.waypointId()));
            sorted.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(sorted);
    }

    private static void validateGraph(
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            CorridorResolutionInput input,
            int levelZ
    ) {
        if (nodes == null || nodes.size() < 2) {
            throw new IllegalArgumentException("Corridor requires at least two nodes");
        }
        if (segments == null || segments.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least one segment");
        }
        Map<Long, CorridorNode> nodesById = new LinkedHashMap<>();
        LinkedHashMap<Long, Integer> degreeByNodeId = new LinkedHashMap<>();
        for (CorridorNode node : nodes) {
            if (node == null || node.nodeId() == null) {
                throw new IllegalArgumentException("Corridor graph nodes require stable ids");
            }
            nodesById.put(node.nodeId(), node);
            degreeByNodeId.put(node.nodeId(), 0);
        }
        for (CorridorSegment segment : segments) {
            if (segment == null) {
                continue;
            }
            if (!nodesById.containsKey(segment.startNodeId()) || !nodesById.containsKey(segment.endNodeId())) {
                throw new IllegalArgumentException("Corridor segment references missing node");
            }
            degreeByNodeId.computeIfPresent(segment.startNodeId(), (ignored, degree) -> degree + 1);
            degreeByNodeId.computeIfPresent(segment.endNodeId(), (ignored, degree) -> degree + 1);
        }
        Long startNodeId = null;
        for (CorridorNode node : nodes) {
            int degree = degreeByNodeId.getOrDefault(node.nodeId(), 0);
            if (degree <= 0) {
                throw new IllegalArgumentException("Corridor nodes may not be isolated");
            }
            if (node.isDoorBound()) {
                CorridorResolutionInput.ExteriorDoorInput description = requiredExteriorDoor(input, node.doorRef());
                if (description.anchorSegment().start().z() != levelZ) {
                    throw new IllegalArgumentException("Corridor door node must stay on the corridor level");
                }
                if (degree != 1) {
                    throw new IllegalArgumentException("Door-bound corridor nodes must have degree 1");
                }
            }
            if (startNodeId == null) {
                startNodeId = node.nodeId();
            }
        }
        validateConnectedGraph(segments, degreeByNodeId.keySet(), startNodeId);
    }

    private static void validateConnectedGraph(List<CorridorSegment> segments, Set<Long> nodeIds, Long startNodeId) {
        if (segments == null || segments.isEmpty() || nodeIds == null || nodeIds.isEmpty() || startNodeId == null) {
            return;
        }
        LinkedHashMap<Long, List<Long>> adjacency = new LinkedHashMap<>();
        for (Long nodeId : nodeIds) {
            adjacency.put(nodeId, new ArrayList<>());
        }
        for (CorridorSegment segment : segments) {
            adjacency.computeIfAbsent(segment.startNodeId(), ignored -> new ArrayList<>()).add(segment.endNodeId());
            adjacency.computeIfAbsent(segment.endNodeId(), ignored -> new ArrayList<>()).add(segment.startNodeId());
        }
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
        if (visitedNodeIds.size() != nodeIds.size()) {
            throw new IllegalArgumentException("Corridor graph must stay connected");
        }
    }

    private static DerivedProjection deriveProjection(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            CorridorResolutionInput input
    ) {
        CorridorResolutionInput resolvedInput = requireInput(levelZ, input);
        GridArea blockedArea = GridArea.of(resolvedInput.blockedCells());
        List<CorridorRouting.RoutedNode> routedNodes = nodes.stream()
                .map(node -> routedNode(resolvedInput, node, levelZ, blockedArea))
                .toList();
        List<CorridorRouting.RoutedLink> routedLinks = segments.stream()
                .map(segment -> new CorridorRouting.RoutedLink(
                        null,
                        segment.memberId(),
                        segment.segmentOrdinal(),
                        segment.startNodeId(),
                        segment.endNodeId()))
                .toList();
        CorridorRouting.RoutedProjection routedProjection = CorridorRouting.routeSurfaceProjection(
                levelZ,
                routedNodes,
                routedLinks,
                blockedArea);
        Structure structure = structureWithResolvedDoors(routedProjection.structure(), levelZ, resolvedInput.corridorDoors());
        return new DerivedProjection(
                structure,
                routedProjection.traces(),
                materializeConnections(resolvedInput, corridorId, mapId, levelZ, nodes),
                materializeBoundaryDoorBoundary(structure, levelZ, nodes, resolvedInput),
                materializeRoomAnchorBoundaries(nodes, resolvedInput));
    }

    private static Structure structureWithResolvedDoors(
            Structure routedStructure,
            int levelZ,
            Collection<Door> doors
    ) {
        if (routedStructure == null || routedStructure.surfaceAtLevel(levelZ).isEmpty()) {
            return Structure.empty();
        }
        StructureBoundary boundary = routedStructure.boundaryAtLevel(levelZ);
        return Structure.fromSpecification(StructureSpecification.ofLevel(
                levelZ,
                new StructureSpecification.LevelSpecification(
                        routedStructure.surfaceAtLevel(levelZ).surface().anchorCell(),
                        routedStructure.surfaceAtLevel(levelZ).surface().cellFootprint(),
                        routedStructure.surfaceAtLevel(levelZ).floor().cellFootprint(),
                        doors == null ? List.of() : List.copyOf(doors),
                        boundary.walls())));
    }

    private static CorridorRouting.RoutedNode routedNode(
            CorridorResolutionInput input,
            CorridorNode node,
            int levelZ,
            GridArea blockedCells
    ) {
        if (node == null || node.nodeId() == null) {
            throw new IllegalArgumentException("Corridor routed node requires a stable id");
        }
        return new CorridorRouting.RoutedNode(node.nodeId(), attachmentsForNode(input, node, levelZ, blockedCells));
    }

    private static List<CorridorRouting.AnchorAttachment> attachmentsForNode(
            CorridorResolutionInput input,
            CorridorNode node,
            int levelZ,
            GridArea blockedCells
    ) {
        if (node == null) {
            return List.of();
        }
        if (node.isDoorBound()) {
            CorridorResolutionInput.ExteriorDoorInput door = requiredExteriorDoor(input, node.doorRef());
            return List.of(new CorridorRouting.AnchorAttachment(
                    door.exteriorCell(),
                    List.of(door.anchorPoint(), door.exteriorCell())));
        }
        return CorridorRouting.attachmentsForPoint(node.point(), blockedCells);
    }

    private static List<DungeonConnection> materializeConnections(
            CorridorResolutionInput input,
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes
    ) {
        if (corridorId == null) {
            return List.of();
        }
        ArrayList<DungeonConnection> result = new ArrayList<>();
        for (CorridorNode node : nodes) {
            if (!node.isDoorBound()) {
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
            List<CorridorNode> nodes,
            CorridorResolutionInput input
    ) {
        StructureBoundary boundary = Objects.requireNonNull(structure, "structure").boundaryAtLevel(levelZ);
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>(boundary.doorBoundary().segments());
        for (CorridorNode node : nodes == null ? List.<CorridorNode>of() : nodes) {
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

    private static Map<Long, GridBoundary> materializeRoomAnchorBoundaries(
            List<CorridorNode> nodes,
            CorridorResolutionInput input
    ) {
        LinkedHashMap<Long, List<GridSegment>> segmentsByRoomId = new LinkedHashMap<>();
        for (CorridorNode node : nodes == null ? List.<CorridorNode>of() : nodes) {
            if (node == null || !node.isDoorBound()) {
                continue;
            }
            CorridorResolutionInput.ExteriorDoorInput description = requiredExteriorDoor(input, node.doorRef());
            if (description.roomId() == null) {
                continue;
            }
            segmentsByRoomId.computeIfAbsent(description.roomId(), ignored -> new ArrayList<>())
                    .add(description.anchorSegment());
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

    private static CorridorResolutionInput.ExteriorDoorInput requiredExteriorDoor(
            CorridorResolutionInput input,
            DoorRef doorRef
    ) {
        return Objects.requireNonNull(input, "input").requiredExteriorDoor(doorRef);
    }

    private static CorridorResolutionInput.ExteriorDoorInput requiredDoorTerminal(
            CorridorResolutionInput input,
            CorridorTerminal terminal
    ) {
        if (!(terminal instanceof CorridorTerminal.DoorTerminal doorTerminal)) {
            throw new IllegalArgumentException("Corridor terminal must reference a room door");
        }
        return requiredExteriorDoor(input, doorTerminal.doorRef());
    }

    private static boolean matchesBoundary(
            CorridorTerminal terminal,
            GridSegment boundarySegment,
            CorridorResolutionInput input
    ) {
        return terminal instanceof CorridorTerminal.DoorTerminal doorTerminal
                && Objects.equals(requiredExteriorDoor(input, doorTerminal.doorRef()).anchorSegment(), boundarySegment);
    }

    private static GridPoint terminalPoint(
            CorridorTerminal terminal,
            Map<DoorRef, CorridorResolutionInput.ExteriorDoorInput> doorsByRef
    ) {
        if (terminal instanceof CorridorTerminal.PointTerminal pointTerminal) {
            return pointTerminal.point();
        }
        if (terminal instanceof CorridorTerminal.DoorTerminal doorTerminal) {
            CorridorResolutionInput.ExteriorDoorInput description = doorsByRef == null ? null : doorsByRef.get(doorTerminal.doorRef());
            return description == null ? null : description.anchorPoint();
        }
        return null;
    }

    private record DerivedProjection(
            Structure structure,
            List<CorridorPathTrace> pathTraces,
            List<DungeonConnection> connections,
            GridBoundary boundaryDoorBoundary,
            Map<Long, GridBoundary> roomAnchorBoundariesByRoomId
    ) {
    }
}
