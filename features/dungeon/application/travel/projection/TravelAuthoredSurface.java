package features.dungeon.application.travel.projection;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.transition.TransitionDestinationTarget;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.MapData;
import features.dungeon.api.DungeonChunkKey;

public final class TravelAuthoredSurface {
    private final Header header;
    private final Content content;

    public TravelAuthoredSurface(Header header, Content content) {
        this.header = header == null ? Header.empty() : header;
        this.content = content == null ? Content.empty() : content;
    }

    public Header header() {
        return header;
    }

    Content content() {
        return content;
    }

    List<Transition> transitions() {
        return content.transitions();
    }

    List<TraversalLinkInput> traversalLinks() {
        return content.traversalLinks();
    }

    public MapData map() {
        return content.map();
    }

    public List<DungeonChunkKey> loadedChunks() {
        return content.loadedChunks();
    }

    public static TravelAuthoredSurface empty() {
        return new TravelAuthoredSurface(Header.empty(), Content.empty());
    }

    public @Nullable Transition transition(long transitionId) {
        for (Transition transition : transitions()) {
            if (transition.transitionId() == transitionId) {
                return transition;
            }
        }
        return null;
    }

    public record Header(
            long mapId,
            String mapName,
            long revision
    ) {
        public Header {
            mapId = Math.max(1L, mapId);
            mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
            revision = Math.max(0L, revision);
        }

        private static Header empty() {
            return new Header(1L, "Dungeon", 0L);
        }
    }

    public record Content(
            MapData map,
            List<Transition> transitions,
            List<TraversalLinkInput> traversalLinks,
            List<CorridorConnection> connections,
            List<RoomNarration> roomNarrations,
            List<DungeonChunkKey> loadedChunks
    ) {
        public Content(
                MapData map,
                List<Transition> transitions,
                List<TraversalLinkInput> traversalLinks,
                List<CorridorConnection> connections,
                List<RoomNarration> roomNarrations
        ) {
            this(map, transitions, traversalLinks, connections, roomNarrations, List.of());
        }

        public Content {
            map = map == null ? MapData.empty() : map;
            transitions = transitions == null ? List.of() : List.copyOf(transitions);
            traversalLinks = traversalLinks == null ? List.of() : List.copyOf(traversalLinks);
            connections = connections == null ? List.of() : List.copyOf(connections);
            roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
            loadedChunks = loadedChunks == null ? List.of() : List.copyOf(loadedChunks);
        }

        private static Content empty() {
            return new Content(MapData.empty(), List.of(), List.of(), List.of(), List.of(), List.of());
        }

    }

    public record Transition(
            long transitionId,
            String label,
            String description,
            @Nullable Cell anchor,
            TransitionDestination destination
    ) {
        public Transition {
            transitionId = Math.max(0L, transitionId);
            label = label == null ? "" : label.trim();
            description = description == null ? "" : description.trim();
            destination = Objects.requireNonNull(destination, "destination");
        }
    }

    record TransitionDestination(
            TransitionDestinationKind kind,
            long mapId,
            long tileId,
            TransitionDestinationTarget transitionTarget
    ) {
        TransitionDestination {
            kind = Objects.requireNonNull(kind, "kind");
            mapId = kind.isUnlinkedEntrance() ? 0L : Math.max(0L, mapId);
            tileId = kind.isOverworldTile() ? Math.max(0L, tileId) : 0L;
            transitionTarget = kind.isDungeonMap() && transitionTarget != null
                    ? transitionTarget
                    : TransitionDestinationTarget.absent();
        }

        static TransitionDestination dungeonMap(
                long mapId,
                TransitionDestinationTarget transitionTarget
        ) {
            return new TransitionDestination(
                    TransitionDestinationKind.DUNGEON_MAP,
                    mapId,
                    0L,
                    transitionTarget);
        }

        static TransitionDestination overworldTile(long mapId, long tileId) {
            return new TransitionDestination(
                    TransitionDestinationKind.OVERWORLD_TILE,
                    mapId,
                    tileId,
                    TransitionDestinationTarget.absent());
        }

        static TransitionDestination unlinkedEntrance() {
            return new TransitionDestination(
                    TransitionDestinationKind.UNLINKED_ENTRANCE,
                    0L,
                    0L,
                    TransitionDestinationTarget.absent());
        }

        boolean isDungeonMapDestination() {
            return kind.isDungeonMap();
        }

        boolean isOverworldTileDestination() {
            return kind.isOverworldTile();
        }

        boolean isUnlinkedEntranceDestination() {
            return kind.isUnlinkedEntrance();
        }

        @Nullable Long transitionId() {
            return transitionTarget.asNullableLong();
        }

    }

    enum TransitionDestinationKind {
        DUNGEON_MAP,
        OVERWORLD_TILE,
        UNLINKED_ENTRANCE;

        private boolean isDungeonMap() {
            return this == DUNGEON_MAP;
        }

        private boolean isOverworldTile() {
            return this == OVERWORLD_TILE;
        }

        private boolean isUnlinkedEntrance() {
            return this == UNLINKED_ENTRANCE;
        }
    }

    record TraversalLinkInput(
            String key,
            TraversalSource source,
            TraversalEndpoint firstEndpoint,
            TraversalEndpoint secondEndpoint
    ) {
    }

    record CorridorConnection(long corridorId, long roomId) {
    }

    record RoomNarration(long roomId, List<RoomExit> exits) {
        RoomNarration {
            exits = exits == null ? List.of() : List.copyOf(exits);
        }

        String exitDescription(Cell sourceTile, @Nullable Direction direction) {
            for (RoomExit exit : exits) {
                if (exit.matches(sourceTile, direction) && !exit.description().isBlank()) {
                    return exit.description();
                }
            }
            return "";
        }
    }

    record RoomExit(Cell roomCell, Direction direction, String description) {
        RoomExit {
            roomCell = roomCell == null ? new Cell(0, 0, 0) : roomCell;
            direction = direction == null ? Direction.NORTH : direction;
            description = description == null ? "" : description;
        }

        boolean matches(Cell sourceTile, @Nullable Direction candidateDirection) {
            return roomCell.equals(sourceTile) && direction == candidateDirection;
        }
    }
}
