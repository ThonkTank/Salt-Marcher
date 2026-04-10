package clean.placeholder.input;

@SuppressWarnings("unused")
public record ComposePlaceholderInput(
        String surfaceId,
        String title,
        String navigationLabel,
        String summary,
        java.util.List<String> controlsItems,
        java.util.List<String> detailItems,
        java.util.List<String> stateItems
) {
}
