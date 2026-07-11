package src.domain.dungeon;

import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.AvailableAction;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.OverlayState;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTravelActionKind;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.TravelDungeonAction;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.dungeon.published.TravelDungeonWorkspaceState;

final class DungeonTravelPublishedProjection {

    private DungeonTravelPublishedProjection() {
    }

    static TravelDungeonSnapshot snapshot(TravelDungeonSessionSnapshot.SnapshotData snapshot) {
        if (snapshot == null) {
            return TravelDungeonSnapshot.empty();
        }
        SurfaceData surface = snapshot.surface();
        return new TravelDungeonSnapshot(
                workspaceState(surface),
                surfaceSnapshot(surface),
                overlaySettings(snapshot.overlayState()),
                snapshot.projectionLevel());
    }

    private static DungeonOverlaySettings overlaySettings(OverlayState overlayState) {
        OverlayState safeOverlay = overlayState == null ? OverlayState.defaults() : overlayState;
        return new DungeonOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static TravelDungeonWorkspaceState workspaceState(SurfaceData surface) {
        if (surface == null) {
            return null;
        }
        return new TravelDungeonWorkspaceState(
                surface.mapName(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.contextKind().isOverworld(),
                surface.actions().stream().map(DungeonTravelPublishedProjection::workspaceAction).toList());
    }

    private static DungeonTravelSurfaceSnapshot surfaceSnapshot(SurfaceData surface) {
        if (surface == null) {
            return null;
        }
        return new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.valueOf(surface.contextKind().name()),
                surface.mapName(),
                surface.revision(),
                DungeonTravelPublishedMapProjection.mapSnapshot(surface.map()),
                travelPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(DungeonTravelPublishedProjection::surfaceAction).toList());
    }

    private static DungeonTravelPosition travelPosition(PositionData position) {
        if (position == null) {
            return new DungeonTravelPosition(
                    new DungeonMapId(1L),
                    DungeonTravelLocationKind.TILE,
                    0L,
                    new DungeonCellRef(0, 0, 0),
                    DungeonTravelHeading.defaultHeading());
        }
        return new DungeonTravelPosition(
                new DungeonMapId(position.mapId()),
                DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                DungeonTravelPublishedMapProjection.cell(position.tile()),
                DungeonTravelHeading.valueOf(position.headingToken()));
    }

    private static DungeonTravelActionSnapshot surfaceAction(AvailableAction action) {
        return new DungeonTravelActionSnapshot(
                DungeonTravelActionKind.valueOf(action.kind().name()),
                action.label(),
                action.destinationLabel(),
                action.helpText());
    }

    private static TravelDungeonAction workspaceAction(AvailableAction action) {
        return new TravelDungeonAction(
                action.displayLabel(),
                action.helpText());
    }
}
