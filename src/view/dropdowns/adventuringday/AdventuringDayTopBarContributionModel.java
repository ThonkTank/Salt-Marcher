package src.view.dropdowns.adventuringday;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.party.published.AdventuringDayCalculation;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayProgressEventType;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.ReadStatus;

@SuppressWarnings("PMD.TooManyMethods")
final class AdventuringDayTopBarContributionModel {

    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Rastbudget \u25be");
    private final ReadOnlyObjectWrapper<PanelModel> panel = new ReadOnlyObjectWrapper<>();

    private List<Integer> activePartyLevels = List.of();
    private List<RowModel> rows = List.of();
    private boolean progressModeSelected;
    private String totalGroupXpText = "";
    private PartySourceMode sourceMode = PartySourceMode.ACTIVE_PARTY;
    private boolean activePartyChangedSinceCustomEdit;
    private boolean activePartyRefreshFailed;
    private CalculationModel calculation = CalculationModel.empty(0);

    AdventuringDayTopBarContributionModel() {
        rebuildPanel();
    }

    ReadOnlyStringProperty triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    CalculationRequest applyViewInput(AdventuringDayTopBarViewInputEvent event) {
        if (event == null || event.popupOpening()) {
            return null;
        }
        progressModeSelected = event.progressModeSelected();
        totalGroupXpText = safe(event.totalGroupXpText());
        List<RowModel> eventRows = normalizeRows(event.rows());
        if (event.useActivePartyRequested()) {
            sourceMode = PartySourceMode.ACTIVE_PARTY;
            activePartyChangedSinceCustomEdit = false;
            activePartyRefreshFailed = false;
            rows = rowsFromLevels(activePartyLevels);
        } else if (event.addRowRequested()) {
            sourceMode = PartySourceMode.CUSTOM;
            rows = appendDefaultRow(eventRows);
        } else if (event.clearRequested()) {
            sourceMode = PartySourceMode.CUSTOM;
            rows = List.of();
        } else {
            if (sourceMode == PartySourceMode.ACTIVE_PARTY && !eventRows.equals(rowsFromLevels(activePartyLevels))) {
                sourceMode = PartySourceMode.CUSTOM;
            }
            rows = eventRows;
        }
        int totalGroupXp = parseNonNegativeInt(totalGroupXpText);
        calculation = CalculationModel.empty(totalGroupXp);
        rebuildPanel();
        List<Integer> levels = expandedLevels(rows);
        if (levels.isEmpty()) {
            return null;
        }
        return new CalculationRequest(levels, totalGroupXp);
    }

    void applySummaryResult(@Nullable AdventuringDayResult result) {
        if (result == null || result.status() != ReadStatus.SUCCESS) {
            triggerText.set("Rastbudget nicht verf\u00fcgbar \u25be");
            activePartyRefreshFailed = true;
            rebuildPanel();
            return;
        }
        applySummary(result.summary());
    }

    void applyCalculationResult(int totalGroupXp, @Nullable AdventuringDayCalculationResult result) {
        if (result == null || result.status() != ReadStatus.SUCCESS || result.calculation() == null) {
            calculation = CalculationModel.empty(totalGroupXp);
            rebuildPanel();
            return;
        }
        calculation = mapCalculation(result.calculation());
        rebuildPanel();
    }

    private void applySummary(@Nullable AdventuringDaySummary summary) {
        if (summary == null || summary.activePartyLevels().isEmpty()) {
            activePartyLevels = List.of();
            if (sourceMode == PartySourceMode.ACTIVE_PARTY) {
                rows = List.of();
                activePartyChangedSinceCustomEdit = false;
                activePartyRefreshFailed = false;
            }
            triggerText.set("Kein Rastbudget \u25be");
            rebuildPanel();
            return;
        }
        List<Integer> nextActivePartyLevels = sanitizeLevels(summary.activePartyLevels());
        boolean changed = !nextActivePartyLevels.equals(activePartyLevels);
        activePartyLevels = nextActivePartyLevels;
        activePartyRefreshFailed = false;
        if (sourceMode == PartySourceMode.ACTIVE_PARTY) {
            rows = rowsFromLevels(activePartyLevels);
            activePartyChangedSinceCustomEdit = false;
        } else if (changed) {
            activePartyChangedSinceCustomEdit = true;
        }
        triggerText.set("SR " + format(summary.remainingToShortRest())
                + " \u00b7 LR " + format(summary.remainingToLongRest()) + " \u25be");
        rebuildPanel();
    }

    private void rebuildPanel() {
        panel.set(new PanelModel(
                rows,
                progressModeSelected,
                totalGroupXpText,
                partySummaryText(),
                activePartyLevels.isEmpty(),
                rows.isEmpty(),
                selectedPresentation()));
    }

    private String partySummaryText() {
        String sourceLabel = sourceMode == PartySourceMode.CUSTOM ? "Eigene Gruppe" : "Aktive Party";
        if (sourceMode == PartySourceMode.ACTIVE_PARTY && activePartyRefreshFailed) {
            sourceLabel += activePartyLevels.isEmpty() ? " · Laden fehlgeschlagen" : " · Letzter Stand";
        } else if (sourceMode == PartySourceMode.CUSTOM && activePartyChangedSinceCustomEdit) {
            sourceLabel += " · Aktive Party geändert";
        }
        int characterCount = expandedLevels(rows).size();
        return characterCount == 0 ? sourceLabel : sourceLabel + ": " + characterCount + " Charaktere";
    }

    private CalculationPresentation selectedPresentation() {
        if (expandedLevels(rows).isEmpty()) {
            return CalculationPresentation.empty(progressModeSelected, parseNonNegativeInt(totalGroupXpText));
        }
        return progressModeSelected ? calculation.progressPresentation() : calculation.budgetPresentation();
    }

    private static List<RowModel> appendDefaultRow(List<RowModel> existingRows) {
        List<RowModel> nextRows = new ArrayList<>(existingRows == null ? List.of() : existingRows);
        nextRows.add(new RowModel(1, "1"));
        return List.copyOf(nextRows);
    }

    private static List<RowModel> rowsFromLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return List.of();
        }
        Map<Integer, Integer> countsByLevel = new TreeMap<>();
        for (Integer level : sanitizeLevels(levels)) {
            countsByLevel.merge(level, 1, Integer::sum);
        }
        List<RowModel> nextRows = new ArrayList<>();
        for (Map.Entry<Integer, Integer> entry : countsByLevel.entrySet()) {
            nextRows.add(new RowModel(entry.getKey(), Integer.toString(entry.getValue())));
        }
        return List.copyOf(nextRows);
    }

    private static List<RowModel> normalizeRows(List<AdventuringDayTopBarViewInputEvent.RowInput> rowInputs) {
        if (rowInputs == null || rowInputs.isEmpty()) {
            return List.of();
        }
        List<RowModel> nextRows = new ArrayList<>();
        for (AdventuringDayTopBarViewInputEvent.RowInput rowInput : rowInputs) {
            if (rowInput != null) {
                int level = rowInput.level() == null ? 1 : Math.max(1, Math.min(20, rowInput.level()));
                nextRows.add(new RowModel(level, rowInput.countText()));
            }
        }
        return List.copyOf(nextRows);
    }

    private static List<Integer> expandedLevels(List<RowModel> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        List<Integer> levels = new ArrayList<>();
        for (RowModel row : rows) {
            int count = parseNonNegativeInt(row == null ? "" : row.countText());
            int level = row == null ? 1 : row.level();
            for (int index = 0; index < count; index++) {
                levels.add(level);
            }
        }
        return List.copyOf(levels);
    }

    private static CalculationModel mapCalculation(AdventuringDayCalculation calculation) {
        return new CalculationModel(
                new BudgetModel(
                        calculation.budget().totalBudgetXp(),
                        calculation.budget().perThirdXp(),
                        calculation.budget().firstShortRestXp(),
                        calculation.budget().secondShortRestXp(),
                        calculation.budget().characterCount()),
                new ProgressModel(
                        calculation.progress().totalGroupXp(),
                        calculation.progress().perCharacterAwardedXp(),
                        calculation.progress().partySize(),
                        calculation.progress().fullDays(),
                        calculation.progress().totalDays(),
                        calculation.progress().shortRests(),
                        calculation.progress().longRests(),
                        calculation.progress().levelProgressions().stream()
                                .map(progress -> new LevelProgressModel(
                                        progress.startLevel(),
                                        progress.endLevel(),
                                        progress.characterCount(),
                                        progress.levelUps()))
                                .toList(),
                        calculation.progress().events().stream()
                                .map(event -> new ProgressEventModel(
                                        event.groupXp(),
                                        mapEventType(event.type()),
                                        event.dayNumber(),
                                        event.newLevel(),
                                        event.affectedCharacters(),
                                        event.partialDay()))
                                .toList()));
    }

    private static ProgressEventTypeModel mapEventType(AdventuringDayProgressEventType type) {
        if (type == null) {
            return ProgressEventTypeModel.LONG_REST;
        }
        return switch (type) {
            case LEVEL_UP -> ProgressEventTypeModel.LEVEL_UP;
            case SHORT_REST -> ProgressEventTypeModel.SHORT_REST;
            case LONG_REST -> ProgressEventTypeModel.LONG_REST;
        };
    }

    private static List<Integer> sanitizeLevels(List<Integer> levels) {
        if (levels == null || levels.isEmpty()) {
            return List.of();
        }
        List<Integer> normalized = new ArrayList<>();
        for (Integer level : levels) {
            if (level != null) {
                normalized.add(Math.max(1, Math.min(20, level)));
            }
        }
        return List.copyOf(normalized);
    }

    private static int parseNonNegativeInt(String rawValue) {
        String safeValue = safe(rawValue).trim();
        if (safeValue.isEmpty()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(safeValue));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }

    private static String format(int value) {
        NumberFormat integerFormat = NumberFormat.getIntegerInstance(Locale.GERMANY);
        return integerFormat.format(Math.max(0, value));
    }

    record CalculationRequest(List<Integer> levels, int totalGroupXp) {

        CalculationRequest {
            levels = levels == null ? List.of() : List.copyOf(levels);
            totalGroupXp = Math.max(0, totalGroupXp);
        }
    }

    record PanelModel(
            List<RowModel> rows,
            boolean progressModeSelected,
            String totalGroupXpText,
            String partySummaryText,
            boolean useActivePartyButtonDisabled,
            boolean clearButtonDisabled,
            CalculationPresentation calculation
    ) {

        PanelModel {
            rows = rows == null ? List.of() : List.copyOf(rows);
            totalGroupXpText = safe(totalGroupXpText);
            partySummaryText = safe(partySummaryText);
            calculation = calculation == null ? CalculationPresentation.empty(false, 0) : calculation;
        }
    }

    record RowModel(int level, String countText) {

        RowModel {
            level = Math.max(1, Math.min(20, level));
            countText = safe(countText);
        }
    }

    record CalculationPresentation(List<String> summaryLines, List<String> timelineLines) {

        CalculationPresentation {
            summaryLines = summaryLines == null ? List.of() : List.copyOf(summaryLines);
            timelineLines = timelineLines == null ? List.of() : List.copyOf(timelineLines);
        }

        static CalculationPresentation empty(boolean progressModeSelected, int totalGroupXp) {
            if (progressModeSelected) {
                return new CalculationPresentation(
                        List.of("Gesamt-XP: " + format(totalGroupXp) + " XP"),
                        List.of());
            }
            return new CalculationPresentation(List.of("Tag gesamt: 0 XP"), List.of());
        }
    }

    record CalculationModel(BudgetModel budget, ProgressModel progress) {

        static CalculationModel empty(int totalGroupXp) {
            return new CalculationModel(
                    new BudgetModel(0, 0, 0, 0, 0),
                    new ProgressModel(totalGroupXp, 0, 0, 0, 0.0, 0, 0, List.of(), List.of()));
        }

        private CalculationPresentation budgetPresentation() {
            BudgetModel safeBudget = budget == null ? new BudgetModel(0, 0, 0, 0, 0) : budget;
            return new CalculationPresentation(
                    List.of(
                            "Tag gesamt: " + format(safeBudget.totalXp()) + " XP",
                            "Pro Drittel: ca. " + format(safeBudget.perThirdXp()) + " XP",
                            "Short Rest 1: nach " + format(safeBudget.firstShortRestXp()) + " XP",
                            "Short Rest 2: nach " + format(safeBudget.secondShortRestXp()) + " XP"),
                    List.of(
                            "Short Rest 1: " + format(safeBudget.firstShortRestXp()) + " XP",
                            "Short Rest 2: " + format(safeBudget.secondShortRestXp()) + " XP",
                            "Long Rest: " + format(safeBudget.totalXp()) + " XP"));
        }

        private CalculationPresentation progressPresentation() {
            ProgressModel safeProgress = progress == null
                    ? new ProgressModel(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())
                    : progress;
            return new CalculationPresentation(
                    List.of(
                            "Gesamt-XP: " + format(safeProgress.totalGroupXp()) + " XP",
                            "XP pro Charakter: " + format(safeProgress.perCharacterAwardedXp()),
                            "Adventuring Days: " + formatDays(safeProgress.totalDays()) + " (" + safeProgress.fullDays() + " voll)",
                            "Short Rests: " + safeProgress.shortRests(),
                            "Long Rests: " + safeProgress.longRests(),
                            "Level-ups: " + formatLevelProgress(safeProgress.levelProgressions())),
                    safeProgress.events().stream()
                            .map(CalculationModel::formatProgressEvent)
                            .toList());
        }

        private static String formatProgressEvent(ProgressEventModel model) {
            ProgressEventModel safeModel = model == null
                    ? new ProgressEventModel(0, ProgressEventTypeModel.LONG_REST, 0, 0, 0, false)
                    : model;
            String prefix = "Tag " + safeModel.dayNumber() + ", " + format(safeModel.groupXp()) + " XP: ";
            String suffix = safeModel.partialDay() ? " (teilweiser Tag)" : "";
            return switch (safeModel.type()) {
                case LEVEL_UP -> prefix + "Level-up auf " + safeModel.newLevel()
                        + " für " + safeModel.affectedCharacters() + " Charakter"
                        + (safeModel.affectedCharacters() == 1 ? "" : "e") + suffix;
                case SHORT_REST -> prefix + "Short Rest" + suffix;
                case LONG_REST -> prefix + "Long Rest" + suffix;
            };
        }

        private static String formatLevelProgress(List<LevelProgressModel> progressions) {
            if (progressions == null || progressions.isEmpty()) {
                return "keine";
            }
            return progressions.stream()
                    .map(CalculationModel::formatLevelProgressEntry)
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("keine");
        }

        private static String formatLevelProgressEntry(LevelProgressModel progression) {
            LevelProgressModel safeProgression = progression == null
                    ? new LevelProgressModel(1, 1, 0, 0)
                    : progression;
            String suffix = safeProgression.levelUps() > 0
                    ? " -> L" + safeProgression.endLevel()
                    : " bleibt";
            return safeProgression.characterCount() + "x L" + safeProgression.startLevel() + suffix;
        }

        private static String formatDays(double value) {
            NumberFormat numberFormat = NumberFormat.getNumberInstance(Locale.GERMANY);
            numberFormat.setMinimumFractionDigits(0);
            numberFormat.setMaximumFractionDigits(2);
            return numberFormat.format(value);
        }
    }

    record BudgetModel(
            int totalXp,
            int perThirdXp,
            int firstShortRestXp,
            int secondShortRestXp,
            int characterCount
    ) {
    }

    record ProgressModel(
            int totalGroupXp,
            int perCharacterAwardedXp,
            int partySize,
            int fullDays,
            double totalDays,
            int shortRests,
            int longRests,
            List<LevelProgressModel> levelProgressions,
            List<ProgressEventModel> events
    ) {

        ProgressModel {
            levelProgressions = levelProgressions == null ? List.of() : List.copyOf(levelProgressions);
            events = events == null ? List.of() : List.copyOf(events);
        }
    }

    record LevelProgressModel(
            int startLevel,
            int endLevel,
            int characterCount,
            int levelUps
    ) {
    }

    record ProgressEventModel(
            int groupXp,
            ProgressEventTypeModel type,
            int dayNumber,
            int newLevel,
            int affectedCharacters,
            boolean partialDay
    ) {
    }

    enum ProgressEventTypeModel {
        LEVEL_UP,
        SHORT_REST,
        LONG_REST
    }

    private enum PartySourceMode {
        ACTIVE_PARTY,
        CUSTOM
    }
}
