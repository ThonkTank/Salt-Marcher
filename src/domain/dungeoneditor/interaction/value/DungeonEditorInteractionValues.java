package src.domain.dungeoneditor.interaction.value;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonCellRef;

public final class DungeonEditorInteractionValues {

    private DungeonEditorInteractionValues() {
    }

    public static final class CellTarget {
        private static final CellTarget EMPTY = new CellTarget(0, 0, 0);

        private final int q;
        private final int r;
        private final int level;

        public CellTarget(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        public static CellTarget empty() {
            return EMPTY;
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

        public DungeonCellRef toDungeonCellRef() {
            return new DungeonCellRef(q, r, level);
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
    }

    public static final class VertexTarget {
        private static final VertexTarget EMPTY = new VertexTarget(false, 0, 0, 0);

        private final boolean present;
        private final int q;
        private final int r;
        private final int level;

        public VertexTarget(boolean present, int q, int r, int level) {
            this.present = present;
            this.q = q;
            this.r = r;
            this.level = level;
        }

        public static VertexTarget empty() {
            return EMPTY;
        }

        public boolean present() {
            return present;
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
            if (!(other instanceof VertexTarget that)) {
                return false;
            }
            return present == that.present && q == that.q && r == that.r && level == that.level;
        }

        @Override
        public int hashCode() {
            return Objects.hash(present, q, r, level);
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
    }

    public static final class VertexKey {
        private static final Comparator<VertexKey> ORDER = Comparator
                .comparingInt(VertexKey::level)
                .thenComparingInt(VertexKey::r)
                .thenComparingInt(VertexKey::q);

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
    }

    public static final class TravelHeading {
        public static final TravelHeading NORTH = new TravelHeading("NORTH", 0, -1);
        public static final TravelHeading EAST = new TravelHeading("EAST", 1, 0);
        public static final TravelHeading SOUTH = new TravelHeading("SOUTH", 0, 1);
        public static final TravelHeading WEST = new TravelHeading("WEST", -1, 0);

        private static final List<TravelHeading> VALUES = List.of(NORTH, EAST, SOUTH, WEST);

        private final String name;
        private final int deltaQ;
        private final int deltaR;

        private TravelHeading(String name, int deltaQ, int deltaR) {
            this.name = name;
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
        }

        public static List<TravelHeading> values() {
            return VALUES;
        }

        public static TravelHeading fromName(@Nullable String name) {
            return switch (name == null ? "" : name) {
                case "EAST" -> EAST;
                case "SOUTH" -> SOUTH;
                case "WEST" -> WEST;
                default -> NORTH;
            };
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
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof TravelHeading that)) {
                return false;
            }
            return name.equals(that.name);
        }

        @Override
        public int hashCode() {
            return name.hashCode();
        }

        @Override
        public String toString() {
            return name;
        }
    }
}
