package src.domain.dungeon.application;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonTransition;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceProjection;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTransitionDestination;
import src.domain.dungeon.model.map.model.DungeonTravelActionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelActionKind;
import src.domain.dungeon.model.map.model.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.model.map.model.DungeonTravelLocationKind;
import src.domain.dungeon.model.map.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.map.model.DungeonTravelMoveStatus;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;

public final class MoveDungeonTravelActionUseCase {

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
    private final Function<DungeonMapIdentity, Optional<DungeonMap>> findById;
    private final Function<DungeonMap, DungeonDerivedState> deriveState;
    private final DungeonTravelSurfaceProjection projector = new DungeonTravelSurfaceProjection();

    public MoveDungeonTravelActionUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            Function<DungeonMapIdentity, Optional<DungeonMap>> findById,
            Function<DungeonMap, DungeonDerivedState> deriveState
    ) {
        this.loadDungeonMap = Objects.requireNonNull(loadDungeonMap, "loadDungeonMap");
        this.findById = Objects.requireNonNull(findById, "findById");
        this.deriveState = Objects.requireNonNull(deriveState, "deriveState");
    }

    public DungeonTravelMoveFacts execute(Input input) {
        DungeonTravelPositionFacts position = input == null ? null : input.position();
        String actionId = input == null ? "" : input.actionId();
        DungeonMap currentMap = loadMap(position);
        DungeonDerivedState currentDerived = deriveState.apply(currentMap);
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
            DungeonTravelActionFacts action = currentSurface.actions().stream()
                    .filter(candidate -> candidate.actionId().equals(actionId))
                    .findFirst()
                    .orElse(null);
            if (action == null) {
                return moveResult(DungeonTravelMoveStatus.INVALID_ACTION, "Aktion ist nicht verfügbar.", currentSurface, null);
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
            DungeonTravelSurfaceFacts surface = projector.project(
                    currentMap,
                    currentDerived,
                    target,
                    "Reiseaktion ausgefuehrt.");
            return moveResult(DungeonTravelMoveStatus.SUCCESS, "Reiseaktion ausgefuehrt.", surface, null);
        }

        private DungeonTravelMoveFacts moveTransition(DungeonTravelActionFacts action) {
            DungeonTransitionDestination destination = action.transitionDestination();
            if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
                DungeonTravelSurfaceFacts surface = projector.project(
                        currentMap,
                        currentDerived,
                        currentSurface.position(),
                        "Übergang führt zum Overworld-Feld " + overworld.tileId() + ".");
                return moveResult(
                        DungeonTravelMoveStatus.EXTERNAL_TARGET,
                        surface.statusLabel(),
                        surface,
                        new DungeonTravelExternalTargetFacts.OverworldTile(overworld.mapId(), overworld.tileId()));
            }
            if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
                return moveToDungeonTransition(dungeon);
            }
            return unavailableFromCurrent("Übergangsziel ist nicht verfügbar.");
        }

        private DungeonTravelMoveFacts moveToDungeonTransition(
                DungeonTransitionDestination.DungeonMapDestination destination
        ) {
            if (destination.transitionId() == null) {
                return unavailableFromCurrent("Ziel-Übergang ist noch nicht platziert.");
            }
            DungeonMapIdentity targetMapId = new DungeonMapIdentity(destination.mapId());
            DungeonMap targetMap = findById.apply(targetMapId).orElse(null);
            DungeonTransition targetTransition =
                    targetMap == null ? null : findTransition(targetMap, destination.transitionId());
            DungeonCell anchor = targetTransition == null ? null : targetTransition.anchor();
            if (targetMap == null || targetTransition == null || anchor == null) {
                return unavailableFromCurrent("Ziel-Übergang ist nicht verfügbar.");
            }
            DungeonTravelPositionFacts targetPosition = new DungeonTravelPositionFacts(
                    targetMap.metadata().mapId(),
                    DungeonTravelLocationKind.TRANSITION,
                    targetTransition.transitionId(),
                    anchor,
                    currentSurface.position().heading());
            DungeonDerivedState targetDerived = deriveState.apply(targetMap);
            DungeonTravelSurfaceFacts surface = projector.project(targetMap, targetDerived, targetPosition, "Übergang benutzt.");
            return moveResult(DungeonTravelMoveStatus.SUCCESS, "Übergang benutzt.", surface, null);
        }

        private DungeonTravelMoveFacts unavailableFromCurrent(String statusLabel) {
            DungeonTravelSurfaceFacts surface = projector.project(
                    currentMap,
                    currentDerived,
                    requestedPosition,
                    statusLabel);
            return moveResult(DungeonTravelMoveStatus.TARGET_UNAVAILABLE, surface.statusLabel(), surface, null);
        }

        private DungeonTransition findTransition(DungeonMap dungeonMap, long transitionId) {
            return dungeonMap.connections().transitions().stream()
                    .filter(transition -> transition.transitionId() == transitionId)
                    .findFirst()
                    .orElse(null);
        }

        private DungeonTravelMoveFacts moveResult(
                DungeonTravelMoveStatus status,
                String message,
                DungeonTravelSurfaceFacts surface,
                @Nullable DungeonTravelExternalTargetFacts externalTarget
        ) {
            return new DungeonTravelMoveFacts(status, message, surface, externalTarget);
        }
    }
}
