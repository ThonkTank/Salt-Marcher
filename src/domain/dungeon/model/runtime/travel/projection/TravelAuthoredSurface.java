package src.domain.dungeon.model.runtime.travel.projection;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.MapData;

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

    MapData map() {
        return content.map();
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
            List<RoomNarration> roomNarrations
    ) {
        public Content {
            map = map == null ? MapData.empty() : map;
            transitions = transitions == null ? List.of() : List.copyOf(transitions);
            traversalLinks = traversalLinks == null ? List.of() : List.copyOf(traversalLinks);
            connections = connections == null ? List.of() : List.copyOf(connections);
            roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }

        private static Content empty() {
            return new Content(MapData.empty(), List.of(), List.of(), List.of(), List.of());
        }

    }

    public record Transition(
            long transitionId,
            String label,
            String description,
            @Nullable Cell anchor,
            @Nullable TransitionDestination destination
    ) {
        public Transition {
            transitionId = Math.max(0L, transitionId);
            label = label == null ? "" : label.trim();
            description = description == null ? "" : description.trim();
        }
    }

    record TransitionDestination(
            TransitionDestinationKind kind,
            long mapId,
            long tileId,
            @Nullable Long transitionId
    ) {
        static TransitionDestination dungeonMap(long mapId, @Nullable Long transitionId) {
            return new TransitionDestination(TransitionDestinationKind.DUNGEON_MAP, mapId, 0L, transitionId);
        }

        static TransitionDestination overworldTile(long mapId, long tileId) {
            return new TransitionDestination(TransitionDestinationKind.OVERWORLD_TILE, mapId, tileId, null);
        }

        boolean isDungeonMapDestination() {
            return kind == TransitionDestinationKind.DUNGEON_MAP;
        }

        boolean isOverworldTileDestination() {
            return kind == TransitionDestinationKind.OVERWORLD_TILE;
        }
    }

    enum TransitionDestinationKind {
        DUNGEON_MAP,
        OVERWORLD_TILE
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
