package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AvailableAction;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AreaData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.BoundaryData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.FeatureData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.MapData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState;

public record TravelDungeonSnapshot(
        @Nullable TravelDungeonWorkspaceState workspaceState,
        @Nullable DungeonTravelSurfaceSnapshot travelSurface,
        DungeonOverlaySettings overlaySettings,
        int projectionLevel
) {

    public TravelDungeonSnapshot {
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }

    public static TravelDungeonSnapshot empty() {
        return new TravelDungeonSnapshot(null, null, DungeonOverlaySettings.defaults(), 0);
    }

    static TravelDungeonSnapshot fromSessionSnapshot(Object snapshot) {
        if (snapshot instanceof TravelDungeonSnapshot publishedSnapshot) {
            return publishedSnapshot;
        }
        if (!(snapshot instanceof SnapshotData snapshotData)) {
            return empty();
        }
        SurfaceData surface = snapshotData.surface();
        return new TravelDungeonSnapshot(
                workspaceState(surface),
                surfaceSnapshot(surface),
                overlaySettings(snapshotData.overlayState()),
                snapshotData.projectionLevel());
    }

    private static DungeonOverlaySettings overlaySettings(TravelOverlayState overlayState) {
        TravelOverlayState safeOverlay = overlayState == null
                ? TravelOverlayState.defaults()
                : overlayState;
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
                surface.actions().stream().map(TravelDungeonSnapshot::workspaceAction).toList());
    }

    private static DungeonTravelSurfaceSnapshot surfaceSnapshot(SurfaceData surface) {
        if (surface == null) {
            return null;
        }
        return new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.valueOf(surface.contextKind().name()),
                surface.mapName(),
                surface.revision(),
                travelMapSnapshot(surface.map()),
                travelPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(TravelDungeonSnapshot::surfaceAction).toList());
    }

    private static DungeonMapSnapshot travelMapSnapshot(MapData map) {
        MapData safeMap = map == null ? MapData.empty() : map;
        return new DungeonMapSnapshot(
                DungeonTopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(TravelDungeonSnapshot::area).toList(),
                safeMap.boundaries().stream().map(TravelDungeonSnapshot::boundary).toList(),
                safeMap.features().stream().map(TravelDungeonSnapshot::feature).toList());
    }

    private static DungeonAreaSnapshot area(AreaData area) {
        return new DungeonAreaSnapshot(
                DungeonAreaKind.valueOf(area.kind().name()),
                area.id(),
                area.label(),
                area.cells().stream().map(TravelDungeonSnapshot::cell).toList());
    }

    private static DungeonBoundarySnapshot boundary(BoundaryData boundary) {
        return new DungeonBoundarySnapshot(
                boundary.doorBoundary() ? "door" : "wall",
                boundary.id(),
                boundary.label(),
                new DungeonEdgeRef(cell(boundary.edge().from()), cell(boundary.edge().to())));
    }

    private static DungeonFeatureSnapshot feature(FeatureData feature) {
        return new DungeonFeatureSnapshot(
                DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(TravelDungeonSnapshot::cell).toList(),
                feature.description(),
                feature.destinationLabel());
    }

    private static DungeonCellRef cell(DungeonCell cell) {
        DungeonCell safeCell = cell == null ? new DungeonCell(0, 0, 0) : cell;
        return new DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static DungeonTravelPosition travelPosition(PositionData position) {
        PositionData safePosition = position == null
                ? new PositionData(1L, null, 0L, new DungeonCell(0, 0, 0), "SOUTH")
                : position;
        return new DungeonTravelPosition(
                new DungeonMapId(safePosition.mapId()),
                DungeonTravelLocationKind.valueOf(safePosition.locationKind().name()),
                safePosition.ownerId(),
                cell(safePosition.tile()),
                DungeonTravelHeading.valueOf(safePosition.headingToken()));
    }

    private static DungeonTravelActionSnapshot surfaceAction(AvailableAction action) {
        AvailableAction safeAction = action == null
                ? new AvailableAction("", "Aktion", "")
                : action;
        return new DungeonTravelActionSnapshot(
                safeAction.id(),
                DungeonTravelActionKind.TRAVERSAL,
                safeAction.displayLabel(),
                "",
                safeAction.helpText());
    }

    private static TravelDungeonAction workspaceAction(AvailableAction action) {
        AvailableAction safeAction = action == null
                ? new AvailableAction("", "Aktion", "")
                : action;
        return new TravelDungeonAction(
                safeAction.id(),
                safeAction.displayLabel(),
                safeAction.helpText());
    }
}
