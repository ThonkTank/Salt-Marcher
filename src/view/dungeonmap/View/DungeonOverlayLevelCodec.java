package src.view.dungeonmap.View;
import java.util.List;
import java.util.Optional;
final class DungeonOverlayLevelCodec {
    private DungeonOverlayLevelCodec() {
    }
    static String format(List<Integer> levels) {
        return (levels == null ? List.<Integer>of() : levels).stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("-");
    }
    static Optional<List<Integer>> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.of(List.of());
        }
        try {
            return Optional.of(List.of(raw.split("[,\\s]+")).stream()
                    .map(String::trim)
                    .filter(token -> !token.isBlank())
                    .map(Integer::parseInt)
                    .distinct()
                    .sorted()
                    .toList());
        } catch (NumberFormatException ignored) {
            return Optional.empty();
        }
    }
}
