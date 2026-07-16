package features.dungeon.application.travel;

import features.dungeon.application.travel.session.TravelDungeonSessionSnapshot;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.AvailableAction;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.MapData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.OverlayState;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.PositionData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.SurfaceData;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonMapId;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.DungeonTravelActionKind;
import features.dungeon.api.DungeonTravelActionSnapshot;
import features.dungeon.api.DungeonTravelContextKind;
import features.dungeon.api.DungeonTravelHeading;
import features.dungeon.api.DungeonTravelLocationKind;
import features.dungeon.api.DungeonTravelPosition;
import features.dungeon.api.DungeonTravelSurfaceSnapshot;
import features.dungeon.api.TravelDungeonAction;
import features.dungeon.api.TravelDungeonSnapshot;
import features.dungeon.api.TravelDungeonWorkspaceState;

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

    private static features.dungeon.api.DungeonMapSnapshot mapSnapshot(MapData map) {
        MapData safeMap = map == null ? MapData.empty() : map;
        return new features.dungeon.api.DungeonMapSnapshot(
                features.dungeon.api.DungeonTopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonTravelPublishedProjection::area).toList(),
                safeMap.boundaries().stream().map(DungeonTravelPublishedProjection::boundary).toList(),
                safeMap.features().stream().map(DungeonTravelPublishedProjection::feature).toList());
    }

    private static DungeonCellRef cell(features.dungeon.domain.core.geometry.Cell cell) {
        features.dungeon.domain.core.geometry.Cell safeCell = cell == null
                ? new features.dungeon.domain.core.geometry.Cell(0, 0, 0)
                : cell;
        return new DungeonCellRef(
                safeCell.q(),
                safeCell.r(),
                safeCell.level());
    }

    private static features.dungeon.api.DungeonAreaSnapshot area(
            features.dungeon.application.travel.session.TravelDungeonSessionSurface.AreaData area
    ) {
        return new features.dungeon.api.DungeonAreaSnapshot(
                features.dungeon.api.DungeonAreaKind.valueOf(area.kind().name()),
                area.id(),
                0L,
                area.label(),
                area.cells().stream().map(DungeonTravelPublishedProjection::cell).toList(),
                topologyRef(area.topologyRef()));
    }

    private static features.dungeon.api.DungeonBoundarySnapshot boundary(
            features.dungeon.application.travel.session.TravelDungeonSessionSurface.BoundaryData boundary
    ) {
        return new features.dungeon.api.DungeonBoundarySnapshot(
                boundary.doorBoundary() ? "door" : "wall",
                boundary.id(),
                boundary.label(),
                edge(boundary.edge()),
                topologyRef(boundary.topologyRef()));
    }

    private static features.dungeon.api.DungeonFeatureSnapshot feature(
            features.dungeon.application.travel.session.TravelDungeonSessionSurface.FeatureData feature
    ) {
        return new features.dungeon.api.DungeonFeatureSnapshot(
                features.dungeon.api.DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(DungeonTravelPublishedProjection::cell).toList(),
                feature.description(),
                feature.destinationLabel(),
                topologyRef(feature.topologyRef()),
                null);
    }

    private static features.dungeon.api.DungeonEdgeRef edge(
            features.dungeon.domain.core.geometry.Edge edge
    ) {
        features.dungeon.domain.core.geometry.Edge safeEdge = edge == null
                ? new features.dungeon.domain.core.geometry.Edge(
                        new features.dungeon.domain.core.geometry.Cell(0, 0, 0),
                        new features.dungeon.domain.core.geometry.Cell(0, 0, 0))
                : edge;
        return new features.dungeon.api.DungeonEdgeRef(cell(safeEdge.from()), cell(safeEdge.to()));
    }

    private static features.dungeon.api.DungeonTopologyElementRef topologyRef(
            features.dungeon.domain.core.graph.DungeonTopologyRef ref
    ) {
        if (ref == null) {
            return features.dungeon.api.DungeonTopologyElementRef.empty();
        }
        return new features.dungeon.api.DungeonTopologyElementRef(
                publishedTopologyKind(ref),
                ref.id());
    }

    private static features.dungeon.api.DungeonTopologyElementKind publishedTopologyKind(
            features.dungeon.domain.core.graph.DungeonTopologyRef ref
    ) {
        try {
            return features.dungeon.api.DungeonTopologyElementKind.valueOf(ref.kind().name());
        } catch (IllegalArgumentException exception) {
            return features.dungeon.api.DungeonTopologyElementKind.EMPTY;
        }
    }
}
