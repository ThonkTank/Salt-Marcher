package src.domain.dungeon.model.runtime.travel.session;

import java.util.Locale;
import java.util.List;
import java.util.Objects;

public final class TravelDungeonSessionValues {
    private static final String TRANSITION_TOKEN = "TRANSITION";
    private static final String STAIR_EXIT_TOKEN = "STAIR_EXIT";

    private TravelDungeonSessionValues() {
    }

    public static TravelOverlayState defaultOverlayState() {
        return TravelOverlayState.defaults();
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

    public static final class LocationKind {
        public static final LocationKind TILE = new LocationKind("TILE");
        public static final LocationKind STAIR_EXIT = new LocationKind(STAIR_EXIT_TOKEN);
        public static final LocationKind TRANSITION = new LocationKind(TRANSITION_TOKEN);

        private final String name;

        private LocationKind(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public static LocationKind defaultKind() {
            return TILE;
        }

        public static LocationKind valueOf(String name) {
            if (name == null || name.isBlank()) {
                return TILE;
            }
            return switch (name.trim().toUpperCase(Locale.ROOT)) {
                case TRANSITION_TOKEN -> TRANSITION;
                case STAIR_EXIT_TOKEN -> STAIR_EXIT;
                default -> TILE;
            };
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof LocationKind locationKind && name.equals(locationKind.name);
        }

        @Override
        public int hashCode() {
            return Objects.hash(name);
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public static final class ContextKind {
        public static final ContextKind DUNGEON = new ContextKind("DUNGEON");
        public static final ContextKind OVERWORLD = new ContextKind("OVERWORLD");

        private final String name;

        private ContextKind(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public boolean isOverworld() {
            return this == OVERWORLD;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof ContextKind contextKind && name.equals(contextKind.name);
        }

        @Override
        public int hashCode() {
            return Objects.hash(name);
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public static final class TopologyKind {
        public static final TopologyKind SQUARE = new TopologyKind("SQUARE");
        public static final TopologyKind HEX = new TopologyKind("HEX");

        private final String name;

        private TopologyKind(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public static TopologyKind defaultKind() {
            return SQUARE;
        }

        public static TopologyKind fromName(String name) {
            return "HEX".equals(name == null ? "" : name.trim().toUpperCase(Locale.ROOT)) ? HEX : SQUARE;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof TopologyKind topologyKind && name.equals(topologyKind.name);
        }

        @Override
        public int hashCode() {
            return Objects.hash(name);
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public static final class AreaKind {
        public static final AreaKind ROOM = new AreaKind("ROOM");
        public static final AreaKind CORRIDOR = new AreaKind("CORRIDOR");

        private final String name;

        private AreaKind(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public static AreaKind defaultKind() {
            return ROOM;
        }

        public static AreaKind fromName(String name) {
            return "CORRIDOR".equals(name == null ? "" : name.trim().toUpperCase(Locale.ROOT)) ? CORRIDOR : ROOM;
        }

        public String defaultLabel() {
            return name;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof AreaKind areaKind && name.equals(areaKind.name);
        }

        @Override
        public int hashCode() {
            return Objects.hash(name);
        }

        @Override
        public String toString() {
            return name;
        }
    }

    public static final class FeatureKind {
        public static final FeatureKind STAIR = new FeatureKind("STAIR");
        public static final FeatureKind TRANSITION = new FeatureKind(TRANSITION_TOKEN);

        private final String name;

        private FeatureKind(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public static FeatureKind defaultKind() {
            return STAIR;
        }

        public static FeatureKind fromName(String name) {
            return TRANSITION_TOKEN.equals(name == null ? "" : name.trim().toUpperCase(Locale.ROOT))
                    ? TRANSITION
                    : STAIR;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof FeatureKind featureKind && name.equals(featureKind.name);
        }

        @Override
        public int hashCode() {
            return Objects.hash(name);
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

        public boolean isSuccess() {
            return this == SUCCESS;
        }

        public boolean isExternalTarget() {
            return this == EXTERNAL_TARGET;
        }

    }

    public static final class ActionKind {
        public static final ActionKind TRAVERSAL = new ActionKind("TRAVERSAL");
        public static final ActionKind TRANSITION = new ActionKind(TRANSITION_TOKEN);

        private final String name;

        private ActionKind(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public static ActionKind defaultKind() {
            return TRAVERSAL;
        }

        public static ActionKind fromName(String name) {
            return TRANSITION_TOKEN.equals(name == null ? "" : name.trim().toUpperCase(Locale.ROOT))
                    ? TRANSITION
                    : TRAVERSAL;
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof ActionKind actionKind && name.equals(actionKind.name);
        }

        @Override
        public int hashCode() {
            return Objects.hash(name);
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
