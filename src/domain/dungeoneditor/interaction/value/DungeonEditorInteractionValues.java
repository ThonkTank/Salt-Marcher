package src.domain.dungeoneditor.interaction.value;

import java.util.Comparator;
import java.util.List;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorInteractionValues {

    private DungeonEditorInteractionValues() {
    }

    public record CellTarget(
            int q,
            int r,
            int level
    ) {
        private static final CellTarget EMPTY = new CellTarget(0, 0, 0);

        public static CellTarget empty() {
            return EMPTY;
        }

        public DungeonEditorWorkspaceValues.Cell toWorkspaceCell() {
            return new DungeonEditorWorkspaceValues.Cell(q, r, level);
        }
    }

    public record VertexTarget(
            boolean present,
            int q,
            int r,
            int level
    ) {
        private static final VertexTarget EMPTY = new VertexTarget(false, 0, 0, 0);

        public static VertexTarget empty() {
            return EMPTY;
        }
    }

    public record CellKey(
            int q,
            int r,
            int level
    ) {
        public CellKey neighbor(TravelHeading heading) {
            return new CellKey(q + heading.deltaQ(), r + heading.deltaR(), level);
        }
    }

    public record VertexKey(
            int q,
            int r,
            int level
    ) {
        private static final Comparator<VertexKey> ORDER = Comparator
                .comparingInt(VertexKey::level)
                .thenComparingInt(VertexKey::r)
                .thenComparingInt(VertexKey::q);

        public static Comparator<VertexKey> order() {
            return ORDER;
        }
    }

    public enum TravelHeading {
        NORTH(0, -1),
        EAST(1, 0),
        SOUTH(0, 1),
        WEST(-1, 0);

        private static final List<TravelHeading> VALUES = List.of(values());

        private final int deltaQ;
        private final int deltaR;

        TravelHeading(int deltaQ, int deltaR) {
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
        }

        public static List<TravelHeading> valuesList() {
            return VALUES;
        }

        public static TravelHeading fromName(String name) {
            try {
                return valueOf(name == null ? NORTH.name() : name);
            } catch (IllegalArgumentException ignored) {
                return NORTH;
            }
        }

        public int deltaQ() {
            return deltaQ;
        }

        public int deltaR() {
            return deltaR;
        }
    }
}
