package src.domain.dungeon;

final class DungeonTravelRuntimeSurfaceProjectionServiceAssembly {

    private DungeonTravelRuntimeSurfaceProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.TravelDungeonSnapshot snapshot(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSnapshot.SnapshotData snapshot
    ) {
        if (snapshot == null) {
            return src.domain.dungeon.published.TravelDungeonSnapshot.empty();
        }
        src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.SurfaceData surface = snapshot.surface();
        return new src.domain.dungeon.published.TravelDungeonSnapshot(
                workspaceState(surface),
                surfaceSnapshot(surface),
                overlaySettings(snapshot.overlayState()),
                snapshot.projectionLevel());
    }

    private static src.domain.dungeon.published.DungeonOverlaySettings overlaySettings(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.TravelOverlayState overlayState
    ) {
        src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.TravelOverlayState safeOverlay = overlayState == null
                ? src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues.TravelOverlayState.defaults()
                : overlayState;
        return new src.domain.dungeon.published.DungeonOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static src.domain.dungeon.published.TravelDungeonWorkspaceState workspaceState(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.SurfaceData surface
    ) {
        if (surface == null) {
            return null;
        }
        return new src.domain.dungeon.published.TravelDungeonWorkspaceState(
                surface.mapName(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.contextKind().isOverworld(),
                surface.actions().stream().map(DungeonTravelRuntimeSurfaceProjectionServiceAssembly::workspaceAction).toList());
    }

    private static src.domain.dungeon.published.DungeonTravelSurfaceSnapshot surfaceSnapshot(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.SurfaceData surface
    ) {
        if (surface == null) {
            return null;
        }
        return new src.domain.dungeon.published.DungeonTravelSurfaceSnapshot(
                src.domain.dungeon.published.DungeonTravelContextKind.valueOf(surface.contextKind().name()),
                surface.mapName(),
                surface.revision(),
                DungeonTravelRuntimeMapProjectionServiceAssembly.mapSnapshot(surface.map()),
                travelPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(DungeonTravelRuntimeSurfaceProjectionServiceAssembly::surfaceAction).toList());
    }

    private static src.domain.dungeon.published.DungeonTravelPosition travelPosition(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.PositionData position
    ) {
        if (position == null) {
            return new src.domain.dungeon.published.DungeonTravelPosition(
                    new src.domain.dungeon.published.DungeonMapId(1L),
                    src.domain.dungeon.published.DungeonTravelLocationKind.TILE,
                    0L,
                    new src.domain.dungeon.published.DungeonCellRef(0, 0, 0),
                    src.domain.dungeon.published.DungeonTravelHeading.defaultHeading());
        }
        return new src.domain.dungeon.published.DungeonTravelPosition(
                new src.domain.dungeon.published.DungeonMapId(position.mapId()),
                src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                DungeonPublishedMapProjectionServiceAssembly.cell(position.tile()),
                src.domain.dungeon.published.DungeonTravelHeading.valueOf(position.headingToken()));
    }

    private static src.domain.dungeon.published.DungeonTravelActionSnapshot surfaceAction(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.AvailableAction action
    ) {
        return new src.domain.dungeon.published.DungeonTravelActionSnapshot(
                action.id(),
                src.domain.dungeon.published.DungeonTravelActionKind.TRAVERSAL,
                action.displayLabel(),
                "",
                action.helpText());
    }

    private static src.domain.dungeon.published.TravelDungeonAction workspaceAction(
            src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.AvailableAction action
    ) {
        return new src.domain.dungeon.published.TravelDungeonAction(
                action.id(),
                action.displayLabel(),
                action.helpText());
    }
}
