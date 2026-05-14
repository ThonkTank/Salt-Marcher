package src.domain.dungeon.model.travel.model.session.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AvailableAction;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.AreaData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.BoundaryData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.CellData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.FeatureData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.MapData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.ContextKind;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.TravelOverlayState;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;
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
import src.domain.dungeon.published.TravelOverlaySettings;

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
                toPublishedSurface(surface),
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

    private static @Nullable DungeonTravelSurfaceSnapshot toPublishedSurface(@Nullable SurfaceData surface) {
        if (surface == null) {
            return null;
        }
        return new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.valueOf(surface.contextKind().name()),
                surface.mapName(),
                surface.revision(),
                toPublishedMap(surface.map()),
                toPublishedPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(TravelDungeonSnapshotHelper::toPublishedSurfaceAction).toList());
    }

    private static DungeonMapSnapshot toPublishedMap(MapData map) {
        MapData safeMap = map == null ? MapData.empty() : map;
        return new DungeonMapSnapshot(
                safeMap.topology().isHex() ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE,
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(TravelDungeonSnapshotHelper::toPublishedArea).toList(),
                safeMap.boundaries().stream().map(TravelDungeonSnapshotHelper::toPublishedBoundary).toList(),
                safeMap.features().stream().map(TravelDungeonSnapshotHelper::toPublishedFeature).toList());
    }

    private static DungeonAreaSnapshot toPublishedArea(AreaData area) {
        return new DungeonAreaSnapshot(
                DungeonAreaKind.valueOf(area.kind().name()),
                area.id(),
                area.label(),
                area.cells().stream().map(TravelDungeonSnapshotHelper::toPublishedCell).toList());
    }

    private static DungeonBoundarySnapshot toPublishedBoundary(BoundaryData boundary) {
        return new DungeonBoundarySnapshot(
                boundary.doorBoundary() ? "door" : "wall",
                boundary.id(),
                boundary.label(),
                new DungeonEdgeRef(
                        toPublishedCell(boundary.edge().from()),
                        toPublishedCell(boundary.edge().to())));
    }

    private static DungeonFeatureSnapshot toPublishedFeature(FeatureData feature) {
        return new DungeonFeatureSnapshot(
                DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(TravelDungeonSnapshotHelper::toPublishedCell).toList(),
                feature.description(),
                feature.destinationLabel());
    }

    private static DungeonCellRef toPublishedCell(CellData cell) {
        return cell == null ? new DungeonCellRef(0, 0, 0) : new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    private static DungeonTravelPosition toPublishedPosition(PositionData position) {
        PositionData safePosition = position == null
                ? new PositionData(1L, null, 0L, new CellData(0, 0, 0), "SOUTH")
                : position;
        return new DungeonTravelPosition(
                new DungeonMapId(safePosition.mapId()),
                DungeonTravelLocationKind.valueOf(safePosition.locationKind().name()),
                safePosition.ownerId(),
                toPublishedCell(safePosition.tile()),
                DungeonTravelHeading.valueOf(safePosition.headingToken()));
    }

    private static DungeonTravelActionSnapshot toPublishedSurfaceAction(@Nullable AvailableAction action) {
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
