package features.world.dungeonmap.application.transition;

import features.world.dungeonmap.application.stair.DungeonStairApplicationService;
import features.world.dungeonmap.application.stair.StairDraftResolver;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.cluster.model.RoomCluster;
import features.world.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.connection.StairConnectionCarrier;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.Stair;
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
        if (sourceRef instanceof DungeonSelectionRef.DoorRef doorRef) {
            DungeonLayout.DoorDescription description = layout.describeDoor(doorRef);
            if (description == null || description.levelZ() != levelZ) {
                throw new IllegalArgumentException("Tür-Übergänge benötigen eine vorhandene Tür");
            }
            if (occupiedByOtherConnection(layout.connectionForDoor(description.ref()))) {
                throw new IllegalArgumentException("An dieser Grenze existiert bereits eine Verbindung");
            }
            if (!description.supportsTransitionPlacement()) {
                throw new IllegalArgumentException("Tür-Übergänge unterstützen keine lokalen Raumtüren");
            }
            ConnectionEndpoint sourceEndpoint = description.connectionEndpoint();
            return transitionDoorConnection(
                    transitionId,
                    mapId,
                    levelZ,
                    description.ref(),
                    sourceEndpoint);
        }
        throw new IllegalArgumentException("Tür-Übergänge unterstützen nur vorhandene Türen");
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
                resolvedDraft.draft().shapeSpec(),
                resolvedDraft.draft().minLevelZ(),
                resolvedDraft.draft().maxLevelZ(),
                Stair.of(resolvedDraft.path(), resolvedDraft.stopLevels()));
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
            DoorRef doorRef,
            ConnectionEndpoint sourceEndpoint
    ) {
        return new DungeonConnection(
                ConnectionKind.TRANSITION,
                transitionId,
                mapId,
                levelZ,
                new DoorConnectionCarrier(doorRef),
                List.of(sourceEndpoint, ConnectionEndpoint.transition(transitionId)));
    }

    private static List<ConnectionEndpoint> stairEndpoints(
            DungeonLayout layout,
            Long transitionId,
            features.world.dungeonmap.geometry.GridPoint anchorCell,
            int anchorLevelZ
    ) {
        LinkedHashSet<ConnectionEndpoint> endpoints = new LinkedHashSet<>();
        Room room = roomWithFloorAtCell(layout, anchorCell, anchorLevelZ);
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
        Set<GridPoint> occupiedPositions = candidate == null ? Set.of() : candidate.occupiedPositions(layout);
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

    private static boolean occupiedByOtherConnection(
            features.world.dungeonmap.model.structures.connection.Connection existingConnection
    ) {
        return existingConnection != null;
    }

    private static Room roomWithFloorAtCell(
            DungeonLayout layout,
            GridPoint cell,
            int levelZ
    ) {
        RoomCluster cluster = layout == null ? null : layout.clusterAtCell(cell, levelZ);
        Room room = cluster == null ? null : cluster.structure().roomTopology().roomAt(cell, levelZ);
        return room != null && cluster.structure().roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().contains(cell)
                ? room
                : null;
    }
}
