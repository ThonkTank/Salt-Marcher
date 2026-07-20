package features.dungeon.application.editor;

import java.util.OptionalInt;

public record StairGeometryDraftInput(
        long stairId,
        String shapeName,
        String directionName,
        String dimension1,
        String dimension2
) {
    public StairGeometryDraftInput {
        stairId = Math.max(0L, stairId);
        shapeName = safeText(shapeName);
        directionName = safeText(directionName);
        dimension1 = safeText(dimension1);
        dimension2 = safeText(dimension2);
    }

    public static StairGeometryDraftInput empty() {
        return new StairGeometryDraftInput(0L, "", "", "", "");
    }

    OptionalInt dimension1Value() {
        return integerValue(dimension1);
    }

    OptionalInt dimension2Value() {
        return integerValue(dimension2);
    }

    public boolean completeForSave() {
        return stairId > 0L && dimension1Value().isPresent() && dimension2Value().isPresent();
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }

    private static OptionalInt integerValue(String value) {
        if (value == null || value.isBlank()) {
            return OptionalInt.empty();
        }
        try {
            return OptionalInt.of(Integer.parseInt(value.strip()));
        } catch (NumberFormatException ignored) {
            return OptionalInt.empty();
        }
    }
}
