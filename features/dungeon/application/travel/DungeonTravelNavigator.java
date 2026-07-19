package features.dungeon.application.travel;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonTravelRejectionReason;
import features.dungeon.application.travel.projection.TravelActionFacts;
import features.dungeon.application.travel.projection.TravelActionKind;
import features.dungeon.application.travel.projection.TravelAuthoredSurface;
import features.dungeon.application.travel.projection.TravelAuthoredSurface.Transition;
import features.dungeon.application.travel.projection.TravelDungeonSessionProjectionMapper;
import features.dungeon.application.travel.projection.TravelHeading;
import features.dungeon.application.travel.projection.TravelPositionFacts;
import features.dungeon.application.travel.projection.TravelSurfaceFacts;
import features.dungeon.application.travel.projection.TravelSurfaceProjection;
import features.dungeon.application.travel.projection.TravelTransitionTarget;
import features.dungeon.application.travel.session.TravelDungeonActiveState;
import features.dungeon.application.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import features.dungeon.application.travel.session.TravelDungeonActiveState.PartyLocationData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.AreaData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.BoundaryData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.FeatureData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.FeatureKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.MapData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.OverworldTarget;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.PositionData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.SurfaceData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.TopologyKind;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.party.api.MutationResult;
import features.party.api.MutationStatus;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletionStage;
import org.jspecify.annotations.Nullable;

public final class DungeonTravelNavigator {
    private static final String TRAVEL_ACTION_COMPLETE = "Reiseaktion ausgefuehrt.";
    private static final String DIRECT_MOVE_COMPLETE = "Direkte Bewegung ausgefuehrt.";
    private static final String DUNGEON_TRANSITION_USED = "Übergang benutzt.";
    private static final String MOVING = "Bewegung wird ausgeführt.";

    private final DungeonTravelAuthoredReader authoredReader;
    private final DungeonTravelPartyGateway partyGateway;
    private final DungeonTravelSurfaceLoader surfaceLoader;
    private final TravelSurfaceProjection projector = new TravelSurfaceProjection();

    public DungeonTravelNavigator(
            DungeonTravelAuthoredReader authoredReader,
            DungeonTravelPartyGateway partyGateway,
            DungeonTravelSurfaceLoader surfaceLoader
    ) {
        this.authoredReader = Objects.requireNonNull(authoredReader, "authoredReader");
        this.partyGateway = Objects.requireNonNull(partyGateway, "partyGateway");
        this.surfaceLoader = Objects.requireNonNull(surfaceLoader, "surfaceLoader");
    }

    MovePlan validate(
            @Nullable PositionData requestedTravelPosition,
            @Nullable SurfaceData currentSurface,
            DungeonTravelMoveCommand command
    ) {
        ActiveTravelStateData activeTravel = partyGateway.loadActiveTravelState();
        PositionData effectivePosition = TravelDungeonActiveState.effectiveTravelPosition(
                requestedTravelPosition, activeTravel.partyLocation());
        SurfaceData fallback = safeOrigin(currentSurface, effectivePosition);
        if (effectivePosition == null) {
            return MovePlan.rejected(
                    fallback, activeTravel, DungeonTravelRejectionReason.NO_ACTIVE_POSITION);
        }
        DungeonTravelAuthoredReadResult readResult = authoredReader.readCurrentPosition(
                TravelDungeonSessionProjectionMapper.toRuntimePositionFacts(effectivePosition));
        if (!(readResult instanceof DungeonTravelAuthoredReadResult.Loaded loaded)) {
            return MovePlan.rejected(
                    fallback, activeTravel, DungeonTravelRejectionReason.AUTHORED_UNAVAILABLE);
        }
        TravelAuthoredSurface authoredSurface = loaded.surface();
        TravelPositionFacts position = TravelDungeonSessionProjectionMapper.toRuntimePositionFacts(effectivePosition);
        SurfaceData origin = runtimeSurface(projector.project(authoredSurface, position, ""));
        if (command instanceof DungeonTravelMoveCommand.Action action) {
            return resolveAction(authoredSurface, position, origin, activeTravel, action);
        }
        DungeonTravelMoveCommand.Direct direct = (DungeonTravelMoveCommand.Direct) command;
        return resolveDirect(authoredSurface, position, origin, activeTravel, direct.target());
    }

    @Nullable MovePlan initialize(SurfaceData surface, boolean forceMove) {
        if (surface == null || surface.contextKind().isOverworld()) {
            return null;
        }
        ActiveTravelStateData activeTravel = partyGateway.loadActiveTravelState();
        if (activeTravel.travelCharacterIds().isEmpty()) {
            return null;
        }
        PartyLocationData location = activeTravel.partyLocation();
        if (!forceMove && location != null) {
            return null;
        }
        if (matchesDungeonPosition(location, surface.position())) {
            return null;
        }
        return MovePlan.accepted(
                surface,
                surface.position(),
                null,
                activeTravel,
                TRAVEL_ACTION_COMPLETE);
    }

    CompletionStage<MutationResult> execute(MovePlan plan) {
        if (plan.dungeonTarget() != null) {
            return partyGateway.moveDungeonPosition(
                    plan.dungeonTarget(), plan.activeTravel().travelCharacterIds());
        }
        return partyGateway.moveOverworldPosition(
                plan.overworldTarget(), plan.activeTravel().travelCharacterIds());
    }

    Resolution resolve(
            MovePlan plan,
            @Nullable MutationResult mutation,
            @Nullable Throwable failure
    ) {
        if (failure != null || mutation == null) {
            return Resolution.rejected(
                    rejectedSurface(plan.originSurface(), DungeonTravelRejectionReason.PARTY_FAILURE),
                    DungeonTravelRejectionReason.PARTY_FAILURE,
                    currentPartyRevision());
        }
        if (mutation.status() != MutationStatus.SUCCESS) {
            DungeonTravelRejectionReason reason = mutation.status() == MutationStatus.STORAGE_ERROR
                    ? DungeonTravelRejectionReason.PARTY_STORAGE_FAILURE
                    : DungeonTravelRejectionReason.PARTY_REJECTED;
            return Resolution.rejected(
                    rejectedSurface(plan.originSurface(), reason),
                    reason,
                    currentPartyRevision());
        }
        ActiveTravelStateData committed = partyGateway.loadActiveTravelState();
        if (committed.positionRevision() <= plan.activeTravel().positionRevision()
                || !matchesTarget(plan, committed.partyLocation())) {
            return Resolution.rejected(
                    rejectedSurface(plan.originSurface(), DungeonTravelRejectionReason.STALE_PARTY_POSITION),
                    DungeonTravelRejectionReason.STALE_PARTY_POSITION,
                    committed.positionRevision());
        }
        SurfaceData refreshed = surfaceLoader.loadCommittedPosition();
        return Resolution.accepted(
                withStatus(refreshed, plan.successStatus(), refreshed.navigationEnabled()),
                committed.positionRevision());
    }

    SurfaceData movingSurface(MovePlan plan) {
        return withStatus(plan.originSurface(), MOVING, false);
    }

    SurfaceData rejectedSurface(MovePlan plan) {
        return rejectedSurface(plan.originSurface(), plan.rejectionReason());
    }

    long currentPartyRevision() {
        return partyGateway.loadActiveTravelState().positionRevision();
    }

    private MovePlan resolveAction(
            TravelAuthoredSurface authoredSurface,
            TravelPositionFacts position,
            SurfaceData origin,
            ActiveTravelStateData activeTravel,
            DungeonTravelMoveCommand.Action command
    ) {
        TravelSurfaceFacts currentFacts = projector.project(authoredSurface, position, "");
        java.util.Optional<TravelActionFacts> action = currentFacts.action(command.actionId());
        if (action.isEmpty()) {
            return MovePlan.rejected(
                    origin, activeTravel, DungeonTravelRejectionReason.ACTION_UNAVAILABLE);
        }
        TravelActionFacts selected = action.get();
        if (selected.kind() == TravelActionKind.TRAVERSAL) {
            TravelPositionFacts target = selected.targetPosition();
            return target == null
                    ? MovePlan.rejected(origin, activeTravel, DungeonTravelRejectionReason.AUTHORED_UNAVAILABLE)
                    : MovePlan.accepted(
                            origin,
                            runtimePosition(target),
                            null,
                            activeTravel,
                            TRAVEL_ACTION_COMPLETE);
        }
        return resolveTransition(authoredSurface, position, origin, activeTravel, selected.transitionTarget());
    }

    private MovePlan resolveTransition(
            TravelAuthoredSurface authoredSurface,
            TravelPositionFacts position,
            SurfaceData origin,
            ActiveTravelStateData activeTravel,
            TravelTransitionTarget target
    ) {
        if (target == null || target.isAbsent()) {
            return MovePlan.rejected(
                    origin, activeTravel, DungeonTravelRejectionReason.TRANSITION_UNAVAILABLE);
        }
        if (target.isOverworldTileTarget()) {
            return MovePlan.accepted(
                    origin,
                    null,
                    new OverworldTarget(target.mapId(), target.tileId()),
                    activeTravel,
                    "Übergang führt zum Overworld-Feld " + target.tileId() + ".");
        }
        if (!target.isDungeonMapTarget() || !target.hasTransitionId()) {
            return MovePlan.rejected(
                    origin, activeTravel, DungeonTravelRejectionReason.TRANSITION_UNAVAILABLE);
        }
        DungeonTravelAuthoredReadResult readResult = authoredReader.readExactTransitionTarget(target);
        TravelAuthoredSurface targetSurface = readResult instanceof DungeonTravelAuthoredReadResult.Loaded loaded
                ? loaded.surface()
                : null;
        Transition transition = targetSurface == null
                ? null
                : targetSurface.transition(target.transitionId());
        if (transition == null || transition.anchor() == null) {
            return MovePlan.rejected(
                    origin, activeTravel, DungeonTravelRejectionReason.TRANSITION_UNAVAILABLE);
        }
        return MovePlan.accepted(
                origin,
                new PositionData(
                        targetSurface.header().mapId(),
                        LocationKind.TRANSITION,
                        transition.transitionId(),
                        transition.anchor(),
                        position.heading()),
                null,
                activeTravel,
                DUNGEON_TRANSITION_USED);
    }

    private MovePlan resolveDirect(
            TravelAuthoredSurface authoredSurface,
            TravelPositionFacts position,
            SurfaceData origin,
            ActiveTravelStateData activeTravel,
            @Nullable DungeonCellRef requestedTarget
    ) {
        if (requestedTarget == null) {
            return MovePlan.rejected(origin, activeTravel, DungeonTravelRejectionReason.INVALID_INPUT);
        }
        Cell target = new Cell(requestedTarget.q(), requestedTarget.r(), requestedTarget.level());
        if (target.equals(position.tile())) {
            return MovePlan.rejected(origin, activeTravel, DungeonTravelRejectionReason.INVALID_INPUT);
        }
        if (!isLoaded(authoredSurface, requestedTarget)) {
            return MovePlan.rejected(origin, activeTravel, DungeonTravelRejectionReason.OFF_WINDOW);
        }
        DirectReachability reachability = new DirectReachability(authoredSurface.map(), position.tile());
        if (!reachability.traversable(target)) {
            return MovePlan.rejected(origin, activeTravel, DungeonTravelRejectionReason.NON_TRAVERSABLE);
        }
        if (!reachability.reachable(target)) {
            return MovePlan.rejected(origin, activeTravel, DungeonTravelRejectionReason.UNREACHABLE);
        }
        return MovePlan.accepted(
                origin,
                new PositionData(
                        authoredSurface.header().mapId(),
                        LocationKind.TILE,
                        areaIdAt(authoredSurface.map(), target),
                        target,
                        position.heading()),
                null,
                activeTravel,
                DIRECT_MOVE_COMPLETE);
    }

    private static boolean isLoaded(TravelAuthoredSurface surface, DungeonCellRef target) {
        DungeonChunkKey targetChunk = DungeonChunkKey.containing(surface.header().mapId(), target);
        return surface.loadedChunks().contains(targetChunk);
    }

    private static long areaIdAt(MapData map, Cell target) {
        for (AreaData area : map.areas()) {
            if (area.cells().contains(target)) {
                return area.id();
            }
        }
        return 0L;
    }

    private static boolean matchesTarget(MovePlan plan, @Nullable PartyLocationData location) {
        if (plan.dungeonTarget() != null) {
            return matchesDungeonPosition(location, plan.dungeonTarget());
        }
        return location != null
                && location.outsideDungeon()
                && plan.overworldTarget() != null
                && location.overworldMapId() == plan.overworldTarget().mapId()
                && location.overworldTileId() == plan.overworldTarget().tileId();
    }

    private static boolean matchesDungeonPosition(
            @Nullable PartyLocationData location,
            PositionData target
    ) {
        return location != null
                && !location.outsideDungeon()
                && target.equals(location.dungeonPosition());
    }

    private SurfaceData safeOrigin(
            @Nullable SurfaceData currentSurface,
            @Nullable PositionData position
    ) {
        if (currentSurface != null) {
            return currentSurface;
        }
        return position == null
                ? TravelDungeonSessionSurface.outsideDungeonSurface(0L)
                : surfaceLoader.currentSurface(position);
    }

    private static SurfaceData rejectedSurface(
            SurfaceData origin,
            DungeonTravelRejectionReason reason
    ) {
        return withStatus(origin, rejectionStatus(reason), origin.navigationEnabled());
    }

    private static String rejectionStatus(DungeonTravelRejectionReason reason) {
        return switch (reason) {
            case INVALID_INPUT -> "Reiseziel ist ungültig.";
            case NO_ACTIVE_POSITION -> "Keine aktive Dungeon-Position verfügbar.";
            case ACTION_UNAVAILABLE -> "Aktion ist nicht verfügbar.";
            case AUTHORED_UNAVAILABLE -> "Dungeon-Ziel ist nicht verfügbar.";
            case TRANSITION_UNAVAILABLE -> "Übergangsziel ist nicht verfügbar.";
            case OFF_WINDOW -> "Reiseziel liegt außerhalb des geladenen Bereichs.";
            case NON_TRAVERSABLE -> "Reiseziel ist nicht begehbar.";
            case UNREACHABLE -> "Reiseziel ist nicht erreichbar.";
            case PARTY_REJECTED -> "Party hat die Bewegung abgelehnt.";
            case PARTY_STORAGE_FAILURE -> "Party-Position konnte nicht gespeichert werden.";
            case PARTY_FAILURE -> "Party-Bewegung ist fehlgeschlagen.";
            case STALE_PARTY_POSITION -> "Party-Position passt nicht mehr zur Bewegung.";
            case NONE -> "";
        };
    }

    private static SurfaceData withStatus(SurfaceData surface, String status, boolean navigationEnabled) {
        return new SurfaceData(
                surface.contextKind(),
                surface.mapName(),
                surface.revision(),
                surface.map(),
                surface.position(),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                status,
                surface.visualDescription(),
                surface.actions(),
                navigationEnabled);
    }

    private static SurfaceData runtimeSurface(TravelSurfaceFacts facts) {
        return TravelDungeonSessionProjectionMapper.toRuntimeSurface(facts);
    }

    private static PositionData runtimePosition(TravelPositionFacts position) {
        return new PositionData(
                position.mapId(),
                position.locationKind(),
                position.ownerId(),
                position.tile(),
                position.heading());
    }

    record MovePlan(
            boolean accepted,
            SurfaceData originSurface,
            @Nullable PositionData dungeonTarget,
            @Nullable OverworldTarget overworldTarget,
            ActiveTravelStateData activeTravel,
            DungeonTravelRejectionReason rejectionReason,
            String successStatus
    ) {
        MovePlan {
            originSurface = Objects.requireNonNull(originSurface, "originSurface");
            activeTravel = Objects.requireNonNull(activeTravel, "activeTravel");
            rejectionReason = rejectionReason == null ? DungeonTravelRejectionReason.NONE : rejectionReason;
            successStatus = successStatus == null ? "" : successStatus;
        }

        private static MovePlan accepted(
                SurfaceData origin,
                @Nullable PositionData dungeonTarget,
                @Nullable OverworldTarget overworldTarget,
                ActiveTravelStateData activeTravel,
                String successStatus
        ) {
            return new MovePlan(
                    true, origin, dungeonTarget, overworldTarget, activeTravel,
                    DungeonTravelRejectionReason.NONE, successStatus);
        }

        private static MovePlan rejected(
                SurfaceData origin,
                ActiveTravelStateData activeTravel,
                DungeonTravelRejectionReason reason
        ) {
            return new MovePlan(false, origin, null, null, activeTravel, reason, "");
        }
    }

    record Resolution(
            boolean accepted,
            SurfaceData surface,
            DungeonTravelRejectionReason rejectionReason,
            long partyPositionRevision
    ) {
        Resolution {
            surface = Objects.requireNonNull(surface, "surface");
            rejectionReason = rejectionReason == null ? DungeonTravelRejectionReason.NONE : rejectionReason;
            partyPositionRevision = Math.max(0L, partyPositionRevision);
        }

        private static Resolution accepted(SurfaceData surface, long revision) {
            return new Resolution(true, surface, DungeonTravelRejectionReason.NONE, revision);
        }

        private static Resolution rejected(
                SurfaceData surface,
                DungeonTravelRejectionReason reason,
                long revision
        ) {
            return new Resolution(false, surface, reason, revision);
        }
    }

    private static final class DirectReachability {
        private final MapData map;
        private final Cell origin;
        private final Set<Cell> traversable;
        private final Set<DungeonBoundaryKey> blockedEdges;

        private DirectReachability(MapData map, Cell origin) {
            this.map = map;
            this.origin = origin;
            traversable = traversableCells(map, origin);
            blockedEdges = blockedEdges(map.boundaries());
        }

        private boolean traversable(Cell target) {
            return target.level() == origin.level() && traversable.contains(target);
        }

        private boolean reachable(Cell target) {
            ArrayDeque<Cell> pending = new ArrayDeque<>();
            Set<Cell> visited = new HashSet<>();
            pending.add(origin);
            visited.add(origin);
            while (!pending.isEmpty()) {
                Cell current = pending.removeFirst();
                if (current.equals(target)) {
                    return true;
                }
                for (Cell neighbor : neighbors(current, map.topology())) {
                    if (traversable.contains(neighbor)
                            && !blocked(current, neighbor)
                            && visited.add(neighbor)) {
                        pending.addLast(neighbor);
                    }
                }
            }
            return false;
        }

        private boolean blocked(Cell from, Cell to) {
            if (from.level() != to.level()) {
                return true;
            }
            for (Direction direction : Direction.values()) {
                if (direction.neighborOf(from).equals(to)) {
                    return blockedEdges.contains(DungeonBoundaryKey.from(direction.edgeOf(from)));
                }
            }
            return false;
        }

        private static Set<Cell> traversableCells(MapData map, Cell origin) {
            Set<Cell> cells = new HashSet<>();
            for (AreaData area : map.areas()) {
                cells.addAll(area.cells());
            }
            for (FeatureData feature : map.features()) {
                if (feature.kind() == FeatureKind.STAIR || feature.kind() == FeatureKind.TRANSITION) {
                    cells.removeAll(feature.cells());
                }
            }
            cells.add(origin);
            return Set.copyOf(cells);
        }

        private static Set<DungeonBoundaryKey> blockedEdges(List<BoundaryData> boundaries) {
            Set<DungeonBoundaryKey> result = new HashSet<>();
            for (BoundaryData boundary : boundaries) {
                result.add(DungeonBoundaryKey.from(boundary.edge()));
            }
            return Set.copyOf(result);
        }

        private static List<Cell> neighbors(Cell cell, TopologyKind topology) {
            if (topology == TopologyKind.HEX) {
                return List.of(
                        cell.translate(1, 0),
                        cell.translate(1, -1),
                        cell.translate(0, -1),
                        cell.translate(-1, 0),
                        cell.translate(-1, 1),
                        cell.translate(0, 1));
            }
            return java.util.Arrays.stream(Direction.values())
                    .map(direction -> direction.neighborOf(cell))
                    .toList();
        }
    }
}
