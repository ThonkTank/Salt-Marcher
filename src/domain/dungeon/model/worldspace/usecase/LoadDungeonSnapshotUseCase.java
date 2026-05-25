package src.domain.dungeon.model.worldspace.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.worldspace.model.DungeonEdgeDirection;
import src.domain.dungeon.model.worldspace.model.DungeonMap;
import src.domain.dungeon.model.worldspace.model.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyRef;

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

    public record AuthoredSurfaceData(
            DungeonSnapshotData snapshot,
            InspectorSnapshotData inspector
    ) {
        public AuthoredSurfaceData {
            snapshot = Objects.requireNonNull(snapshot, "snapshot");
            inspector = Objects.requireNonNull(inspector, "inspector");
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

    public DungeonSnapshotData execute(DungeonMapIdentity mapId) {
        return snapshotData(loadDungeonMap.execute(mapId));
    }

    public AuthoredSurfaceData executeWithSelection(
            DungeonMapIdentity mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        DungeonMap dungeonMap = loadDungeonMap.execute(mapId);
        DungeonSnapshotData snapshot = snapshotData(dungeonMap);
        return new AuthoredSurfaceData(
                snapshot,
                inspectDungeonSelection.execute(
                        dungeonMap,
                        snapshot.derived(),
                        topologyRef,
                        clusterId,
                        clusterSelection));
    }

    private DungeonSnapshotData snapshotData(DungeonMap dungeonMap) {
        return assembleDungeonSnapshot.execute(
                dungeonMap,
                publishDungeonEditorHandles.execute(dungeonMap));
    }

}
