package src.domain.dungeon.model.travel.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;

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

    public enum ContextKind {
        DUNGEON,
        OVERWORLD
    }

    public enum LocationKind {
        TILE,
        TRANSITION
    }

    public enum GridTopology {
        SQUARE,
        HEX;

        public static GridTopology fromName(@Nullable String topologyName) {
            return "HEX".equalsIgnoreCase(topologyName) ? HEX : SQUARE;
        }

        public boolean isHex() {
            return this == HEX;
        }
    }

    public enum AreaKind {
        ROOM,
        CORRIDOR
    }

    public enum FeatureKind {
        STAIR,
        TRANSITION
    }
}
