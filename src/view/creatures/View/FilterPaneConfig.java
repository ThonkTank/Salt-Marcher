package src.view.creatures.View;

public record FilterPaneConfig(
        boolean showSearch,
        boolean showChallengeRating,
        boolean showSize,
        boolean showType,
        boolean showSubtype,
        boolean showBiome,
        boolean showAlignment
) {

    public static FilterPaneConfig catalogDefaults() {
        return new FilterPaneConfig(true, true, true, true, true, true, true);
    }

    public static FilterPaneConfig encounterDefaults() {
        return new FilterPaneConfig(false, false, false, true, true, true, false);
    }
}
