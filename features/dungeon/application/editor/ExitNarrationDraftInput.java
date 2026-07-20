package features.dungeon.application.editor;

public record ExitNarrationDraftInput(
        String label,
        int q,
        int r,
        int level,
        String direction,
        String description
) {
    public ExitNarrationDraftInput {
        label = safeText(label);
        direction = safeText(direction);
        description = safeText(description);
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
