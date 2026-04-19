package src.view.dungeonshared.View;
import org.jspecify.annotations.Nullable;
import java.util.List;
final class DungeonOverlayLevelCodec {
    private DungeonOverlayLevelCodec() {
    }
    static String format(List<Integer> levels) {
        return (levels == null ? List.<Integer>of() : levels).stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + ", " + right)
                .orElse("-");
    }
    static @Nullable List<Integer> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return List.of(raw.split("[,\\s]+")).stream()
                    .map(String::trim)
                    .filter(token -> !token.isBlank())
                    .map(Integer::parseInt)
                    .distinct()
                    .sorted()
                    .toList();
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
