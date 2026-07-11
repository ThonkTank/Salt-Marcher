package src.domain.dungeon;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts.SelectedAction;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionKind;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurface;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurface.Transition;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurfaceProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelDungeonSessionProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelHeading;
import src.domain.dungeon.model.runtime.travel.projection.TravelPositionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceProjection;
import src.domain.dungeon.model.runtime.travel.projection.TravelTransitionTarget;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.LocationKind;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.OverworldTarget;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;

final class DungeonTravelNavigator {
    private static final String TRAVEL_ACTION_COMPLETE = "Reiseaktion ausgefuehrt.";
    private static final String DUNGEON_TRANSITION_USED = "Übergang benutzt.";

    private final DungeonAuthoredApplicationService authoredMaps;
    private final DungeonTravelPartyGateway partyGateway;
    private final DungeonTravelSurfaceLoader surfaceLoader;
    private final TravelSurfaceProjection projector = new TravelSurfaceProjection();

    DungeonTravelNavigator(
            DungeonAuthoredApplicationService authoredMaps,
            DungeonTravelPartyGateway partyGateway,
            DungeonTravelSurfaceLoader surfaceLoader
    ) {
        this.authoredMaps = Objects.requireNonNull(authoredMaps, "authoredMaps");
        this.partyGateway = Objects.requireNonNull(partyGateway, "partyGateway");
        this.surfaceLoader = Objects.requireNonNull(surfaceLoader, "surfaceLoader");
    }

    SurfaceData move(
            @Nullable PositionData requestedTravelPosition,
            @Nullable SurfaceData currentSurface,
            SelectedAction selectedAction
    ) {
        ActiveTravelStateData activeTravel = partyGateway.loadActiveTravelState();
        PositionData effectivePosition =
                TravelDungeonActiveState.effectiveTravelPosition(requestedTravelPosition, activeTravel.partyLocation());
        if (effectivePosition == null) {
            return currentSurface == null
                    ? TravelDungeonSessionSurface.outsideDungeonSurface(0L)
                    : currentSurface;
        }
        MoveResult result = MoveResult.safe(moveAction(
                TravelDungeonSessionProjectionMapper.toRuntimePositionFacts(effectivePosition),
                selectedAction));
        return applyResult(effectivePosition, activeTravel, result);
    }

    private SurfaceData applyResult(
            @Nullable PositionData effectivePosition,
            ActiveTravelStateData activeTravel,
            MoveResult result
    ) {
        if (result.status().isExternalTarget() && result.externalTarget() != null) {
            return applyExternalTarget(activeTravel, result, effectivePosition);
        }
        if (result.status().isSuccess()) {
            boolean saved = partyGateway.saveDungeonPosition(
                    result.surface().position(),
                    activeTravel.travelCharacterIds());
            return saved ? result.surface() : surfaceLoader.currentSurface(effectivePosition);
        }
        return result.surface();
    }

    private SurfaceData applyExternalTarget(
            ActiveTravelStateData activeTravel,
            MoveResult result,
            @Nullable PositionData effectivePosition
    ) {
        OverworldTarget target = Objects.requireNonNull(result.externalTarget(), "externalTarget");
        boolean saved = partyGateway.saveOverworldPosition(
                target,
                activeTravel.travelCharacterIds());
        return saved
                ? TravelDungeonSessionSurface.outsideDungeonSurface(target.tileId())
                : surfaceLoader.currentSurface(effectivePosition);
    }

    private MoveResult moveAction(
            @Nullable TravelPositionFacts position,
            SelectedAction selectedAction
    ) {
        DungeonMap currentMap = loadMap(position);
        TravelAuthoredSurface currentSurface =
                TravelAuthoredSurfaceProjectionMapper.from(currentMap, authoredMaps.derive(currentMap));
        return new MoveResolver(currentSurface, position).move(SelectedAction.safe(selectedAction));
    }

    private DungeonMap loadMap(@Nullable TravelPositionFacts position) {
        return position == null
                ? authoredMaps.loadMap(null)
                : authoredMaps.loadMap(new DungeonMapIdentity(position.mapId()));
    }

    private final class MoveResolver {
        private final TravelAuthoredSurface currentSurfaceInput;
        private final @Nullable TravelPositionFacts requestedPosition;
        private final TravelSurfaceFacts currentSurface;

        private MoveResolver(
                TravelAuthoredSurface currentSurfaceInput,
                @Nullable TravelPositionFacts requestedPosition
        ) {
            this.currentSurfaceInput = currentSurfaceInput;
            this.requestedPosition = requestedPosition;
            currentSurface = projectSurface(currentSurfaceInput, requestedPosition, "");
        }

        private MoveResult move(SelectedAction selectedAction) {
            java.util.Optional<TravelActionFacts> action = currentSurface.action(selectedAction);
            if (action.isEmpty()) {
                return new MoveResult(
                        MoveStatus.INVALID_ACTION,
                        TravelDungeonSessionProjectionMapper.toRuntimeSurface(
                                projectCurrentMap(requestedPosition, "Aktion ist nicht verfügbar.")),
                        null);
            }
            TravelActionFacts selected = action.get();
            if (selected.kind() == TravelActionKind.TRAVERSAL) {
                return moveTraversal(selected);
            }
            return moveTransition(selected);
        }

        private MoveResult moveTraversal(TravelActionFacts action) {
            TravelPositionFacts target = action.targetPosition();
            if (target == null) {
                return unavailableFromCurrent("Reiseziel ist nicht verfügbar.");
            }
            TravelSurfaceFacts surface = projectCurrentMap(target, TRAVEL_ACTION_COMPLETE);
            return new MoveResult(
                    MoveStatus.SUCCESS,
                    TravelDungeonSessionProjectionMapper.toRuntimeSurface(surface),
                    null);
        }

        private MoveResult moveTransition(TravelActionFacts action) {
            TravelTransitionTarget target = action.transitionTarget();
            if (target.isAbsent()) {
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

        private MoveResult moveToOverworldTransition(TravelTransitionTarget target) {
            TravelSurfaceFacts surface = projectCurrentMap(
                    currentSurface.position(),
                    "Übergang führt zum Overworld-Feld " + target.tileId() + ".");
            return new MoveResult(
                    MoveStatus.EXTERNAL_TARGET,
                    TravelDungeonSessionProjectionMapper.toRuntimeSurface(surface),
                    new OverworldTarget(target.mapId(), target.tileId()));
        }

        private MoveResult moveToDungeonTransition(TravelTransitionTarget target) {
            if (!target.hasTransitionId()) {
                return unavailableFromCurrent("Ziel-Übergang ist noch nicht platziert.");
            }
            ResolvedDungeonTransition resolvedTransition = resolveTransitionTarget(target);
            if (!resolvedTransition.available()) {
                return unavailableFromCurrent("Ziel-Übergang ist nicht verfügbar.");
            }
            TravelAuthoredSurface targetSurface = resolvedTransition.surfaceOrThrow();
            TravelSurfaceFacts surface = projectSurface(
                    targetSurface,
                    resolvedTransition.position(currentSurface.position().heading()),
                    DUNGEON_TRANSITION_USED);
            return new MoveResult(
                    MoveStatus.SUCCESS,
                    TravelDungeonSessionProjectionMapper.toRuntimeSurface(surface),
                    null);
        }

        private ResolvedDungeonTransition resolveTransitionTarget(TravelTransitionTarget target) {
            DungeonMap targetMap = authoredMaps.findMap(new DungeonMapIdentity(target.mapId())).orElse(null);
            TravelAuthoredSurface targetSurface = targetMap == null
                    ? null
                    : TravelAuthoredSurfaceProjectionMapper.from(targetMap, authoredMaps.derive(targetMap));
            Transition targetTransition =
                    targetSurface == null
                            ? null
                            : targetSurface.transition(target.transitionId());
            return new ResolvedDungeonTransition(targetSurface, targetTransition);
        }

        private MoveResult unavailableFromCurrent(String statusLabel) {
            TravelSurfaceFacts surface = projectCurrentMap(requestedPosition, statusLabel);
            return new MoveResult(
                    MoveStatus.TARGET_UNAVAILABLE,
                    TravelDungeonSessionProjectionMapper.toRuntimeSurface(surface),
                    null);
        }

        private TravelSurfaceFacts projectCurrentMap(
                @Nullable TravelPositionFacts position,
                String statusLabel
        ) {
            return projectSurface(currentSurfaceInput, position, statusLabel);
        }

        private TravelSurfaceFacts projectSurface(
                TravelAuthoredSurface authoredSurface,
                @Nullable TravelPositionFacts position,
                String statusLabel
        ) {
            return projector.project(
                    authoredSurface,
                    position,
                    statusLabel);
        }
    }

    private record ResolvedDungeonTransition(
            @Nullable TravelAuthoredSurface surface,
            @Nullable Transition transition
    ) {
        private boolean available() {
            return surface != null && transition != null && transition.anchor() != null;
        }

        private TravelAuthoredSurface surfaceOrThrow() {
            return Objects.requireNonNull(surface, "surface");
        }

        private TravelPositionFacts position(TravelHeading heading) {
            Transition safeTransition = Objects.requireNonNull(transition, "transition");
            return new TravelPositionFacts(
                    surfaceOrThrow().header().mapId(),
                    LocationKind.TRANSITION,
                    safeTransition.transitionId(),
                    safeTransition.anchor(),
                    heading);
        }
    }

    private record MoveResult(
            MoveStatus status,
            SurfaceData surface,
            @Nullable OverworldTarget externalTarget
    ) {
        private MoveResult {
            status = status == null ? MoveStatus.NO_MAP : status;
            surface = surface == null ? TravelDungeonSessionSurface.outsideDungeonSurface(0L) : surface;
        }

        private static MoveResult safe(@Nullable MoveResult result) {
            return result == null
                    ? new MoveResult(MoveStatus.NO_MAP, null, null)
                    : result;
        }
    }

    private enum MoveStatus {
        SUCCESS,
        INVALID_ACTION,
        TARGET_UNAVAILABLE,
        EXTERNAL_TARGET,
        NO_MAP;

        private boolean isSuccess() {
            return this == SUCCESS;
        }

        private boolean isExternalTarget() {
            return this == EXTERNAL_TARGET;
        }
    }
}
