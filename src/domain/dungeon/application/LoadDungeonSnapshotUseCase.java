package src.domain.dungeon.application;

import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonEditorHandleFacts;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTopologyRef;

import java.util.List;

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

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final AssembleDungeonSnapshotUseCase assembleDungeonSnapshot;
    private final PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles;
    private final InspectDungeonSelectionUseCase inspectDungeonSelection;

    public LoadDungeonSnapshotUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            AssembleDungeonSnapshotUseCase assembleDungeonSnapshot,
            PublishDungeonEditorHandlesUseCase publishDungeonEditorHandles,
            InspectDungeonSelectionUseCase inspectDungeonSelection
    ) {
        this.loadDungeonMap = loadDungeonMap;
        this.assembleDungeonSnapshot = assembleDungeonSnapshot;
        this.publishDungeonEditorHandles = publishDungeonEditorHandles;
        this.inspectDungeonSelection = inspectDungeonSelection;
    }

    public DungeonSnapshotData execute() {
        return snapshotData(loadDungeonMap.execute());
    }

    public DungeonSnapshotData execute(DungeonMapIdentity mapId) {
        return snapshotData(loadDungeonMap.execute(mapId));
    }

    private DungeonSnapshotData snapshotData(src.domain.dungeon.map.aggregate.DungeonMap dungeonMap) {
        return assembleDungeonSnapshot.execute(
                dungeonMap,
                publishDungeonEditorHandles.execute(dungeonMap));
    }

    public InspectorSnapshotData describeSelection(
            DungeonMapIdentity mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        return inspectDungeonSelection.execute(
                loadDungeonMap.execute(mapId),
                topologyRef,
                clusterId,
                clusterSelection);
    }
}
