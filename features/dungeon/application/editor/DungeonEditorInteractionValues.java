package features.dungeon.application.editor;

import java.util.Comparator;
import java.util.Objects;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;

final class DungeonEditorInteractionValues {

    private DungeonEditorInteractionValues() {
    }

    static VertexKey vertexKey(VertexTarget target) {
        return new VertexKey(target.q(), target.r(), target.level());
    }

    static final class CellTarget {
        private final int q;
        private final int r;
        private final int level;

        CellTarget(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        static CellTarget empty() {
            return new CellTarget(0, 0, 0);
        }

        int q() {
            return q;
        }

        int r() {
            return r;
        }

        int level() {
            return level;
        }

        DungeonEditorWorkspaceValues.Cell toWorkspaceCell() {
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

    record VertexTarget(
            boolean present,
            int q,
            int r,
            int level
    ) {
        private static final VertexTarget EMPTY = new VertexTarget(false, 0, 0, 0);

        static VertexTarget empty() {
            return EMPTY;
        }
    }

    static final class CellKey {
        private final int q;
        private final int r;
        private final int level;

        CellKey(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        int q() {
            return q;
        }

        int r() {
            return r;
        }

        int level() {
            return level;
        }

        CellKey neighbor(TravelHeading heading) {
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

    static final class VertexKey {
        private static final Comparator<VertexKey> ORDER = VertexKey::compareVertices;

        private final int q;
        private final int r;
        private final int level;

        VertexKey(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        static Comparator<VertexKey> order() {
            return ORDER;
        }

        int q() {
            return q;
        }

        int r() {
            return r;
        }

        int level() {
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

        private static int compareVertices(VertexKey left, VertexKey right) {
            int levelOrder = Integer.compare(left.level, right.level);
            if (levelOrder != 0) {
                return levelOrder;
            }
            int rowOrder = Integer.compare(left.r, right.r);
            return rowOrder != 0 ? rowOrder : Integer.compare(left.q, right.q);
        }
    }

    enum TravelHeading {
        NORTH(0, -1),
        EAST(1, 0),
        SOUTH(0, 1),
        WEST(-1, 0);

        private final int deltaQ;
        private final int deltaR;

        TravelHeading(int deltaQ, int deltaR) {
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
        }

        int deltaQ() {
            return deltaQ;
        }

        int deltaR() {
            return deltaR;
        }
    }
}
