package src.view.dropdowns.adventuringday;

import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.beans.value.ObservableValue;
import src.domain.party.published.AdventuringDayCalculation;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.ReadStatus;

final class AdventuringDayTopBarContributionModel {

    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Rastbudget \u25be");
    private final AdventuringDayTopBarContentModel contentModel = new AdventuringDayTopBarContentModel();

    private List<Integer> activePartyLevels = List.of();
    private PartySourceMode sourceMode = PartySourceMode.ACTIVE_PARTY;
    private boolean activePartyChangedSinceCustomEdit;
    private boolean activePartyRefreshFailed;
    private int pendingCalculationTotalGroupXp;

    ObservableValue<String> triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    AdventuringDayTopBarContentModel contentModel() {
        return contentModel;
    }

    InputSource inputSource() {
        return new InputSource(
                sourceMode == PartySourceMode.ACTIVE_PARTY,
                PartyLevelRows.rowsFromLevels(activePartyLevels));
    }

    void showInputProjection(
            List<AdventuringDayTopBarContentModel.RowModel> nextRows,
            boolean progressModeSelected,
            String totalGroupXpText,
            int totalGroupXp,
            boolean activePartySource,
            boolean resetActivePartyStatus
    ) {
        sourceMode = activePartySource ? PartySourceMode.ACTIVE_PARTY : PartySourceMode.CUSTOM;
        if (resetActivePartyStatus) {
            activePartyChangedSinceCustomEdit = false;
            activePartyRefreshFailed = false;
        }
        List<AdventuringDayTopBarContentModel.RowModel> safeRows =
                nextRows == null ? List.of() : List.copyOf(nextRows);
        contentModel.showProjection(
                safeRows,
                progressModeSelected,
                totalGroupXpText == null ? "" : totalGroupXpText,
                partySummaryText(safeRows),
                activePartyLevels.isEmpty(),
                safeRows.isEmpty(),
                AdventuringDayTopBarContentModel.CalculationModel.empty(totalGroupXp));
    }

    void expectCalculationResult(int totalGroupXp) {
        pendingCalculationTotalGroupXp = totalGroupXp;
    }

    void applySummaryResult(List<Integer> summaryLevels, int remainingToShortRest, int remainingToLongRest, boolean successful) {
        if (!successful) {
            triggerText.set("Rastbudget nicht verf\u00fcgbar \u25be");
            activePartyRefreshFailed = true;
            rebuildPanel(contentModel.rows());
            return;
        }
        applySummary(summaryLevels, remainingToShortRest, remainingToLongRest);
    }

    void applyCalculationResult(AdventuringDayCalculationResult result) {
        int totalGroupXp = pendingCalculationTotalGroupXp;
        pendingCalculationTotalGroupXp = 0;
        if (result == null || result.status() != ReadStatus.SUCCESS || result.calculation() == null) {
            contentModel.showCalculation(AdventuringDayTopBarContentModel.CalculationModel.empty(totalGroupXp));
            return;
        }
        contentModel.showCalculation(CalculationReadbackMapper.mapCalculation(result.calculation()));
    }

    private void applySummary(List<Integer> summaryLevels, int remainingToShortRest, int remainingToLongRest) {
        List<AdventuringDayTopBarContentModel.RowModel> nextRows = contentModel.rows();
        if (summaryLevels == null || summaryLevels.isEmpty()) {
            activePartyLevels = List.of();
            if (sourceMode == PartySourceMode.ACTIVE_PARTY) {
                nextRows = List.of();
                activePartyChangedSinceCustomEdit = false;
                activePartyRefreshFailed = false;
            }
            triggerText.set("Kein Rastbudget \u25be");
            rebuildPanel(nextRows);
            return;
        }
        List<Integer> nextActivePartyLevels = PartyLevelRows.sanitizeLevels(summaryLevels);
        boolean changed = !nextActivePartyLevels.equals(activePartyLevels);
        activePartyLevels = nextActivePartyLevels;
        activePartyRefreshFailed = false;
        if (sourceMode == PartySourceMode.ACTIVE_PARTY) {
            nextRows = PartyLevelRows.rowsFromLevels(activePartyLevels);
            activePartyChangedSinceCustomEdit = false;
        } else if (changed) {
            activePartyChangedSinceCustomEdit = true;
        }
        triggerText.set("SR " + Math.max(0, remainingToShortRest)
                + " \u00b7 LR " + Math.max(0, remainingToLongRest) + " \u25be");
        rebuildPanel(nextRows);
    }

    private void rebuildPanel(List<AdventuringDayTopBarContentModel.RowModel> nextRows) {
        List<AdventuringDayTopBarContentModel.RowModel> safeRows = nextRows == null ? List.of() : nextRows;
        contentModel.showProjection(
                safeRows,
                contentModel.progressModeSelected(),
                contentModel.totalGroupXpText(),
                partySummaryText(safeRows),
                activePartyLevels.isEmpty(),
                safeRows.isEmpty(),
                contentModel.calculation());
    }

    private String partySummaryText(List<AdventuringDayTopBarContentModel.RowModel> currentRows) {
        String sourceLabel = sourceMode == PartySourceMode.CUSTOM ? "Eigene Gruppe" : "Aktive Party";
        if (sourceMode == PartySourceMode.ACTIVE_PARTY && activePartyRefreshFailed) {
            sourceLabel += activePartyLevels.isEmpty() ? " · Laden fehlgeschlagen" : " · Letzter Stand";
        } else if (sourceMode == PartySourceMode.CUSTOM && activePartyChangedSinceCustomEdit) {
            sourceLabel += " · Aktive Party geändert";
        }
        int characterCount = AdventuringDayTopBarContentModel.LevelRows.expandedLevels(currentRows).size();
        return characterCount == 0 ? sourceLabel : sourceLabel + ": " + characterCount + " Charaktere";
    }

    private enum PartySourceMode {
        ACTIVE_PARTY,
        CUSTOM
    }

    record InputSource(boolean activePartySource, List<AdventuringDayTopBarContentModel.RowModel> activePartyRows) {

        InputSource {
            activePartyRows = activePartyRows == null ? List.of() : List.copyOf(activePartyRows);
        }
    }

    private static final class CalculationReadbackMapper {

        private CalculationReadbackMapper() {
            throw new AssertionError();
        }

        private static AdventuringDayTopBarContentModel.CalculationModel mapCalculation(
                AdventuringDayCalculation calculation
        ) {
            return new AdventuringDayTopBarContentModel.CalculationModel(
                    new AdventuringDayTopBarContentModel.BudgetModel(
                            calculation.budget().totalBudgetXp(),
                            calculation.budget().perThirdXp(),
                            calculation.budget().firstShortRestXp(),
                            calculation.budget().secondShortRestXp(),
                            calculation.budget().characterCount()),
                    new AdventuringDayTopBarContentModel.ProgressModel(
                            calculation.progress().totalGroupXp(),
                            calculation.progress().perCharacterAwardedXp(),
                            calculation.progress().partySize(),
                            calculation.progress().fullDays(),
                            calculation.progress().totalDays(),
                            calculation.progress().shortRests(),
                            calculation.progress().longRests(),
                            levelProgressModels(calculation),
                            progressEventModels(calculation)));
        }

        private static List<AdventuringDayTopBarContentModel.LevelProgressModel> levelProgressModels(
                AdventuringDayCalculation calculation
        ) {
            List<AdventuringDayTopBarContentModel.LevelProgressModel> models = new ArrayList<>();
            for (var progress : calculation.progress().levelProgressions()) {
                models.add(new AdventuringDayTopBarContentModel.LevelProgressModel(
                        progress.startLevel(),
                        progress.endLevel(),
                        progress.characterCount(),
                        progress.levelUps()));
            }
            return List.copyOf(models);
        }

        private static List<AdventuringDayTopBarContentModel.ProgressEventModel> progressEventModels(
                AdventuringDayCalculation calculation
        ) {
            List<AdventuringDayTopBarContentModel.ProgressEventModel> models = new ArrayList<>();
            for (var event : calculation.progress().events()) {
                models.add(new AdventuringDayTopBarContentModel.ProgressEventModel(
                        event.groupXp(),
                        AdventuringDayTopBarContentModel.ProgressEventTypeModel.fromName(
                                event.type() == null ? "" : event.type().toString()),
                        event.dayNumber(),
                        event.newLevel(),
                        event.affectedCharacters(),
                        event.partialDay()));
            }
            return List.copyOf(models);
        }
    }

    private static final class PartyLevelRows {

        private PartyLevelRows() {
            throw new AssertionError();
        }

        private static List<AdventuringDayTopBarContentModel.RowModel> rowsFromLevels(List<Integer> levels) {
            if (levels == null || levels.isEmpty()) {
                return List.of();
            }
            int[] countsByLevel = new int[21];
            for (Integer level : sanitizeLevels(levels)) {
                countsByLevel[level]++;
            }
            List<AdventuringDayTopBarContentModel.RowModel> nextRows = new ArrayList<>();
            for (int level = 1; level < countsByLevel.length; level++) {
                int count = countsByLevel[level];
                if (count > 0) {
                    nextRows.add(new AdventuringDayTopBarContentModel.RowModel(level, Integer.toString(count)));
                }
            }
            return List.copyOf(nextRows);
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
    }
}
