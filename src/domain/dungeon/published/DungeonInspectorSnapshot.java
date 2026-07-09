package src.domain.dungeon.published;

import java.util.List;

/**
 * Read-only inspector payload published by the dungeon API.
 */
public record DungeonInspectorSnapshot(
        String title,
        String summary,
        /*
         * LEGACY_REMOVE_ON_TOUCH: display/debug compatibility only. Remove when
         * generic inspector displays and legacy selection harness assertions read
         * title/summary/statePanelFacts instead of key/value fact lines.
         */
        List<String> facts,
        StatePanelFacts statePanelFacts,
        List<RoomNarrationCard> roomNarrations
) {

    public DungeonInspectorSnapshot(
            String title,
            String summary,
            List<String> facts,
            List<RoomNarrationCard> roomNarrations
    ) {
        this(title, summary, facts, StatePanelFacts.empty(), roomNarrations);
    }

    public DungeonInspectorSnapshot {
        title = title == null || title.isBlank() ? "Dungeon" : title;
        summary = summary == null ? "" : summary;
        facts = facts == null ? List.of() : List.copyOf(facts);
        statePanelFacts = statePanelFacts == null ? StatePanelFacts.empty() : statePanelFacts;
        roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
    }

    public record StatePanelFacts(
            StairGeometryFacts stairGeometry,
            TransitionDestinationFacts transitionDestination
    ) {

        public StatePanelFacts {
            stairGeometry = stairGeometry == null ? StairGeometryFacts.empty() : stairGeometry;
            transitionDestination =
                    transitionDestination == null ? TransitionDestinationFacts.empty() : transitionDestination;
        }

        public static StatePanelFacts empty() {
            return new StatePanelFacts(StairGeometryFacts.empty(), TransitionDestinationFacts.empty());
        }
    }

    public record StairGeometryFacts(
            boolean present,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {

        public StairGeometryFacts {
            stairId = Math.max(0L, stairId);
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName.strip();
            directionName = directionName == null || directionName.isBlank() ? "NORTH" : directionName.strip();
            dimension1 = Math.max(0, dimension1);
            dimension2 = Math.max(0, dimension2);
            present = present && stairId > 0L;
        }

        public static StairGeometryFacts empty() {
            return new StairGeometryFacts(false, 0L, "", "", 0, 0);
        }
    }

    public record TransitionDestinationFacts(
            boolean present,
            String destinationTypeKey,
            long mapId,
            long tileId,
            long transitionId
    ) {

        public TransitionDestinationFacts {
            destinationTypeKey = destinationTypeKey == null || destinationTypeKey.isBlank()
                    ? "UNLINKED_ENTRANCE"
                    : destinationTypeKey.strip();
            mapId = Math.max(0L, mapId);
            tileId = Math.max(0L, tileId);
            transitionId = Math.max(0L, transitionId);
        }

        public static TransitionDestinationFacts empty() {
            return new TransitionDestinationFacts(false, "UNLINKED_ENTRANCE", 0L, 0L, 0L);
        }
    }

    public record RoomNarrationCard(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarration> exits
    ) {

        public RoomNarrationCard {
            roomId = Math.max(0L, roomId);
            roomName = roomName == null || roomName.isBlank() ? "Raum" : roomName.trim();
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record RoomExitNarration(
            String label,
            DungeonCellRef cell,
            String direction,
            String description
    ) {

        public RoomExitNarration {
            label = label == null || label.isBlank() ? "Ausgang" : label.trim();
            cell = cell == null ? new DungeonCellRef(0, 0, 0) : cell;
            direction = direction == null || direction.isBlank() ? "NORTH" : direction.trim();
            description = description == null ? "" : description;
        }
    }
}
