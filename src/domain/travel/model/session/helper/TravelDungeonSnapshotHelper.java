package src.domain.travel.model.session.helper;

import org.jspecify.annotations.Nullable;
import src.domain.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.AvailableAction;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.travel.model.session.model.TravelDungeonSessionValues.ContextKind;
import src.domain.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState;
import src.domain.travel.published.TravelDungeonAction;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelDungeonWorkspaceState;
import src.domain.travel.published.TravelOverlaySettings;

public final class TravelDungeonSnapshotHelper {

    private TravelDungeonSnapshotHelper() {
    }

    public static TravelDungeonSnapshot toPublishedSnapshot(@Nullable SnapshotData snapshot) {
        SnapshotData safeSnapshot = snapshot == null
                ? new SnapshotData(
                null,
                TravelOverlayState.defaults(),
                0)
                : snapshot;
        SurfaceData surface = safeSnapshot.surface();
        return new TravelDungeonSnapshot(
                toPublishedWorkspaceState(surface),
                TravelDungeonMapProjectionHelper.projection(surface),
                toPublishedOverlay(safeSnapshot.overlayState()),
                safeSnapshot.projectionLevel());
    }

    private static TravelOverlaySettings toPublishedOverlay(TravelOverlayState overlayState) {
        TravelOverlayState safeOverlay = overlayState == null
                ? TravelOverlayState.defaults()
                : overlayState;
        return new TravelOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static @Nullable TravelDungeonWorkspaceState toPublishedWorkspaceState(@Nullable SurfaceData surface) {
        if (surface == null) {
            return null;
        }
        return new TravelDungeonWorkspaceState(
                surface.mapName(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.contextKind() == ContextKind.OVERWORLD,
                surface.actions().stream().map(TravelDungeonSnapshotHelper::toPublishedAction).toList());
    }

    private static TravelDungeonAction toPublishedAction(@Nullable AvailableAction action) {
        AvailableAction safeAction = action == null
                ? new AvailableAction("", "Aktion", "")
                : action;
        return new TravelDungeonAction(
                safeAction.id(),
                safeAction.displayLabel(),
                safeAction.helpText());
    }
}
