package src.domain.dungeon.model.editor.model.interaction.model;

import java.io.Serial;
import java.io.Serializable;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorInteractionValues {

    private DungeonEditorInteractionValues() {
    }

    public static VertexKey vertexKey(VertexTarget target) {
        return new VertexKey(target.q(), target.r(), target.level());
    }

    public static final class CellTarget {
        private final int q;
        private final int r;
        private final int level;

        public CellTarget(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        public static CellTarget empty() {
            return new CellTarget(0, 0, 0);
        }

        public int q() {
            return q;
        }

        public int r() {
            return r;
        }

        public int level() {
            return level;
        }

        public DungeonEditorWorkspaceValues.Cell toWorkspaceCell() {
            return new DungeonEditorWorkspaceValues.Cell(q, r, level);
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof CellTarget that)) {
                return false;
            }
            return q == that.q && r == that.r && level == that.level;
        }

        @Override
        public int hashCode() {
            return Objects.hash(q, r, level);
        }

        @Override
        public String toString() {
            return "CellTarget[q=%d, r=%d, level=%d]".formatted(q, r, level);
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

    public static final class CellKey {
        private final int q;
        private final int r;
        private final int level;

        public CellKey(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        public int q() {
            return q;
        }

        public int r() {
            return r;
        }

        public int level() {
            return level;
        }

        public CellKey neighbor(TravelHeading heading) {
            return new CellKey(q + heading.deltaQ(), r + heading.deltaR(), level);
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof CellKey that)) {
                return false;
            }
            return q == that.q && r == that.r && level == that.level;
        }

        @Override
        public int hashCode() {
            return Objects.hash(q, r, level);
        }

        @Override
        public String toString() {
            return "CellKey[q=%d, r=%d, level=%d]".formatted(q, r, level);
        }
    }

    public static final class VertexKey {
        private static final Comparator<VertexKey> ORDER = new VertexKeyOrder();

        private final int q;
        private final int r;
        private final int level;

        public VertexKey(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        public static Comparator<VertexKey> order() {
            return ORDER;
        }

        public int q() {
            return q;
        }

        public int r() {
            return r;
        }

        public int level() {
            return level;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof VertexKey that)) {
                return false;
            }
            return q == that.q && r == that.r && level == that.level;
        }

        @Override
        public int hashCode() {
            return Objects.hash(q, r, level);
        }

        @Override
        public String toString() {
            return "VertexKey[q=%d, r=%d, level=%d]".formatted(q, r, level);
        }

        private static final class VertexKeyOrder implements Comparator<VertexKey>, Serializable {
            @Serial
            private static final long serialVersionUID = 1L;

            @Override
            public int compare(VertexKey left, VertexKey right) {
                int levelOrder = Integer.compare(left.level, right.level);
                if (levelOrder != 0) {
                    return levelOrder;
                }
                int rowOrder = Integer.compare(left.r, right.r);
                return rowOrder != 0 ? rowOrder : Integer.compare(left.q, right.q);
            }
        }
    }

    public static final class TravelHeading {
        public static final TravelHeading NORTH = new TravelHeading("NORTH", 0, -1);
        public static final TravelHeading EAST = new TravelHeading("EAST", 1, 0);
        public static final TravelHeading SOUTH = new TravelHeading("SOUTH", 0, 1);
        public static final TravelHeading WEST = new TravelHeading("WEST", -1, 0);

        private static final TravelHeading[] VALUES = {NORTH, EAST, SOUTH, WEST};
        private static final List<TravelHeading> VALUES_LIST = List.of(NORTH, EAST, SOUTH, WEST);

        private final String name;
        private final int deltaQ;
        private final int deltaR;

        private TravelHeading(String name, int deltaQ, int deltaR) {
            this.name = name;
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
        }

        public static TravelHeading[] values() {
            return VALUES.clone();
        }

        public static List<TravelHeading> valuesList() {
            return VALUES_LIST;
        }

        public static TravelHeading fromName(String name) {
            String safeName = name == null ? NORTH.name : name;
            for (TravelHeading heading : VALUES) {
                if (heading.name.equals(safeName)) {
                    return heading;
                }
            }
            return NORTH;
        }

        public String name() {
            return name;
        }

        public int deltaQ() {
            return deltaQ;
        }

        public int deltaR() {
            return deltaR;
        }

        @Override
        public String toString() {
            return name;
        }
    }
}
