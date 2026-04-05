package features.world.dungeonmap.application.transition;

import features.world.dungeonmap.application.stair.DungeonStairApplicationService;
import features.world.dungeonmap.application.stair.StairDraftResolver;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.connection.StairConnectionCarrier;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Builds canonical transition-local connections from editor-facing door surfaces and stair drafts.
 *
 * <p>Preview and commit must call the same builder so transition geometry, validation, and occupancy semantics
 * cannot drift between UI and transactional write paths.</p>
 */
public final class TransitionConnectionBuilder {

    private TransitionConnectionBuilder() {
        throw new AssertionError("No instances");
    }

    public static DungeonConnection buildDoorConnection(
            DungeonLayout layout,
            long mapId,
            Long transitionId,
            DungeonSelectionRef sourceRef,
            int levelZ
    ) {
        if (layout == null || mapId <= 0) {
            throw new IllegalArgumentException("Kein aktiver Dungeon geladen");
        }
        if (sourceRef instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary) {
            DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(roomBoundary, levelZ);
            if (boundary == null || !boundary.exterior()) {
                throw new IllegalArgumentException("Tür-Übergänge benötigen eine freie Raum-Außenwand");
            }
            if (layout.connectionAt(levelZ, roomBoundary.boundarySegment2x()) != null) {
                throw new IllegalArgumentException("An dieser Grenze existiert bereits eine Verbindung");
            }
            return transitionDoorConnection(
                    transitionId,
                    mapId,
                    levelZ,
                    roomBoundary.boundarySegment2x(),
                    ConnectionEndpoint.room(roomBoundary.roomId()));
        }
        if (sourceRef instanceof DungeonSelectionRef.CorridorBoundaryRef corridorBoundary) {
            DungeonLayout.CorridorBoundaryDescription boundary = layout.describeCorridorBoundary(corridorBoundary, levelZ);
            if (boundary == null) {
                throw new IllegalArgumentException("Tür-Übergänge benötigen eine freie Corridor-Grenze");
            }
            if (layout.connectionAt(levelZ, corridorBoundary.boundarySegment2x()) != null) {
                throw new IllegalArgumentException("An dieser Grenze existiert bereits eine Verbindung");
            }
            return transitionDoorConnection(
                    transitionId,
                    mapId,
                    levelZ,
                    corridorBoundary.boundarySegment2x(),
                    ConnectionEndpoint.corridor(corridorBoundary.corridorId()));
        }
        throw new IllegalArgumentException("Tür-Übergänge unterstützen nur Raum- oder Corridor-Grenzen");
    }

    public static DungeonConnection buildStairConnection(
            DungeonLayout layout,
            long mapId,
            Long transitionId,
            DungeonStairApplicationService.StairDraft stairDraft,
            boolean allowSingleStop,
            Long ignoredTransitionId
    ) {
        if (layout == null || mapId <= 0) {
            throw new IllegalArgumentException("Kein aktiver Dungeon geladen");
        }
        if (stairDraft == null) {
            throw new IllegalArgumentException("Treppen-Platzierung fehlt");
        }
        StairDraftResolver.ResolvedStairDraft resolvedDraft =
                StairDraftResolver.resolveDraft(layout, mapId, stairDraft, allowSingleStop);
        StairConnectionCarrier carrier = new StairConnectionCarrier(
                resolvedDraft.draft().anchorCell(),
                resolvedDraft.draft().anchorLevelZ(),
                resolvedDraft.draft().shape(),
                resolvedDraft.draft().direction(),
                resolvedDraft.draft().minLevelZ(),
                resolvedDraft.draft().maxLevelZ(),
                resolvedDraft.draft().dimension1(),
                resolvedDraft.draft().dimension2(),
                resolvedDraft.path(),
                resolvedDraft.stopLevels());
        DungeonConnection candidate = new DungeonConnection(
                ConnectionKind.TRANSITION,
                transitionId,
                mapId,
                carrier.anchorLevelZ(),
                carrier,
                stairEndpoints(layout, transitionId, carrier.anchorCell(), carrier.anchorLevelZ()));
        ensureTransitionStairCellsFree(layout, candidate, ignoredTransitionId);
        return candidate;
    }

    private static DungeonConnection transitionDoorConnection(
            Long transitionId,
            long mapId,
            int levelZ,
            features.world.dungeonmap.model.geometry.GridSegment2x boundarySegment2x,
            ConnectionEndpoint sourceEndpoint
    ) {
        return new DungeonConnection(
                ConnectionKind.TRANSITION,
                transitionId,
                mapId,
                levelZ,
                new DoorConnectionCarrier(
                        Door.fromSegments(List.of(boundarySegment2x), Door.DoorState.OPEN),
                        boundarySegment2x),
                List.of(sourceEndpoint, ConnectionEndpoint.transition(transitionId)));
    }

    private static List<ConnectionEndpoint> stairEndpoints(
            DungeonLayout layout,
            Long transitionId,
            features.world.dungeonmap.model.geometry.CellCoord anchorCell,
            int anchorLevelZ
    ) {
        LinkedHashSet<ConnectionEndpoint> endpoints = new LinkedHashSet<>();
        Room room = layout == null ? null : layout.roomWithFloorAtCell(anchorCell, anchorLevelZ);
        if (room != null && room.roomId() != null) {
            endpoints.add(ConnectionEndpoint.room(room.roomId()));
        }
        endpoints.add(ConnectionEndpoint.transition(transitionId));
        return List.copyOf(endpoints);
    }

    private static void ensureTransitionStairCellsFree(
            DungeonLayout layout,
            DungeonConnection candidate,
            Long ignoredTransitionId
    ) {
        Set<CubePoint> occupiedPositions = candidate == null ? Set.of() : candidate.occupiedPositions(layout);
        if (layout == null || occupiedPositions.isEmpty()) {
            return;
        }
        boolean occupied = layout.transitions().stream()
                .filter(Objects::nonNull)
                .filter(DungeonTransition::isPlaced)
                .filter(transition -> !Objects.equals(transition.transitionId(), ignoredTransitionId))
                .map(DungeonTransition::localConnection)
                .filter(Objects::nonNull)
                .flatMap(connection -> connection.occupiedPositions(layout).stream())
                .anyMatch(occupiedPositions::contains);
        if (occupied) {
            throw new IllegalArgumentException("Ein anderer Übergang belegt bereits Teile dieser Treppe");
        }
    }
}
