package src.domain.travel.model.session.helper;

import org.jspecify.annotations.Nullable;
import src.domain.travel.application.ApplyTravelDungeonSessionUseCase;
import src.domain.travel.published.TravelDungeonAction;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelDungeonWorkspaceState;
import src.domain.travel.published.TravelOverlaySettings;

public final class TravelDungeonSnapshotHelper {

    private TravelDungeonSnapshotHelper() {
    }

    public static TravelDungeonSnapshot toPublishedSnapshot(
            ApplyTravelDungeonSessionUseCase.@Nullable SnapshotData snapshot
    ) {
        ApplyTravelDungeonSessionUseCase.SnapshotData safeSnapshot = snapshot == null
                ? new ApplyTravelDungeonSessionUseCase.SnapshotData(
                null,
                ApplyTravelDungeonSessionUseCase.TravelOverlayState.defaults(),
                0)
                : snapshot;
        ApplyTravelDungeonSessionUseCase.SurfaceData surface = safeSnapshot.surface();
        return new TravelDungeonSnapshot(
                toPublishedWorkspaceState(surface),
                TravelDungeonMapProjectionHelper.projection(surface),
                toPublishedOverlay(safeSnapshot.overlayState()),
                safeSnapshot.projectionLevel());
    }

    private static TravelOverlaySettings toPublishedOverlay(
            ApplyTravelDungeonSessionUseCase.TravelOverlayState overlayState
    ) {
        ApplyTravelDungeonSessionUseCase.TravelOverlayState safeOverlay = overlayState == null
                ? ApplyTravelDungeonSessionUseCase.TravelOverlayState.defaults()
                : overlayState;
        return new TravelOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static @Nullable TravelDungeonWorkspaceState toPublishedWorkspaceState(
            ApplyTravelDungeonSessionUseCase.@Nullable SurfaceData surface
    ) {
        if (surface == null) {
            return null;
        }
        return new TravelDungeonWorkspaceState(
                surface.mapName(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.contextKind() == ApplyTravelDungeonSessionUseCase.ContextKind.OVERWORLD,
                surface.actions().stream().map(TravelDungeonSnapshotHelper::toPublishedAction).toList());
    }

    private static TravelDungeonAction toPublishedAction(
            ApplyTravelDungeonSessionUseCase.@Nullable AvailableAction action
    ) {
        ApplyTravelDungeonSessionUseCase.AvailableAction safeAction = action == null
                ? new ApplyTravelDungeonSessionUseCase.AvailableAction("", "Aktion", "")
                : action;
        return new TravelDungeonAction(
                safeAction.id(),
                safeAction.displayLabel(),
                safeAction.helpText());
    }
}
