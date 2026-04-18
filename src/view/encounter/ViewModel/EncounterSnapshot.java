package src.view.encounter.ViewModel;

import org.jspecify.annotations.Nullable;

import java.util.List;

public record EncounterSnapshot(
        List<String> difficultyOptions,
        String selectedDifficulty,
        FilterOptionsViewData filterOptions,
        FilterSelectionViewData filterSelection,
        List<AlternativeViewData> alternatives,
        @Nullable AlternativeViewData selectedAlternative,
        TextViewData text,
        boolean canLockSelected,
        boolean canExcludeSelected
) {

    public EncounterSnapshot {
        difficultyOptions = difficultyOptions == null
                ? defaultDifficultyOptions()
                : List.copyOf(difficultyOptions);
        selectedDifficulty = selectedDifficulty == null ? "MEDIUM" : selectedDifficulty;
        filterOptions = filterOptions == null ? FilterOptionsViewData.empty() : filterOptions;
        filterSelection = filterSelection == null ? FilterSelectionViewData.empty() : filterSelection;
        alternatives = alternatives == null ? List.of() : List.copyOf(alternatives);
        text = text == null ? TextViewData.empty() : text;
    }

    public static EncounterSnapshot empty() {
        return new EncounterSnapshot(
                defaultDifficultyOptions(),
                "MEDIUM",
                FilterOptionsViewData.empty(),
                FilterSelectionViewData.empty(),
                List.of(),
                null,
                TextViewData.empty(),
                false,
                false);
    }

    private static List<String> defaultDifficultyOptions() {
        return List.of("EASY", "MEDIUM", "HARD", "DEADLY");
    }

    public record FilterOptionsViewData(
            List<String> types,
            List<String> subtypes,
            List<String> biomes
    ) {

        public FilterOptionsViewData {
            types = immutableCopy(types);
            subtypes = immutableCopy(subtypes);
            biomes = immutableCopy(biomes);
        }

        public static FilterOptionsViewData empty() {
            return new FilterOptionsViewData(List.of(), List.of(), List.of());
        }

        private static <T> List<T> immutableCopy(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }
    }

    public record FilterSelectionViewData(
            List<String> selectedTypes,
            List<String> selectedSubtypes,
            List<String> selectedBiomes
    ) {

        public FilterSelectionViewData {
            selectedTypes = immutableCopy(selectedTypes);
            selectedSubtypes = immutableCopy(selectedSubtypes);
            selectedBiomes = immutableCopy(selectedBiomes);
        }

        public static FilterSelectionViewData empty() {
            return new FilterSelectionViewData(List.of(), List.of(), List.of());
        }

        private static <T> List<T> immutableCopy(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }
    }

    public record TextViewData(
            String partySummary,
            String thresholdsSummary,
            String dailyBudgetSummary,
            String lockSummary,
            String excludeSummary,
            String statusText,
            String resultSummary,
            String detailText
    ) {

        public TextViewData {
            partySummary = safeText(partySummary);
            thresholdsSummary = safeText(thresholdsSummary);
            dailyBudgetSummary = safeText(dailyBudgetSummary);
            lockSummary = safeText(lockSummary);
            excludeSummary = safeText(excludeSummary);
            statusText = safeText(statusText);
            resultSummary = safeText(resultSummary);
            detailText = safeText(detailText);
        }

        public static TextViewData empty() {
            return new TextViewData(
                    "No active party.",
                    "",
                    "",
                    "Locked: none",
                    "Excluded: none",
                    "",
                    "No encounters generated yet.",
                    "Generate an encounter to inspect the composition.");
        }

        private static String safeText(@Nullable String text) {
            return text == null ? "" : text;
        }
    }

    public record AlternativeViewData(
            String title,
            String difficultyLabel,
            int creatureCount,
            int adjustedXp,
            String creatureSummary,
            String highlightSummary,
            List<CreatureViewData> creatures,
            List<String> highlights
    ) {

        public AlternativeViewData {
            title = safeText(title);
            difficultyLabel = safeText(difficultyLabel);
            creatureSummary = safeText(creatureSummary);
            highlightSummary = safeText(highlightSummary);
            creatures = creatures == null ? List.of() : List.copyOf(creatures);
            highlights = highlights == null ? List.of() : List.copyOf(highlights);
        }
    }

    public record CreatureViewData(
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int quantity,
            String role,
            List<String> tags
    ) {

        public CreatureViewData {
            name = safeText(name);
            challengeRating = safeText(challengeRating);
            quantity = Math.max(1, quantity);
            role = safeText(role);
            tags = tags == null ? List.of() : List.copyOf(tags);
        }
    }

    private static String safeText(@Nullable String text) {
        return text == null ? "" : text;
    }
}
