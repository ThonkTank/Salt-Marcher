package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionKind;
import src.domain.dungeon.model.runtime.travel.projection.TravelDungeonSessionProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelHeading;
import src.domain.dungeon.model.runtime.travel.projection.TravelPositionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceProjection;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelTransitionTarget;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionMovement.MoveResultData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.MoveStatus;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.OverworldTarget;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonTransition;
import src.domain.dungeon.model.worldspace.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase;

public final class MoveDungeonTravelActionUseCase {
    private static final String TRAVEL_ACTION_COMPLETE = "Reiseaktion ausgefuehrt.";
    private static final String DUNGEON_TRANSITION_USED = "Übergang benutzt.";

    public static final class Input {
        private final @Nullable TravelPositionFacts position;
        private final String actionId;

        public Input(
                @Nullable TravelPositionFacts position,
                String actionId
        ) {
            this.position = position;
            this.actionId = actionId == null ? "" : actionId.trim();
        }

        public @Nullable TravelPositionFacts position() {
            return position;
        }

        public String actionId() {
            return actionId;
        }
    }

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final DungeonMapRepository repository;
    private final BuildDungeonDerivedStateUseCase deriveState;
    private final TravelSurfaceProjection projector = new TravelSurfaceProjection();

    public MoveDungeonTravelActionUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            DungeonMapRepository repository,
            BuildDungeonDerivedStateUseCase deriveState
    ) {
        this.loadDungeonMap = Objects.requireNonNull(loadDungeonMap, "loadDungeonMap");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.deriveState = Objects.requireNonNull(deriveState, "deriveState");
    }

    public MoveResultData execute(Input input) {
        TravelPositionFacts position = input == null ? null : input.position();
        String actionId = input == null ? "" : input.actionId();
        DungeonMap currentMap = loadMap(position);
        DungeonDerivedState currentDerived = deriveState.execute(currentMap);
        return new MoveResolver(currentMap, currentDerived, position).move(actionId);
    }

    private DungeonMap loadMap(@Nullable TravelPositionFacts position) {
        return position == null
                ? loadDungeonMap.execute()
                : loadDungeonMap.execute(new DungeonMapIdentity(position.mapId()));
    }

    private final class MoveResolver {
        private final DungeonMap currentMap;
        private final DungeonDerivedState currentDerived;
        private final @Nullable TravelPositionFacts requestedPosition;
        private final TravelSurfaceFacts currentSurface;

        private MoveResolver(
                DungeonMap currentMap,
                DungeonDerivedState currentDerived,
                @Nullable TravelPositionFacts requestedPosition
        ) {
            this.currentMap = currentMap;
            this.currentDerived = currentDerived;
            this.requestedPosition = requestedPosition;
            this.currentSurface = projectSurface(currentMap, currentDerived, requestedPosition, "");
        }

        private MoveResultData move(String actionId) {
            TravelActionFacts action = currentSurface.action(actionId);
            if (action == null) {
                return new MoveResultData(
                        MoveStatus.INVALID_ACTION,
                        TravelDungeonSessionProjectionMapper.toRuntimeSurface(
                                projectCurrentMap(requestedPosition, "Aktion ist nicht verfügbar.")),
                        null);
            }
            if (action.kind() == TravelActionKind.TRAVERSAL) {
                return moveTraversal(action);
            }
            return moveTransition(action);
        }

        private MoveResultData moveTraversal(TravelActionFacts action) {
            TravelPositionFacts target = action.targetPosition();
            if (target == null) {
                return unavailableFromCurrent("Reiseziel ist nicht verfügbar.");
            }
            TravelSurfaceFacts surface = projectCurrentMap(target, TRAVEL_ACTION_COMPLETE);
            return new MoveResultData(
                    MoveStatus.SUCCESS,
                    TravelDungeonSessionProjectionMapper.toRuntimeSurface(surface),
                    null);
        }

        private MoveResultData moveTransition(TravelActionFacts action) {
            TravelTransitionTarget target = action.transitionTarget();
            if (target == null) {
                return unavailableFromCurrent("Übergangsziel ist nicht verfügbar.");
            }
            if (target.isOverworldTileTarget()) {
                return moveToOverworldTransition(target);
            }
            if (target.isDungeonMapTarget()) {
                return moveToDungeonTransition(target);
            }
            return unavailableFromCurrent("Übergangsziel ist nicht verfügbar.");
        }

        private MoveResultData moveToOverworldTransition(TravelTransitionTarget target) {
            TravelSurfaceFacts surface = projectCurrentMap(
                    currentSurface.position(),
                    "Übergang führt zum Overworld-Feld " + target.tileId() + ".");
            return new MoveResultData(
                    MoveStatus.EXTERNAL_TARGET,
                    TravelDungeonSessionProjectionMapper.toRuntimeSurface(surface),
                    new OverworldTarget(target.mapId(), target.tileId()));
        }

        private MoveResultData moveToDungeonTransition(
                TravelTransitionTarget target
        ) {
            if (!target.hasTransitionId()) {
                return unavailableFromCurrent("Ziel-Übergang ist noch nicht platziert.");
            }
            ResolvedDungeonTransition resolvedTransition = resolveTransitionTarget(target);
            if (!resolvedTransition.available()) {
                return unavailableFromCurrent("Ziel-Übergang ist nicht verfügbar.");
            }
            DungeonMap targetMap = resolvedTransition.mapOrThrow();
            TravelSurfaceFacts surface = projectSurface(
                    targetMap,
                    deriveState.execute(targetMap),
                    resolvedTransition.position(currentSurface.position().heading()),
                    DUNGEON_TRANSITION_USED);
            return new MoveResultData(
                    MoveStatus.SUCCESS,
                    TravelDungeonSessionProjectionMapper.toRuntimeSurface(surface),
                    null);
        }

        private ResolvedDungeonTransition resolveTransitionTarget(TravelTransitionTarget target) {
            DungeonMap targetMap = repository.findById(new DungeonMapIdentity(target.mapId())).orElse(null);
            DungeonTransition targetTransition =
                    targetMap == null
                            ? null
                            : DungeonTravelMoveResolverSupport.findTransition(targetMap, target.transitionId());
            return new ResolvedDungeonTransition(targetMap, targetTransition);
        }

        private MoveResultData unavailableFromCurrent(String statusLabel) {
            TravelSurfaceFacts surface = projectCurrentMap(requestedPosition, statusLabel);
            return new MoveResultData(
                    MoveStatus.TARGET_UNAVAILABLE,
                    TravelDungeonSessionProjectionMapper.toRuntimeSurface(surface),
                    null);
        }

        private TravelSurfaceFacts projectCurrentMap(
                @Nullable TravelPositionFacts position,
                String statusLabel
        ) {
            return projectSurface(currentMap, currentDerived, position, statusLabel);
        }

        private TravelSurfaceFacts projectSurface(
                DungeonMap map,
                DungeonDerivedState derived,
                @Nullable TravelPositionFacts position,
                String statusLabel
        ) {
            return projector.project(
                    map,
                    derived,
                    position,
                    statusLabel);
        }

    }

    private record ResolvedDungeonTransition(
            @Nullable DungeonMap map,
            @Nullable DungeonTransition transition
    ) {
        private boolean available() {
            return map != null && transition != null && transition.anchor() != null;
        }

        private DungeonMap mapOrThrow() {
            return Objects.requireNonNull(map, "map");
        }

        private TravelPositionFacts position(TravelHeading heading) {
            DungeonTransition safeTransition = Objects.requireNonNull(transition, "transition");
            return new TravelPositionFacts(
                    mapOrThrow().metadata().mapId().value(),
                    TravelPositionFacts.LocationKind.TRANSITION,
                    safeTransition.transitionId(),
                    coreCell(safeTransition.anchor()),
                    heading);
        }

        private Cell coreCell(src.domain.dungeon.model.worldspace.DungeonCell cell) {
            return cell == null ? new Cell(0, 0, 0) : new Cell(cell.q(), cell.r(), cell.level());
        }
    }
}
