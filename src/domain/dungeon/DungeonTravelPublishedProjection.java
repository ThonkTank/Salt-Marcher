package src.domain.dungeon;

import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.AvailableAction;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.MapData;
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
                safeOverlay.mode().modeKey(),
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
                mapSnapshot(surface.map()),
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
                cell(position.tile()),
                DungeonTravelHeading.valueOf(position.heading().name()));
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

    private static src.domain.dungeon.published.DungeonMapSnapshot mapSnapshot(MapData map) {
        MapData safeMap = map == null ? MapData.empty() : map;
        return new src.domain.dungeon.published.DungeonMapSnapshot(
                src.domain.dungeon.published.DungeonTopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonTravelPublishedProjection::area).toList(),
                safeMap.boundaries().stream().map(DungeonTravelPublishedProjection::boundary).toList(),
                safeMap.features().stream().map(DungeonTravelPublishedProjection::feature).toList());
    }

    private static DungeonCellRef cell(src.domain.dungeon.model.core.geometry.Cell cell) {
        src.domain.dungeon.model.core.geometry.Cell safeCell = cell == null
                ? new src.domain.dungeon.model.core.geometry.Cell(0, 0, 0)
                : cell;
        return new DungeonCellRef(
                safeCell.q(),
                safeCell.r(),
                safeCell.level());
    }

    private static src.domain.dungeon.published.DungeonAreaSnapshot area(
            src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.AreaData area
    ) {
        return new src.domain.dungeon.published.DungeonAreaSnapshot(
                src.domain.dungeon.published.DungeonAreaKind.valueOf(area.kind().name()),
                area.id(),
                0L,
                area.label(),
                area.cells().stream().map(DungeonTravelPublishedProjection::cell).toList(),
                topologyRef(area.topologyRef()));
    }

    private static src.domain.dungeon.published.DungeonBoundarySnapshot boundary(
            src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.BoundaryData boundary
    ) {
        return new src.domain.dungeon.published.DungeonBoundarySnapshot(
                boundary.doorBoundary() ? "door" : "wall",
                boundary.id(),
                boundary.label(),
                edge(boundary.edge()),
                topologyRef(boundary.topologyRef()));
    }

    private static src.domain.dungeon.published.DungeonFeatureSnapshot feature(
            src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.FeatureData feature
    ) {
        return new src.domain.dungeon.published.DungeonFeatureSnapshot(
                src.domain.dungeon.published.DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(DungeonTravelPublishedProjection::cell).toList(),
                feature.description(),
                feature.destinationLabel(),
                topologyRef(feature.topologyRef()),
                null);
    }

    private static src.domain.dungeon.published.DungeonEdgeRef edge(
            src.domain.dungeon.model.core.geometry.Edge edge
    ) {
        src.domain.dungeon.model.core.geometry.Edge safeEdge = edge == null
                ? new src.domain.dungeon.model.core.geometry.Edge(
                        new src.domain.dungeon.model.core.geometry.Cell(0, 0, 0),
                        new src.domain.dungeon.model.core.geometry.Cell(0, 0, 0))
                : edge;
        return new src.domain.dungeon.published.DungeonEdgeRef(cell(safeEdge.from()), cell(safeEdge.to()));
    }

    private static src.domain.dungeon.published.DungeonTopologyElementRef topologyRef(
            src.domain.dungeon.model.core.graph.DungeonTopologyRef ref
    ) {
        if (ref == null) {
            return src.domain.dungeon.published.DungeonTopologyElementRef.empty();
        }
        return new src.domain.dungeon.published.DungeonTopologyElementRef(
                publishedTopologyKind(ref),
                ref.id());
    }

    private static src.domain.dungeon.published.DungeonTopologyElementKind publishedTopologyKind(
            src.domain.dungeon.model.core.graph.DungeonTopologyRef ref
    ) {
        try {
            return src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name());
        } catch (IllegalArgumentException exception) {
            return src.domain.dungeon.published.DungeonTopologyElementKind.EMPTY;
        }
    }
}
