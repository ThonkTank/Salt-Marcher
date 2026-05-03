package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEditorHandleFacts;
import src.domain.dungeon.map.value.DungeonEditorHandleType;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonStairExit;
import src.domain.dungeon.map.value.DungeonTopologyElementKind;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.DungeonTraversalEndpoint;
import src.domain.dungeon.map.value.DungeonTraversalLink;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/**
 * Loads the current committed dungeon snapshot.
 */
public final class LoadDungeonSnapshotUseCase {

    public record DungeonSnapshotData(
            String mapName,
            DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        public DungeonSnapshotData(String mapName, DungeonDerivedState derived, long revision) {
            this(mapName, derived, List.of(), revision);
        }

        public DungeonSnapshotData {
            editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
        }
    }

    public record InspectorSnapshotData(
            String title,
            String description,
            List<String> facts,
            List<RoomNarrationData> roomNarrations
    ) {
        public InspectorSnapshotData(String title, String description, List<String> facts) {
            this(title, description, facts, List.of());
        }

        public InspectorSnapshotData {
            facts = facts == null ? List.of() : List.copyOf(facts);
            roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }
    }

    public record RoomNarrationData(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarrationData> exits
    ) {
        public RoomNarrationData {
            roomName = roomName == null || roomName.isBlank() ? "Raum " + roomId : roomName.trim();
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record RoomExitNarrationData(
            String label,
            DungeonCell cell,
            DungeonEdgeDirection direction,
            String description
    ) {
        public RoomExitNarrationData {
            label = label == null || label.isBlank() ? "Ausgang" : label.trim();
            cell = cell == null ? new DungeonCell(0, 0, 0) : cell;
            direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
            description = description == null ? "" : description;
        }
    }

    private final DungeonMapRepository repository;
    private final DungeonMapSearch search;
    private final BuildDungeonDerivedStateUseCase derive;

    public LoadDungeonSnapshotUseCase(
            DungeonMapRepository repository,
            DungeonMapSearch search,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.search = search;
        this.derive = derive;
    }

    public DungeonSnapshotData execute() {
        return snapshotData(loadCurrentMap());
    }

    public DungeonSnapshotData execute(DungeonMapIdentity mapId) {
        return snapshotData(loadMap(mapId));
    }

    private DungeonSnapshotData snapshotData(DungeonMap dungeonMap) {
        return new DungeonSnapshotData(
                dungeonMap.metadata().mapName(),
                derive.execute(dungeonMap),
                editorHandles(dungeonMap),
                dungeonMap.revision());
    }

    public static List<DungeonEditorHandleFacts> editorHandles(DungeonMap dungeonMap) {
        if (dungeonMap == null) {
            return List.of();
        }
        List<DungeonEditorHandleFacts> result = new ArrayList<>();
        appendClusterLabelHandles(result, dungeonMap);
        appendDoorHandles(result, dungeonMap);
        appendAnchorHandles(result, dungeonMap);
        appendWaypointHandles(result, dungeonMap);
        appendStairHandles(result, dungeonMap);
        return List.copyOf(result);
    }

    private static void appendClusterLabelHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> rooms = dungeonMap.rooms().rooms().stream()
                    .filter(room -> room.clusterId() == cluster.clusterId())
                    .sorted(Comparator.comparingLong(DungeonRoom::roomId))
                    .toList();
            if (rooms.isEmpty()) {
                continue;
            }
            DungeonRoom room = rooms.getFirst();
            result.add(new DungeonEditorHandleFacts(
                    new DungeonEditorHandle(
                            DungeonEditorHandleType.CLUSTER_LABEL,
                            new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.roomId()),
                            room.roomId(),
                            cluster.clusterId(),
                            0L,
                            room.roomId(),
                            0,
                            cluster.center(),
                            DungeonEdgeDirection.NORTH),
                    room.name()));
        }
    }

    private static void appendDoorHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (int index = 0; index < corridor.bindings().doorBindings().size(); index++) {
                var binding = corridor.bindings().doorBindings().get(index);
                DungeonRoomCluster cluster = cluster(dungeonMap, binding.clusterId());
                DungeonCell roomCell = binding.relativeCell();
                DungeonCell absoluteRoomCell = cluster == null
                        ? roomCell
                        : new DungeonCell(
                                cluster.center().q() + roomCell.q(),
                                cluster.center().r() + roomCell.r(),
                                roomCell.level());
                DungeonCell corridorCell = binding.direction().neighborOf(absoluteRoomCell);
                result.add(new DungeonEditorHandleFacts(
                        new DungeonEditorHandle(
                                DungeonEditorHandleType.DOOR,
                                binding.topologyRef(),
                                binding.topologyRef().present() ? binding.topologyRef().id() : corridor.corridorId(),
                                binding.clusterId(),
                                corridor.corridorId(),
                                binding.roomId(),
                                index,
                                corridorCell,
                                binding.direction()),
                        "Tuer " + corridor.corridorId() + "." + (index + 1)));
            }
        }
    }

    private static void appendWaypointHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (int index = 0; index < corridor.bindings().waypoints().size(); index++) {
                var waypoint = corridor.bindings().waypoints().get(index);
                DungeonRoomCluster cluster = cluster(dungeonMap, waypoint.clusterId());
                DungeonCell absolute = cluster == null
                        ? waypoint.relativeCell()
                        : waypoint.absoluteCell(cluster.center());
                result.add(new DungeonEditorHandleFacts(
                        new DungeonEditorHandle(
                                DungeonEditorHandleType.CORRIDOR_WAYPOINT,
                                new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, corridor.corridorId()),
                                corridor.corridorId(),
                                waypoint.clusterId(),
                                corridor.corridorId(),
                                0L,
                                index,
                                absolute,
                                DungeonEdgeDirection.NORTH),
                        "Wegpunkt " + (index + 1)));
            }
        }
    }

    private static void appendAnchorHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (int index = 0; index < corridor.bindings().anchorBindings().size(); index++) {
                var anchor = corridor.bindings().anchorBindings().get(index);
                result.add(new DungeonEditorHandleFacts(
                        new DungeonEditorHandle(
                                DungeonEditorHandleType.CORRIDOR_ANCHOR,
                                anchor.topologyRef(),
                                anchor.anchorId(),
                                0L,
                                corridor.corridorId(),
                                0L,
                                index,
                                anchor.absoluteCell(),
                                DungeonEdgeDirection.NORTH),
                        "Korridoranker " + (index + 1)));
            }
        }
    }

    private static void appendStairHandles(List<DungeonEditorHandleFacts> result, DungeonMap dungeonMap) {
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            for (int index = 0; index < stair.path().size(); index++) {
                result.add(stairHandle(stair, stair.path().get(index), index, "Treppenanker " + (index + 1)));
            }
            int offset = stair.path().size();
            for (int index = 0; index < stair.exits().size(); index++) {
                DungeonStairExit exit = stair.exits().get(index);
                result.add(stairHandle(stair, exit.position(), offset + index, exit.label()));
            }
        }
    }

    private static DungeonEditorHandleFacts stairHandle(DungeonStair stair, DungeonCell cell, int index, String label) {
        return new DungeonEditorHandleFacts(
                new DungeonEditorHandle(
                        DungeonEditorHandleType.STAIR_ANCHOR,
                        new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, stair.stairId()),
                        stair.stairId(),
                        0L,
                        stair.corridorId() == null ? 0L : stair.corridorId(),
                        0L,
                        index,
                        cell,
                        stair.direction()),
                label);
    }

    private static @Nullable DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        return dungeonMap.topology().roomClusters().stream()
                .filter(candidate -> candidate.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    public InspectorSnapshotData describeSelection(
            DungeonMapIdentity mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        DungeonMap dungeonMap = loadMap(mapId);
        DungeonDerivedState derived = derive.execute(dungeonMap);
        DungeonTopologyRef safeRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
        List<RoomNarrationData> narrations = roomNarrations(dungeonMap, derived, safeRef, clusterId, clusterSelection);
        InspectorSnapshotData selectionFacts = selectionFacts(derived, safeRef);
        if (!narrations.isEmpty() && selectionFacts.title().equals("Dungeon")) {
            return new InspectorSnapshotData(
                    narrations.size() == 1 ? narrations.getFirst().roomName() : "Raumgruppe",
                    narrations.size() == 1 ? "Raumbeschreibung" : "Raumbeschreibungen im ausgewaehlten Cluster",
                    selectionFacts.facts(),
                    narrations);
        }
        return new InspectorSnapshotData(
                selectionFacts.title(),
                selectionFacts.description(),
                selectionFacts.facts(),
                narrations);
    }

    private InspectorSnapshotData selectionFacts(DungeonDerivedState derived, DungeonTopologyRef topologyRef) {
        if (topologyRef == null || !topologyRef.present()) {
            return new InspectorSnapshotData("Dungeon", "No selection details available.", List.of("selection: none"));
        }
        for (DungeonAreaFacts area : derived.map().areas()) {
            if (topologyRef.equals(area.topologyRef())) {
                return new InspectorSnapshotData(
                        area.label(),
                        "Authoriertes Dungeon-Areal.",
                        List.of(
                                "ref: " + topologyRef.kind() + " " + topologyRef.id(),
                                "kind: " + area.kind(),
                                "cells: " + area.cells().size()));
            }
        }
        for (DungeonBoundaryFacts boundary : derived.map().boundaries()) {
            if (topologyRef.equals(boundary.topologyRef())) {
                return new InspectorSnapshotData(
                        boundary.label(),
                        "Authorisierte Dungeon-Grenze.",
                        List.of(
                                "ref: " + topologyRef.kind() + " " + topologyRef.id(),
                                "kind: " + boundary.kind()));
            }
        }
        for (DungeonFeatureFacts feature : derived.map().features()) {
            if (topologyRef.equals(feature.topologyRef())) {
                List<String> facts = new ArrayList<>();
                facts.add("ref: " + topologyRef.kind() + " " + topologyRef.id());
                facts.add("kind: " + feature.kind());
                if (!feature.destinationLabel().isBlank()) {
                    facts.add("target: " + feature.destinationLabel());
                }
                return new InspectorSnapshotData(feature.label(), feature.description(), facts);
            }
        }
        for (DungeonAggregate aggregate : derived.aggregates()) {
            if (aggregate.id() == topologyRef.id()
                    && topologyRef.kind().name().equalsIgnoreCase(aggregate.kind().name())) {
                return new InspectorSnapshotData(
                        aggregate.label(),
                        "Aggregate owner in committed dungeon truth.",
                        List.of(
                                "id: " + aggregate.id(),
                                "kind: " + topologyRef.kind(),
                                "label: " + aggregate.label()
                        )
                );
            }
        }
        for (DungeonPrimitive primitive : derived.primitives()) {
            if (primitive.id() == topologyRef.id()) {
                List<String> facts = new ArrayList<>();
                facts.add("id: " + primitive.id());
                facts.add("kind: " + topologyRef.kind());
                return new InspectorSnapshotData("Primitive " + topologyRef.id(), "Primitive boundary object.", facts);
            }
        }
        return new InspectorSnapshotData("Dungeon", "No selection details available.", List.of("selection: none"));
    }

    private List<RoomNarrationData> roomNarrations(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        List<DungeonRoom> selectedRooms = selectedRooms(dungeonMap, topologyRef, clusterId, clusterSelection);
        if (selectedRooms.isEmpty()) {
            return List.of();
        }
        return selectedRooms.stream()
                .sorted(Comparator
                        .comparing(DungeonRoom::name, String.CASE_INSENSITIVE_ORDER)
                        .thenComparingLong(DungeonRoom::roomId))
                .map(room -> roomNarration(derived, room))
                .toList();
    }

    private static List<DungeonRoom> selectedRooms(
            DungeonMap dungeonMap,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        if (clusterSelection && clusterId > 0L) {
            return dungeonMap.rooms().rooms().stream()
                    .filter(room -> room.clusterId() == clusterId)
                    .toList();
        }
        if (topologyRef == null || topologyRef.kind() != src.domain.dungeon.map.value.DungeonTopologyElementKind.ROOM) {
            return List.of();
        }
        return dungeonMap.rooms().findRoom(topologyRef.id()).stream().toList();
    }

    private RoomNarrationData roomNarration(DungeonDerivedState derived, DungeonRoom room) {
        Set<DungeonCell> roomCells = areaForRoom(derived, room.roomId())
                .map(area -> Set.copyOf(area.cells()))
                .orElseGet(Set::of);
        return new RoomNarrationData(
                room.roomId(),
                room.name(),
                room.narration().visualDescription(),
                derived.traversalLinks().stream()
                        .filter(link -> link.touches(roomCells))
                        .flatMap(link -> exitNarration(room, link, roomCells).stream())
                        .sorted(Comparator
                                .comparing(RoomExitNarrationData::label, String.CASE_INSENSITIVE_ORDER)
                                .thenComparing(exit -> exit.direction().name()))
                        .toList());
    }

    private static Optional<RoomExitNarrationData> exitNarration(
            DungeonRoom room,
            DungeonTraversalLink link,
            Set<DungeonCell> roomCells
    ) {
        DungeonTraversalEndpoint endpoint = link.endpointFrom(roomCells);
        DungeonEdgeDirection direction = endpoint == null ? null : link.directionFrom(endpoint.tile());
        if (endpoint == null || direction == null) {
            return Optional.empty();
        }
        return Optional.of(new RoomExitNarrationData(
                link.source().label(),
                endpoint.tile(),
                direction,
                room.narration().exitDescriptions().stream()
                        .filter(exit -> exit.roomCell().equals(endpoint.tile()) && exit.direction() == direction)
                        .map(DungeonRoomExitDescription::description)
                        .findFirst()
                        .orElse("")));
    }

    private static Optional<DungeonAreaFacts> areaForRoom(DungeonDerivedState derived, long roomId) {
        return derived.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaType.ROOM && area.id() == roomId)
                .findFirst();
    }

    private DungeonMap loadMap(DungeonMapIdentity mapId) {
        if (mapId != null) {
            return repository.findById(mapId).orElseGet(this::loadCurrentMap);
        }
        return loadCurrentMap();
    }

    private DungeonMap loadCurrentMap() {
        return search.firstMap()
                .orElseGet(LoadDungeonSnapshotUseCase::emptyFallbackMap);
    }

    private static DungeonMap emptyFallbackMap() {
        return DungeonMap.empty(new DungeonMapIdentity(1L), "Dungeon Map");
    }
}
