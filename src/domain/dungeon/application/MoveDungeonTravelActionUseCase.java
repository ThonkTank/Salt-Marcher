package src.domain.dungeon.application;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonTransition;
import src.domain.dungeon.map.service.DungeonTravelSurfaceProjector;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTransitionDestination;
import src.domain.dungeon.map.value.DungeonTravelActionFacts;
import src.domain.dungeon.map.value.DungeonTravelActionKind;
import src.domain.dungeon.map.value.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.map.value.DungeonTravelLocationKind;
import src.domain.dungeon.map.value.DungeonTravelMoveFacts;
import src.domain.dungeon.map.value.DungeonTravelMoveStatus;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;

public final class MoveDungeonTravelActionUseCase {

    public record Input(
            @Nullable DungeonTravelPositionFacts position,
            String actionId
    ) {
        public Input {
            actionId = actionId == null ? "" : actionId.trim();
        }
    }

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final Function<DungeonMapIdentity, Optional<DungeonMap>> findById;
    private final Function<DungeonMap, DungeonDerivedState> deriveState;
    private final DungeonTravelSurfaceProjector projector = new DungeonTravelSurfaceProjector();

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
        DungeonTravelSurfaceFacts currentSurface = project(currentMap, currentDerived, position, "");
        DungeonTravelActionFacts action = findAction(currentSurface, actionId);
        if (action == null) {
            return moveResult(DungeonTravelMoveStatus.INVALID_ACTION, "Aktion ist nicht verfügbar.", currentSurface);
        }
        if (action.kind() == DungeonTravelActionKind.TRAVERSAL) {
            return moveThroughTraversal(currentMap, currentDerived, action);
        }
        return moveThroughTransition(currentMap, currentDerived, currentSurface.position(), action);
    }

    private DungeonTravelMoveFacts moveThroughTraversal(
            DungeonMap currentMap,
            DungeonDerivedState currentDerived,
            DungeonTravelActionFacts action
    ) {
        DungeonTravelPositionFacts target = action.targetPosition();
        if (target == null) {
            DungeonTravelSurfaceFacts surface = project(currentMap, currentDerived, null, "Reiseziel ist nicht verfügbar.");
            return moveResult(DungeonTravelMoveStatus.TARGET_UNAVAILABLE, surface.statusLabel(), surface);
        }
        DungeonTravelSurfaceFacts surface = project(currentMap, currentDerived, target, "Reiseaktion ausgefuehrt.");
        return moveResult(DungeonTravelMoveStatus.SUCCESS, "Reiseaktion ausgefuehrt.", surface);
    }

    private DungeonTravelMoveFacts moveThroughTransition(
            DungeonMap currentMap,
            DungeonDerivedState currentDerived,
            DungeonTravelPositionFacts currentPosition,
            DungeonTravelActionFacts action
    ) {
        DungeonTransitionDestination destination = action.transitionDestination();
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            DungeonTravelSurfaceFacts surface = project(
                    currentMap,
                    currentDerived,
                    currentPosition,
                    "Übergang führt zum Overworld-Feld " + overworld.tileId() + ".");
            return moveResult(
                    DungeonTravelMoveStatus.EXTERNAL_TARGET,
                    surface.statusLabel(),
                    surface,
                    new DungeonTravelExternalTargetFacts.OverworldTile(overworld.mapId(), overworld.tileId()));
        }
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            return moveToDungeonTransition(currentPosition, dungeon);
        }
        DungeonTravelSurfaceFacts surface = project(currentMap, currentPosition, "Übergangsziel ist nicht verfügbar.");
        return moveResult(DungeonTravelMoveStatus.TARGET_UNAVAILABLE, surface.statusLabel(), surface);
    }

    private DungeonTravelMoveFacts moveToDungeonTransition(
            DungeonTravelPositionFacts currentPosition,
            DungeonTransitionDestination.DungeonMapDestination destination
    ) {
        if (destination.transitionId() == null) {
            DungeonMap currentMap = loadMap(currentPosition);
            DungeonDerivedState currentDerived = deriveState.apply(currentMap);
            DungeonTravelSurfaceFacts surface = project(
                    currentMap,
                    currentDerived,
                    currentPosition,
                    "Ziel-Übergang ist noch nicht platziert.");
            return moveResult(DungeonTravelMoveStatus.TARGET_UNAVAILABLE, surface.statusLabel(), surface);
        }
        DungeonMapIdentity targetMapId = new DungeonMapIdentity(destination.mapId());
        DungeonMap targetMap = findById.apply(targetMapId).orElse(null);
        DungeonTransition targetTransition = targetMap == null ? null : findTransition(targetMap, destination.transitionId());
        DungeonCell anchor = targetTransition == null ? null : targetTransition.anchor();
        if (targetMap == null || targetTransition == null || anchor == null) {
            DungeonMap currentMap = loadMap(currentPosition);
            DungeonDerivedState currentDerived = deriveState.apply(currentMap);
            DungeonTravelSurfaceFacts surface = project(
                    currentMap,
                    currentDerived,
                    currentPosition,
                    "Ziel-Übergang ist nicht verfügbar.");
            return moveResult(DungeonTravelMoveStatus.TARGET_UNAVAILABLE, surface.statusLabel(), surface);
        }
        DungeonTravelPositionFacts targetPosition = new DungeonTravelPositionFacts(
                targetMap.metadata().mapId(),
                DungeonTravelLocationKind.TRANSITION,
                targetTransition.transitionId(),
                anchor,
                currentPosition.heading());
        DungeonDerivedState targetDerived = deriveState.apply(targetMap);
        DungeonTravelSurfaceFacts surface = project(targetMap, targetDerived, targetPosition, "Übergang benutzt.");
        return moveResult(DungeonTravelMoveStatus.SUCCESS, "Übergang benutzt.", surface);
    }

    private DungeonTravelSurfaceFacts project(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            @Nullable DungeonTravelPositionFacts position,
            String statusLabel
    ) {
        return projector.project(dungeonMap, derived, position, statusLabel);
    }

    private DungeonTravelSurfaceFacts project(
            DungeonMap dungeonMap,
            @Nullable DungeonTravelPositionFacts position,
            String statusLabel
    ) {
        return project(dungeonMap, deriveState.apply(dungeonMap), position, statusLabel);
    }

    private DungeonMap loadMap(@Nullable DungeonTravelPositionFacts position) {
        return position == null
                ? loadDungeonMap.execute()
                : loadDungeonMap.execute(position.mapId());
    }

    private static @Nullable DungeonTravelActionFacts findAction(DungeonTravelSurfaceFacts surface, String actionId) {
        return surface.actions().stream()
                .filter(action -> action.actionId().equals(actionId))
                .findFirst()
                .orElse(null);
    }

    private static @Nullable DungeonTransition findTransition(DungeonMap dungeonMap, long transitionId) {
        return dungeonMap.connections().transitions().stream()
                .filter(transition -> transition.transitionId() == transitionId)
                .findFirst()
                .orElse(null);
    }

    private static DungeonTravelMoveFacts moveResult(
            DungeonTravelMoveStatus status,
            String message,
            DungeonTravelSurfaceFacts surface
    ) {
        return moveResult(status, message, surface, null);
    }

    private static DungeonTravelMoveFacts moveResult(
            DungeonTravelMoveStatus status,
            String message,
            DungeonTravelSurfaceFacts surface,
            @Nullable DungeonTravelExternalTargetFacts externalTarget
    ) {
        return new DungeonTravelMoveFacts(status, message, surface, externalTarget);
    }
}
