package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.DungeonMap;
import src.domain.dungeon.model.worldspace.model.DungeonTransition;
import src.domain.dungeon.model.worldspace.model.DungeonTravelSurfaceProjection;
import src.domain.dungeon.model.worldspace.model.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.model.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.model.DungeonTransitionDestination;
import src.domain.dungeon.model.worldspace.model.DungeonTravelActionFacts;
import src.domain.dungeon.model.worldspace.model.DungeonTravelActionKind;
import src.domain.dungeon.model.worldspace.model.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.model.worldspace.model.DungeonTravelHeading;
import src.domain.dungeon.model.worldspace.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.worldspace.model.DungeonTravelMoveStatus;
import src.domain.dungeon.model.worldspace.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.worldspace.model.DungeonTravelSurfaceFacts;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;

public final class MoveDungeonTravelActionUseCase {
    private static final String TRAVEL_ACTION_COMPLETE = "Reiseaktion ausgefuehrt.";
    private static final String DUNGEON_TRANSITION_USED = "Übergang benutzt.";

    public static final class Input {
        private final @Nullable DungeonTravelPositionFacts position;
        private final String actionId;

        public Input(
                @Nullable DungeonTravelPositionFacts position,
                String actionId
        ) {
            this.position = position;
            this.actionId = actionId == null ? "" : actionId.trim();
        }

        public @Nullable DungeonTravelPositionFacts position() {
            return position;
        }

        public String actionId() {
            return actionId;
        }
    }

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final DungeonMapRepository repository;
    private final BuildDungeonDerivedStateUseCase deriveState;
    private final DungeonTravelSurfaceProjection projector = new DungeonTravelSurfaceProjection();

    public MoveDungeonTravelActionUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            DungeonMapRepository repository,
            BuildDungeonDerivedStateUseCase deriveState
    ) {
        this.loadDungeonMap = Objects.requireNonNull(loadDungeonMap, "loadDungeonMap");
        this.repository = Objects.requireNonNull(repository, "repository");
        this.deriveState = Objects.requireNonNull(deriveState, "deriveState");
    }

    public DungeonTravelMoveFacts execute(Input input) {
        DungeonTravelPositionFacts position = input == null ? null : input.position();
        String actionId = input == null ? "" : input.actionId();
        DungeonMap currentMap = loadMap(position);
        DungeonDerivedState currentDerived = deriveState.execute(currentMap);
        return new MoveResolver(currentMap, currentDerived, position).move(actionId);
    }

    private DungeonMap loadMap(@Nullable DungeonTravelPositionFacts position) {
        return position == null
                ? loadDungeonMap.execute()
                : loadDungeonMap.execute(position.mapId());
    }

    private final class MoveResolver {
        private final DungeonMap currentMap;
        private final DungeonDerivedState currentDerived;
        private final DungeonTravelPositionFacts requestedPosition;
        private final DungeonTravelSurfaceFacts currentSurface;

        private MoveResolver(
                DungeonMap currentMap,
                DungeonDerivedState currentDerived,
                @Nullable DungeonTravelPositionFacts requestedPosition
        ) {
            this.currentMap = currentMap;
            this.currentDerived = currentDerived;
            this.requestedPosition = requestedPosition;
            this.currentSurface = projector.project(currentMap, currentDerived, requestedPosition, "");
        }

        private DungeonTravelMoveFacts move(String actionId) {
            DungeonTravelActionFacts action = DungeonTravelMoveResolverSupport.findAction(currentSurface, actionId);
            if (action == null) {
                return DungeonTravelMoveResolverSupport.moveResult(
                        DungeonTravelMoveStatus.INVALID_ACTION,
                        "Aktion ist nicht verfügbar.",
                        currentSurface,
                        null);
            }
            if (action.kind() == DungeonTravelActionKind.TRAVERSAL) {
                return moveTraversal(action);
            }
            return moveTransition(action);
        }

        private DungeonTravelMoveFacts moveTraversal(DungeonTravelActionFacts action) {
            DungeonTravelPositionFacts target = action.targetPosition();
            if (target == null) {
                return unavailableFromCurrent("Reiseziel ist nicht verfügbar.");
            }
            DungeonTravelSurfaceFacts surface = projectCurrentMap(target, TRAVEL_ACTION_COMPLETE);
            return DungeonTravelMoveResolverSupport.moveResult(
                    DungeonTravelMoveStatus.SUCCESS,
                    TRAVEL_ACTION_COMPLETE,
                    surface,
                    null);
        }

        private DungeonTravelMoveFacts moveTransition(DungeonTravelActionFacts action) {
            DungeonTransitionDestination destination = action.transitionDestination();
            if (destination == null) {
                return unavailableFromCurrent("Übergangsziel ist nicht verfügbar.");
            }
            if (destination.isOverworldTileDestination()) {
                return moveToOverworldTransition(destination);
            }
            if (destination.isDungeonMapDestination()) {
                return moveToDungeonTransition(destination);
            }
            return unavailableFromCurrent("Übergangsziel ist nicht verfügbar.");
        }

        private DungeonTravelMoveFacts moveToOverworldTransition(DungeonTransitionDestination destination) {
            DungeonTravelSurfaceFacts surface = projectCurrentMap(
                    currentSurface.position(),
                    "Übergang führt zum Overworld-Feld " + destination.tileId() + ".");
            return DungeonTravelMoveResolverSupport.moveResult(
                    DungeonTravelMoveStatus.EXTERNAL_TARGET,
                    surface.statusLabel(),
                    surface,
                    DungeonTravelExternalTargetFacts.overworldTile(destination.mapId(), destination.tileId()));
        }

        private DungeonTravelMoveFacts moveToDungeonTransition(
                DungeonTransitionDestination destination
        ) {
            if (destination.transitionId() == null) {
                return unavailableFromCurrent("Ziel-Übergang ist noch nicht platziert.");
            }
            DungeonTransitionTarget target = resolveTransitionTarget(destination);
            if (!target.available()) {
                return unavailableFromCurrent("Ziel-Übergang ist nicht verfügbar.");
            }
            DungeonMap targetMap = target.mapOrThrow();
            DungeonTravelSurfaceFacts surface = projector.project(
                    targetMap,
                    deriveState.execute(targetMap),
                    target.position(currentSurface.position().heading()),
                    DUNGEON_TRANSITION_USED);
            return DungeonTravelMoveResolverSupport.moveResult(
                    DungeonTravelMoveStatus.SUCCESS,
                    DUNGEON_TRANSITION_USED,
                    surface,
                    null);
        }

        private DungeonTransitionTarget resolveTransitionTarget(DungeonTransitionDestination destination) {
            DungeonMap targetMap = repository.findById(new DungeonMapIdentity(destination.mapId())).orElse(null);
            DungeonTransition targetTransition =
                    targetMap == null
                            ? null
                            : DungeonTravelMoveResolverSupport.findTransition(targetMap, destination.transitionId());
            return new DungeonTransitionTarget(targetMap, targetTransition);
        }

        private DungeonTravelMoveFacts unavailableFromCurrent(String statusLabel) {
            DungeonTravelSurfaceFacts surface = projectCurrentMap(requestedPosition, statusLabel);
            return DungeonTravelMoveResolverSupport.moveResult(
                    DungeonTravelMoveStatus.TARGET_UNAVAILABLE,
                    surface.statusLabel(),
                    surface,
                    null);
        }

        private DungeonTravelSurfaceFacts projectCurrentMap(
                @Nullable DungeonTravelPositionFacts position,
                String statusLabel
        ) {
            return projector.project(currentMap, currentDerived, position, statusLabel);
        }

    }

    private record DungeonTransitionTarget(
            @Nullable DungeonMap map,
            @Nullable DungeonTransition transition
    ) {
        private boolean available() {
            return map != null && transition != null && transition.anchor() != null;
        }

        private DungeonMap mapOrThrow() {
            return Objects.requireNonNull(map, "map");
        }

        private DungeonTravelPositionFacts position(DungeonTravelHeading heading) {
            DungeonTransition safeTransition = Objects.requireNonNull(transition, "transition");
            return new DungeonTravelPositionFacts(
                    mapOrThrow().metadata().mapId(),
                    DungeonTravelPositionFacts.LocationKind.TRANSITION,
                    safeTransition.transitionId(),
                    safeTransition.anchor(),
                    heading);
        }
    }
}
