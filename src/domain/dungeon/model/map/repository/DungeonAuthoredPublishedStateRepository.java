package src.domain.dungeon.model.map.repository;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;

public interface DungeonAuthoredPublishedStateRepository {

    void publishSnapshot(SnapshotPublication snapshot);

    void publishInspector(InspectorPublication inspector);

    void publishMutation(MutationPublication result);

    void publishSearch(CatalogPublication result);

    void publishCreated(MapMutationPublication mutation);

    void publishRenamed(MapMutationPublication mutation);

    void publishDeleted(MapMutationPublication mutation);

    record SnapshotPublication(
            String mapName,
            DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        public SnapshotPublication {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName;
            editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
        }
    }

    record InspectorPublication(
            String title,
            String description,
            List<String> facts,
            List<RoomNarrationPublication> roomNarrations
    ) {
        public InspectorPublication {
            title = title == null ? "" : title;
            description = description == null ? "" : description;
            facts = facts == null ? List.of() : List.copyOf(facts);
            roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }
    }

    record MutationPublication(
            @Nullable SnapshotPublication snapshot,
            List<String> validationMessages,
            List<String> reactionMessages
    ) {
        public MutationPublication {
            validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
            reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
        }
    }

    record CatalogPublication(List<MapSummaryPublication> maps) {
        public CatalogPublication {
            maps = maps == null ? List.of() : List.copyOf(maps);
        }
    }

    record MapMutationPublication(DungeonMapIdentity mapId) {
    }

    record MapSummaryPublication(DungeonMapIdentity mapId, String mapName, long revision) {
        public MapSummaryPublication {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        }
    }

    record RoomNarrationPublication(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarrationPublication> exits
    ) {
        public RoomNarrationPublication {
            roomName = roomName == null || roomName.isBlank() ? "Raum " + roomId : roomName;
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    record RoomExitNarrationPublication(
            String label,
            DungeonCell cell,
            DungeonEdgeDirection direction,
            String description
    ) {
        public RoomExitNarrationPublication {
            label = label == null || label.isBlank() ? "Ausgang" : label;
            cell = cell == null ? new DungeonCell(0, 0, 0) : cell;
            direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
            description = description == null ? "" : description;
        }
    }
}
