package src.domain.dungeon.model.worldspace.repository;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.core.projection.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonEdgeDirection;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleProjection;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;

public interface DungeonAuthoredPublishedStateRepository {

    void publishSnapshot(SnapshotPublication snapshot);

    void publishInspector(InspectorPublication inspector);

    void publishMutation(MutationPublication result);

    void publishSearch(CatalogPublication result);

    void publishCreated(MapMutationPublication mutation);

    void publishRenamed(MapMutationPublication mutation);

    void publishDeleted(MapMutationPublication mutation);

    final class SnapshotPublication {
        private final String mapName;
        private final DungeonDerivedState derived;
        private final List<DungeonEditorHandleProjection> editorHandles;
        private final long revision;

        public SnapshotPublication(
                String mapName,
                DungeonDerivedState derived,
                List<DungeonEditorHandleProjection> editorHandles,
                long revision
        ) {
            this.mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName;
            this.derived = derived;
            this.editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
            this.revision = revision;
        }

        public String mapName() {
            return mapName;
        }

        public DungeonDerivedState derived() {
            return derived;
        }

        public List<DungeonEditorHandleProjection> editorHandles() {
            return editorHandles;
        }

        public long revision() {
            return revision;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof SnapshotPublication that
                    && revision == that.revision
                    && Objects.equals(mapName, that.mapName)
                    && Objects.equals(derived, that.derived)
                    && Objects.equals(editorHandles, that.editorHandles);
        }

        @Override
        public int hashCode() {
            return Objects.hash(mapName, derived, editorHandles, revision);
        }

        @Override
        public String toString() {
            return "SnapshotPublication[mapName=" + mapName
                    + ", derived=" + derived
                    + ", editorHandles=" + editorHandles
                    + ", revision=" + revision + "]";
        }
    }

    final class InspectorPublication {
        private final String title;
        private final String description;
        private final List<String> facts;
        private final List<RoomNarrationPublication> roomNarrations;

        public InspectorPublication(
                String title,
                String description,
                List<String> facts,
                List<RoomNarrationPublication> roomNarrations
        ) {
            this.title = title == null ? "" : title;
            this.description = description == null ? "" : description;
            this.facts = facts == null ? List.of() : List.copyOf(facts);
            this.roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }

        public String title() {
            return title;
        }

        public String description() {
            return description;
        }

        public List<String> facts() {
            return facts;
        }

        public List<RoomNarrationPublication> roomNarrations() {
            return roomNarrations;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof InspectorPublication that
                    && Objects.equals(title, that.title)
                    && Objects.equals(description, that.description)
                    && Objects.equals(facts, that.facts)
                    && Objects.equals(roomNarrations, that.roomNarrations);
        }

        @Override
        public int hashCode() {
            return Objects.hash(title, description, facts, roomNarrations);
        }

        @Override
        public String toString() {
            return "InspectorPublication[title=" + title
                    + ", description=" + description
                    + ", facts=" + facts
                    + ", roomNarrations=" + roomNarrations + "]";
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

    final class RoomNarrationPublication {
        private final long roomId;
        private final String roomName;
        private final String visualDescription;
        private final List<RoomExitNarrationPublication> exits;

        public RoomNarrationPublication(
                long roomId,
                String roomName,
                String visualDescription,
                List<RoomExitNarrationPublication> exits
        ) {
            this.roomId = roomId;
            this.roomName = roomName == null || roomName.isBlank() ? "Raum " + roomId : roomName;
            this.visualDescription = visualDescription == null ? "" : visualDescription;
            this.exits = exits == null ? List.of() : List.copyOf(exits);
        }

        public long roomId() {
            return roomId;
        }

        public String roomName() {
            return roomName;
        }

        public String visualDescription() {
            return visualDescription;
        }

        public List<RoomExitNarrationPublication> exits() {
            return exits;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof RoomNarrationPublication that
                    && roomId == that.roomId
                    && Objects.equals(roomName, that.roomName)
                    && Objects.equals(visualDescription, that.visualDescription)
                    && Objects.equals(exits, that.exits);
        }

        @Override
        public int hashCode() {
            return Objects.hash(roomId, roomName, visualDescription, exits);
        }

        @Override
        public String toString() {
            return "RoomNarrationPublication[roomId=" + roomId
                    + ", roomName=" + roomName
                    + ", visualDescription=" + visualDescription
                    + ", exits=" + exits + "]";
        }
    }

    final class RoomExitNarrationPublication {
        private final String label;
        private final DungeonCell cell;
        private final DungeonEdgeDirection direction;
        private final String description;

        public RoomExitNarrationPublication(
                String label,
                DungeonCell cell,
                DungeonEdgeDirection direction,
                String description
        ) {
            this.label = label == null || label.isBlank() ? "Ausgang" : label;
            this.cell = cell == null ? new DungeonCell(0, 0, 0) : cell;
            this.direction = direction == null ? DungeonEdgeDirection.NORTH : direction;
            this.description = description == null ? "" : description;
        }

        public String label() {
            return label;
        }

        public DungeonCell cell() {
            return cell;
        }

        public DungeonEdgeDirection direction() {
            return direction;
        }

        public String description() {
            return description;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof RoomExitNarrationPublication that
                    && Objects.equals(label, that.label)
                    && Objects.equals(cell, that.cell)
                    && direction == that.direction
                    && Objects.equals(description, that.description);
        }

        @Override
        public int hashCode() {
            return Objects.hash(label, cell, direction, description);
        }

        @Override
        public String toString() {
            return "RoomExitNarrationPublication[label=" + label
                    + ", cell=" + cell
                    + ", direction=" + direction
                    + ", description=" + description + "]";
        }
    }
}
