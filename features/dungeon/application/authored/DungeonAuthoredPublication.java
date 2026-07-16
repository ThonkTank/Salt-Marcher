package features.dungeon.application.authored;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.application.editor.interaction.DungeonEditorHandleProjection;

final class DungeonAuthoredPublication {

    private DungeonAuthoredPublication() {
    }

    static Snapshot snapshot(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleProjection> editorHandles,
            long revision
    ) {
        return new Snapshot(mapName, derived, editorHandles, revision);
    }

    record Snapshot(
            String mapName,
            @Nullable DungeonDerivedState derived,
            List<DungeonEditorHandleProjection> editorHandles,
            long revision
    ) {
        Snapshot {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName;
            editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
        }

        @Override
        public List<DungeonEditorHandleProjection> editorHandles() {
            return List.copyOf(editorHandles);
        }
    }

    record Inspector(
            String title,
            String description,
            StatePanelFacts statePanelFacts,
            List<RoomNarration> roomNarrations
    ) {
        Inspector {
            title = title == null ? "" : title;
            description = description == null ? "" : description;
            statePanelFacts = statePanelFacts == null ? StatePanelFacts.empty() : statePanelFacts;
            roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }

        @Override
        public List<RoomNarration> roomNarrations() {
            return List.copyOf(roomNarrations);
        }
    }

    record StatePanelFacts(
            StairGeometry stairGeometry,
            TransitionDestination transitionDestination
    ) {
        StatePanelFacts {
            stairGeometry = stairGeometry == null ? StairGeometry.empty() : stairGeometry;
            transitionDestination = transitionDestination == null
                    ? TransitionDestination.empty()
                    : transitionDestination;
        }

        static StatePanelFacts empty() {
            return new StatePanelFacts(StairGeometry.empty(), TransitionDestination.empty());
        }
    }

    record StairGeometry(
            boolean present,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        StairGeometry {
            stairId = Math.max(0L, stairId);
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName.strip();
            directionName = directionName == null || directionName.isBlank() ? "NORTH" : directionName.strip();
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
            present = present && stairId > 0L;
        }

        static StairGeometry empty() {
            return new StairGeometry(false, 0L, "", "", 0, 0);
        }
    }

    record TransitionDestination(
            boolean present,
            String destinationTypeKey,
            long mapId,
            long tileId,
            long transitionId
    ) {
        TransitionDestination {
            destinationTypeKey = destinationTypeKey == null || destinationTypeKey.isBlank()
                    ? "UNLINKED_ENTRANCE"
                    : destinationTypeKey.strip();
            mapId = Math.max(0L, mapId);
            tileId = Math.max(0L, tileId);
            transitionId = Math.max(0L, transitionId);
        }

        static TransitionDestination empty() {
            return new TransitionDestination(false, "UNLINKED_ENTRANCE", 0L, 0L, 0L);
        }
    }

    record Mutation(
            @Nullable Snapshot snapshot,
            List<String> validationMessages,
            List<String> reactionMessages
    ) {
        Mutation {
            validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
            reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
        }

        @Override
        public List<String> validationMessages() {
            return List.copyOf(validationMessages);
        }

        @Override
        public List<String> reactionMessages() {
            return List.copyOf(reactionMessages);
        }
    }

    record Catalog(List<MapSummary> maps) {
        Catalog {
            maps = maps == null ? List.of() : List.copyOf(maps);
        }

        @Override
        public List<MapSummary> maps() {
            return List.copyOf(maps);
        }
    }

    record MapMutation(DungeonMapIdentity mapId) {
    }

    record MapSummary(DungeonMapIdentity mapId, String mapName, long revision) {
        MapSummary {
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
        }
    }

    record RoomNarration(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarration> exits
    ) {
        RoomNarration {
            roomName = roomName == null || roomName.isBlank() ? "Raum " + roomId : roomName;
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }

        @Override
        public List<RoomExitNarration> exits() {
            return List.copyOf(exits);
        }
    }

    record RoomExitNarration(
            String label,
            Cell cell,
            Direction direction,
            String description
    ) {
        RoomExitNarration {
            label = label == null || label.isBlank() ? "Ausgang" : label;
            cell = cell == null ? new Cell(0, 0, 0) : cell;
            direction = direction == null ? Direction.NORTH : direction;
            description = description == null ? "" : description;
        }
    }
}
