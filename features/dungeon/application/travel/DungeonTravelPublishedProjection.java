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
import features.dungeon.api.DungeonTravelContextSnapshot;
import features.dungeon.api.DungeonTravelHeading;
import features.dungeon.api.DungeonTravelLocationKind;
import features.dungeon.api.DungeonTravelMoveOutcome;
import features.dungeon.api.DungeonTravelPosition;
import features.dungeon.api.DungeonTravelSurfaceSnapshot;
import features.dungeon.api.TravelDungeonAction;
import features.dungeon.api.TravelDungeonSnapshot;
import features.dungeon.api.TravelDungeonWorkspaceState;

final class DungeonTravelPublishedProjection {

    private DungeonTravelPublishedProjection() {
    }

    static TravelDungeonSnapshot snapshot(
            TravelDungeonSessionSnapshot.SnapshotData snapshot,
            DungeonTravelMoveOutcome moveOutcome,
            long partyPositionRevision
    ) {
        if (snapshot == null) {
            return TravelDungeonSnapshot.empty();
        }
        SurfaceData surface = snapshot.surface();
        return new TravelDungeonSnapshot(
                workspaceState(surface),
                surfaceSnapshot(surface, partyPositionRevision),
                overlaySettings(snapshot.overlayState()),
                snapshot.projectionLevel(),
                moveOutcome);
    }

    static DungeonTravelContextSnapshot context(
            TravelDungeonSnapshot detailed,
            long sourceRevision,
            long partyPositionRevision
    ) {
        DungeonTravelSurfaceSnapshot surface = detailed == null ? null : detailed.travelSurface();
        if (surface == null || surface.contextKind() != DungeonTravelContextKind.DUNGEON) {
            return DungeonTravelContextSnapshot.empty(sourceRevision, partyPositionRevision);
        }
        DungeonTravelMoveOutcome outcome = detailed.moveOutcome();
        return new DungeonTravelContextSnapshot(
                sourceRevision,
                partyPositionRevision,
                true,
                surface.position().mapId().value(),
                surface.revision(),
                surface.mapName(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                contextStatus(surface, outcome),
                contextHint(surface, outcome));
    }

    private static String contextStatus(
            DungeonTravelSurfaceSnapshot surface,
            DungeonTravelMoveOutcome outcome
    ) {
        return switch (outcome.status()) {
            case MOVING -> "Bewegung laeuft";
            case ACCEPTED -> "Bewegung abgeschlossen";
            case REJECTED -> "Bewegung blockiert";
            case IDLE -> surface.statusLabel();
        };
    }

    private static String contextHint(
            DungeonTravelSurfaceSnapshot surface,
            DungeonTravelMoveOutcome outcome
    ) {
        return switch (outcome.status()) {
            case MOVING -> "Dungeon-Bewegung wird aufgeloest.";
            case ACCEPTED -> surface.visualDescription().isBlank()
                    ? "Dungeon-Position aktualisiert."
                    : surface.visualDescription();
            case REJECTED -> rejectionHint(outcome.rejectionReason());
            case IDLE -> surface.visualDescription().isBlank()
                    ? "Dungeon-Reise im Reisearbeitsbereich steuern."
                    : surface.visualDescription();
        };
    }

    private static String rejectionHint(features.dungeon.api.DungeonTravelRejectionReason reason) {
        return switch (reason) {
            case OFF_WINDOW -> "Zielfeld liegt ausserhalb des geladenen Bereichs.";
            case NON_TRAVERSABLE -> "Zielfeld ist nicht begehbar.";
            case UNREACHABLE -> "Zielfeld ist nicht erreichbar.";
            case STALE_PARTY_POSITION -> "Reiseposition wurde zwischenzeitlich aktualisiert.";
            case PARTY_REJECTED -> "Party-Bewegung wurde abgelehnt.";
            case PARTY_STORAGE_FAILURE, PARTY_FAILURE -> "Party-Bewegung konnte nicht gespeichert werden.";
            case ACTION_UNAVAILABLE, TRANSITION_UNAVAILABLE -> "Reiseaktion ist nicht mehr verfuegbar.";
            case AUTHORED_UNAVAILABLE -> "Dungeon-Daten sind nicht verfuegbar.";
            case INVALID_INPUT, NO_ACTIVE_POSITION, NONE -> "Dungeon-Bewegung ist nicht verfuegbar.";
        };
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

    private static DungeonTravelSurfaceSnapshot surfaceSnapshot(
            SurfaceData surface,
            long partyPositionRevision
    ) {
        if (surface == null) {
            return null;
        }
        return new DungeonTravelSurfaceSnapshot(
                surface.contextKind().isOverworld()
                        ? DungeonTravelContextKind.OVERWORLD
                        : DungeonTravelContextKind.DUNGEON,
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
                surface.actions().stream().map(DungeonTravelPublishedProjection::surfaceAction).toList(),
                partyPositionRevision);
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
                publishedLocationKind(position.locationKind()),
                position.ownerId(),
                cell(position.tile()),
                publishedHeading(position.heading()));
    }

    private static DungeonTravelActionSnapshot surfaceAction(AvailableAction action) {
        return new DungeonTravelActionSnapshot(
                action.actionId(),
                action.kind() == features.dungeon.application.travel.projection.TravelActionKind.TRANSITION
                        ? DungeonTravelActionKind.TRANSITION
                        : DungeonTravelActionKind.TRAVERSAL,
                action.label(),
                action.destinationLabel(),
                action.helpText());
    }

    private static TravelDungeonAction workspaceAction(AvailableAction action) {
        return new TravelDungeonAction(
                action.actionId(),
                action.displayLabel(),
                action.helpText());
    }

    private static features.dungeon.api.DungeonMapSnapshot mapSnapshot(MapData map) {
        MapData safeMap = map == null ? MapData.empty() : map;
        return new features.dungeon.api.DungeonMapSnapshot(
                safeMap.topology() == features.dungeon.application.travel.session.TravelDungeonSessionSurface.TopologyKind.HEX
                        ? features.dungeon.api.DungeonTopologyKind.HEX
                        : features.dungeon.api.DungeonTopologyKind.SQUARE,
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
                area.kind() == features.dungeon.application.travel.session.TravelDungeonSessionSurface.AreaKind.CORRIDOR
                        ? features.dungeon.api.DungeonAreaKind.CORRIDOR
                        : features.dungeon.api.DungeonAreaKind.ROOM,
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
                feature.kind() == features.dungeon.application.travel.session.TravelDungeonSessionSurface.FeatureKind.TRANSITION
                        ? features.dungeon.api.DungeonFeatureKind.TRANSITION
                        : features.dungeon.api.DungeonFeatureKind.STAIR,
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
        var kind = ref.kind();
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.ROOM) {
            return features.dungeon.api.DungeonTopologyElementKind.ROOM;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.CORRIDOR) {
            return features.dungeon.api.DungeonTopologyElementKind.CORRIDOR;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.CORRIDOR_ANCHOR) {
            return features.dungeon.api.DungeonTopologyElementKind.CORRIDOR_ANCHOR;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.DOOR) {
            return features.dungeon.api.DungeonTopologyElementKind.DOOR;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.WALL) {
            return features.dungeon.api.DungeonTopologyElementKind.WALL;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.STAIR) {
            return features.dungeon.api.DungeonTopologyElementKind.STAIR;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.TRANSITION) {
            return features.dungeon.api.DungeonTopologyElementKind.TRANSITION;
        }
        if (kind == features.dungeon.domain.core.graph.DungeonTopologyElementKind.FEATURE_MARKER) {
            return features.dungeon.api.DungeonTopologyElementKind.FEATURE_MARKER;
        }
        return features.dungeon.api.DungeonTopologyElementKind.EMPTY;
    }

    private static DungeonTravelLocationKind publishedLocationKind(
            features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind kind
    ) {
        return switch (kind) {
            case TILE -> DungeonTravelLocationKind.TILE;
            case STAIR_EXIT -> DungeonTravelLocationKind.STAIR_EXIT;
            case TRANSITION -> DungeonTravelLocationKind.TRANSITION;
        };
    }

    private static DungeonTravelHeading publishedHeading(
            features.dungeon.application.travel.projection.TravelHeading heading
    ) {
        return switch (heading) {
            case NORTH -> DungeonTravelHeading.NORTH;
            case EAST -> DungeonTravelHeading.EAST;
            case SOUTH -> DungeonTravelHeading.SOUTH;
            case WEST -> DungeonTravelHeading.WEST;
        };
    }
}
