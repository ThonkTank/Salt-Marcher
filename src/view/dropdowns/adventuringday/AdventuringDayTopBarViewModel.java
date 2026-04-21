package src.view.dropdowns.adventuringday;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdventuringDayCalculation;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayProgressEventType;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.CalculateAdventuringDayQuery;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;
import src.domain.party.published.ReadStatus;

final class AdventuringDayTopBarViewModel {

    private static final NumberFormat INTEGER_FORMAT = NumberFormat.getIntegerInstance(Locale.GERMANY);

    private final PartyApplicationService party;
    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Rastbudget \u25be");
    private final ReadOnlyObjectWrapper<PanelModel> panel = new ReadOnlyObjectWrapper<>(PanelModel.loadingModel());

    AdventuringDayTopBarViewModel(PartyApplicationService party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    ReadOnlyStringProperty triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    void refresh() {
        panel.set(PanelModel.loadingModel());
        AdventuringDayResult result = party.loadAdventuringDaySummary(new LoadAdventuringDaySummaryQuery());
        if (result == null || result.status() != ReadStatus.SUCCESS) {
            triggerText.set("Rastbudget nicht verf\u00fcgbar \u25be");
            panel.set(PanelModel.errorModel());
            return;
        }
        applySummary(result.summary());
    }

    AdventuringDayCalculatorModel.Calculation calculate(List<Integer> levels, int totalGroupXp) {
        AdventuringDayCalculationResult result = party.calculateAdventuringDay(
                new CalculateAdventuringDayQuery(levels, totalGroupXp));
        if (result == null || result.status() != ReadStatus.SUCCESS || result.calculation() == null) {
            return AdventuringDayCalculatorModel.Calculation.empty(totalGroupXp);
        }
        return mapCalculation(result.calculation());
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

    private static AdventuringDayCalculatorModel.Calculation mapCalculation(AdventuringDayCalculation calculation) {
        return new AdventuringDayCalculatorModel.Calculation(
                new AdventuringDayCalculatorModel.Budget(
                        calculation.budget().totalBudgetXp(),
                        calculation.budget().perThirdXp(),
                        calculation.budget().firstShortRestXp(),
                        calculation.budget().secondShortRestXp(),
                        calculation.budget().characterCount()),
                new AdventuringDayCalculatorModel.Progress(
                        calculation.progress().totalGroupXp(),
                        calculation.progress().perCharacterAwardedXp(),
                        calculation.progress().partySize(),
                        calculation.progress().fullDays(),
                        calculation.progress().totalDays(),
                        calculation.progress().shortRests(),
                        calculation.progress().longRests(),
                        calculation.progress().levelProgressions().stream()
                                .map(progress -> new AdventuringDayCalculatorModel.LevelProgress(
                                        progress.startLevel(),
                                        progress.endLevel(),
                                        progress.characterCount(),
                                        progress.levelUps()))
                                .toList(),
                        calculation.progress().events().stream()
                                .map(event -> new AdventuringDayCalculatorModel.ProgressEvent(
                                        event.groupXp(),
                                        mapEventType(event.type()),
                                        event.dayNumber(),
                                        event.newLevel(),
                                        event.affectedCharacters(),
                                        event.partialDay()))
                                .toList()));
    }

    private static AdventuringDayCalculatorModel.ProgressEventType mapEventType(
            AdventuringDayProgressEventType type
    ) {
        if (type == null) {
            return AdventuringDayCalculatorModel.ProgressEventType.LONG_REST;
        }
        return switch (type) {
            case LEVEL_UP -> AdventuringDayCalculatorModel.ProgressEventType.LEVEL_UP;
            case SHORT_REST -> AdventuringDayCalculatorModel.ProgressEventType.SHORT_REST;
            case LONG_REST -> AdventuringDayCalculatorModel.ProgressEventType.LONG_REST;
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

}
