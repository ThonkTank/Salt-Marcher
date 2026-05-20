package src.domain.dungeon.model.travel.model.session.model;

import java.util.List;

public final class TravelDungeonSessionValues {

    private TravelDungeonSessionValues() {
    }

    public static final class TravelOverlayState {

        private final String modeKey;
        private final int levelRange;
        private final double opacity;
        private final List<Integer> selectedLevels;

        private TravelOverlayState(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
            this.modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            this.levelRange = Math.max(0, levelRange);
            this.opacity = Math.max(0.0, Math.min(1.0, opacity));
            this.selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
        }

        public static TravelOverlayState defaults() {
            return new TravelOverlayState("OFF", 2, 0.35, List.of());
        }

        public static TravelOverlayState of(
                String modeKey,
                int levelRange,
                double opacity,
                List<Integer> selectedLevels
        ) {
            return new TravelOverlayState(modeKey, levelRange, opacity, selectedLevels);
        }

        public String modeKey() {
            return modeKey;
        }

        public int levelRange() {
            return levelRange;
        }

        public double opacity() {
            return opacity;
        }

        public List<Integer> selectedLevels() {
            return List.copyOf(selectedLevels);
        }
    }

    public enum LocationKind {
        TILE,
        TRANSITION
    }

    public static final class ContextKind {
        public static final ContextKind DUNGEON = new ContextKind("DUNGEON");
        public static final ContextKind OVERWORLD = new ContextKind("OVERWORLD");

        private final String name;

        private ContextKind(String name) {
            this.name = name;
        }

        public static ContextKind valueOf(String name) {
            return "OVERWORLD".equals(name) ? OVERWORLD : DUNGEON;
        }

        public String name() {
            return name;
        }

        public boolean isDungeon() {
            return this == DUNGEON;
        }

        public boolean isOverworld() {
            return this == OVERWORLD;
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public static final class MoveStatus {
        public static final MoveStatus SUCCESS = new MoveStatus("SUCCESS");
        public static final MoveStatus INVALID_ACTION = new MoveStatus("INVALID_ACTION");
        public static final MoveStatus TARGET_UNAVAILABLE = new MoveStatus("TARGET_UNAVAILABLE");
        public static final MoveStatus EXTERNAL_TARGET = new MoveStatus("EXTERNAL_TARGET");
        public static final MoveStatus NO_MAP = new MoveStatus("NO_MAP");

        private final String name;

        private MoveStatus(String name) {
            this.name = name;
        }

        public static MoveStatus valueOf(String name) {
            return switch (name == null ? "" : name) {
                case "SUCCESS" -> SUCCESS;
                case "INVALID_ACTION" -> INVALID_ACTION;
                case "TARGET_UNAVAILABLE" -> TARGET_UNAVAILABLE;
                case "EXTERNAL_TARGET" -> EXTERNAL_TARGET;
                default -> NO_MAP;
            };
        }

        public String name() {
            return name;
        }

        public boolean isSuccess() {
            return this == SUCCESS;
        }

        public boolean isExternalTarget() {
            return this == EXTERNAL_TARGET;
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public static final class OverworldTarget {
        private final long mapId;
        private final long tileId;

        public OverworldTarget(long mapId, long tileId) {
            this.mapId = Math.max(1L, mapId);
            this.tileId = Math.max(0L, tileId);
        }

        public long mapId() {
            return mapId;
        }

        public long tileId() {
            return tileId;
        }
    }
}
