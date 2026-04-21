package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonTransition;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.service.DungeonTravelSurfaceProjector;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTransitionDestination;
import src.domain.dungeon.map.value.DungeonTravelActionFacts;
import src.domain.dungeon.map.value.DungeonTravelActionKind;
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

    private final DungeonMapRepository repository;
    private final DungeonMapSearch search;
    private final BuildDungeonDerivedStateUseCase derive;
    private final DungeonTravelSurfaceProjector projector = new DungeonTravelSurfaceProjector();

    public MoveDungeonTravelActionUseCase(
            DungeonMapRepository repository,
            DungeonMapSearch search,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.search = search;
        this.derive = derive;
    }

    public DungeonTravelMoveFacts execute(Input input) {
        DungeonTravelPositionFacts position = input == null ? null : input.position();
        String actionId = input == null ? "" : input.actionId();
        DungeonMap currentMap = loadMap(position);
        DungeonDerivedState derived = derive.execute(currentMap);
        DungeonTravelSurfaceFacts currentSurface = projector.project(currentMap, derived, position, "");
        DungeonTravelActionFacts action = findAction(currentSurface, actionId);
        if (action == null) {
            return moveResult(DungeonTravelMoveStatus.INVALID_ACTION, "Aktion ist nicht verfuegbar.", currentSurface);
        }
        if (action.kind() == DungeonTravelActionKind.STAIR) {
            return moveThroughStair(currentMap, action);
        }
        return moveThroughTransition(currentMap, currentSurface.position(), action);
    }

    private DungeonTravelMoveFacts moveThroughStair(DungeonMap currentMap, DungeonTravelActionFacts action) {
        DungeonTravelPositionFacts target = action.targetPosition();
        if (target == null) {
            DungeonTravelSurfaceFacts surface = project(currentMap, null, "Treppenziel ist nicht verfuegbar.");
            return moveResult(DungeonTravelMoveStatus.TARGET_UNAVAILABLE, surface.statusLabel(), surface);
        }
        DungeonTravelSurfaceFacts surface = project(currentMap, target, "Treppe benutzt.");
        return moveResult(DungeonTravelMoveStatus.SUCCESS, "Treppe benutzt.", surface);
    }

    private DungeonTravelMoveFacts moveThroughTransition(
            DungeonMap currentMap,
            DungeonTravelPositionFacts currentPosition,
            DungeonTravelActionFacts action
    ) {
        DungeonTransitionDestination destination = action.transitionDestination();
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            DungeonTravelSurfaceFacts surface = project(
                    currentMap,
                    currentPosition,
                    "Uebergang fuehrt zum Overworld-Feld " + overworld.tileId() + ".");
            return moveResult(DungeonTravelMoveStatus.EXTERNAL_TARGET, surface.statusLabel(), surface);
        }
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            return moveToDungeonTransition(currentPosition, dungeon);
        }
        DungeonTravelSurfaceFacts surface = project(currentMap, currentPosition, "Uebergangsziel ist nicht verfuegbar.");
        return moveResult(DungeonTravelMoveStatus.TARGET_UNAVAILABLE, surface.statusLabel(), surface);
    }

    private DungeonTravelMoveFacts moveToDungeonTransition(
            DungeonTravelPositionFacts currentPosition,
            DungeonTransitionDestination.DungeonMapDestination destination
    ) {
        if (destination.transitionId() == null) {
            DungeonMap currentMap = loadMap(currentPosition);
            DungeonTravelSurfaceFacts surface = project(currentMap, currentPosition, "Ziel-Uebergang ist noch nicht platziert.");
            return moveResult(DungeonTravelMoveStatus.TARGET_UNAVAILABLE, surface.statusLabel(), surface);
        }
        DungeonMapIdentity targetMapId = new DungeonMapIdentity(destination.mapId());
        DungeonMap targetMap = repository.findById(targetMapId).orElse(null);
        DungeonTransition targetTransition = targetMap == null ? null : findTransition(targetMap, destination.transitionId());
        DungeonCell anchor = targetTransition == null ? null : targetTransition.anchor();
        if (targetMap == null || anchor == null) {
            DungeonMap currentMap = loadMap(currentPosition);
            DungeonTravelSurfaceFacts surface = project(currentMap, currentPosition, "Ziel-Uebergang ist nicht verfuegbar.");
            return moveResult(DungeonTravelMoveStatus.TARGET_UNAVAILABLE, surface.statusLabel(), surface);
        }
        DungeonTravelPositionFacts targetPosition = new DungeonTravelPositionFacts(
                targetMap.metadata().mapId(),
                DungeonTravelLocationKind.TRANSITION,
                targetTransition.transitionId(),
                anchor,
                currentPosition.heading());
        DungeonTravelSurfaceFacts surface = project(targetMap, targetPosition, "Uebergang benutzt.");
        return moveResult(DungeonTravelMoveStatus.SUCCESS, "Uebergang benutzt.", surface);
    }

    private DungeonTravelSurfaceFacts project(
            DungeonMap dungeonMap,
            @Nullable DungeonTravelPositionFacts position,
            String statusLabel
    ) {
        return projector.project(dungeonMap, derive.execute(dungeonMap), position, statusLabel);
    }

    private DungeonMap loadMap(@Nullable DungeonTravelPositionFacts position) {
        if (position != null) {
            return repository.findById(position.mapId()).orElseGet(this::loadCurrentMap);
        }
        return loadCurrentMap();
    }

    private DungeonMap loadCurrentMap() {
        return search.firstMap()
                .orElseGet(() -> DungeonMap.empty(repository.nextMapId(), "Dungeon Bastion"));
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
        return new DungeonTravelMoveFacts(status, message, surface);
    }
}
