package src.view.dropdowns.adventuringday;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
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

final class AdventuringDayTopBarContributionModel {

    private static final NumberFormat INTEGER_FORMAT = NumberFormat.getIntegerInstance(Locale.GERMANY);

    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Rastbudget \u25be");
    private final ReadOnlyObjectWrapper<PanelModel> panel =
            new ReadOnlyObjectWrapper<>(PanelModel.loadingModel());
    private final ReadOnlyObjectWrapper<CalculationModel> calculation =
            new ReadOnlyObjectWrapper<>(CalculationModel.empty(0));

    ReadOnlyStringProperty triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<CalculationModel> calculationProperty() {
        return calculation.getReadOnlyProperty();
    }

    void beginRefresh() {
        panel.set(PanelModel.loadingModel());
    }

    void applySummaryResult(@Nullable AdventuringDayResult result) {
        if (result == null || result.status() != ReadStatus.SUCCESS) {
            triggerText.set("Rastbudget nicht verf\u00fcgbar \u25be");
            panel.set(PanelModel.errorModel());
            return;
        }
        applySummary(result.summary());
    }

    void beginCalculation(int totalGroupXp) {
        calculation.set(CalculationModel.empty(totalGroupXp));
    }

    void applyCalculationResult(int totalGroupXp, @Nullable AdventuringDayCalculationResult result) {
        if (result == null || result.status() != ReadStatus.SUCCESS || result.calculation() == null) {
            calculation.set(CalculationModel.empty(totalGroupXp));
            return;
        }
        calculation.set(mapCalculation(result.calculation()));
    }

    private void applySummary(@Nullable AdventuringDaySummary summary) {
        if (summary == null || summary.activePartyLevels().isEmpty()) {
            triggerText.set("Kein Rastbudget \u25be");
            panel.set(PanelModel.emptyModel());
            return;
        }
        triggerText.set("SR " + format(summary.remainingToShortRest())
                + " \u00b7 LR " + format(summary.remainingToLongRest()) + " \u25be");
        panel.set(PanelModel.loaded(summary.activePartyLevels()));
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

    private static String format(int value) {
        return INTEGER_FORMAT.format(Math.max(0, value));
    }

    record PanelModel(
            boolean loading,
            boolean error,
            boolean empty,
            List<Integer> activePartyLevels
    ) {

        PanelModel {
            activePartyLevels = activePartyLevels == null ? List.of() : List.copyOf(activePartyLevels);
        }

        static PanelModel loadingModel() {
            return new PanelModel(true, false, false, List.of());
        }

        static PanelModel emptyModel() {
            return new PanelModel(false, false, true, List.of());
        }

        static PanelModel errorModel() {
            return new PanelModel(false, true, false, List.of());
        }

        static PanelModel loaded(List<Integer> activePartyLevels) {
            return new PanelModel(false, false, false, activePartyLevels);
        }
    }

    record CalculationModel(BudgetModel budget, ProgressModel progress) {

        static CalculationModel empty(int totalGroupXp) {
            return new CalculationModel(
                    new BudgetModel(0, 0, 0, 0, 0),
                    new ProgressModel(totalGroupXp, 0, 0, 0, 0.0, 0, 0, List.of(), List.of()));
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

}
