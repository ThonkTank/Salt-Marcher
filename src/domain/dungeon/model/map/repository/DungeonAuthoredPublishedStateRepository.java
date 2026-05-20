package src.domain.dungeon.model.map.repository;

import java.util.List;
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

    void publishCreated(DungeonMapIdentity mapId);

    void publishRenamed(DungeonMapIdentity mapId);

    void publishDeleted(DungeonMapIdentity mapId);

    record CatalogPublication(List<MapSummaryPublication> maps) {
        public CatalogPublication {
            maps = maps == null ? List.of() : List.copyOf(maps);
        }
    }

    record MapSummaryPublication(DungeonMapIdentity mapId, String mapName, long revision) {
    }

    record SnapshotPublication(
            String mapName,
            DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        public SnapshotPublication {
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
            facts = facts == null ? List.of() : List.copyOf(facts);
            roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }
    }

    record RoomNarrationPublication(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarrationPublication> exits
    ) {
        public RoomNarrationPublication {
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    record RoomExitNarrationPublication(
            String label,
            DungeonCell cell,
            DungeonEdgeDirection direction,
            String description
    ) {
    }

    record MutationPublication(
            SnapshotPublication snapshot,
            List<String> validationMessages,
            List<String> reactionMessages
    ) {
        public MutationPublication {
            validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
            reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
        }
    }
}
