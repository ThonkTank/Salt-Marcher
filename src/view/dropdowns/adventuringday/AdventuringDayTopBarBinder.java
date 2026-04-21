package src.view.dropdowns.adventuringday;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.party.PartyApplicationService;
import src.view.slotcontent.topbar.adventuringday.AdventuringDayCalculatorView;

final class AdventuringDayTopBarBinder {

    private final ShellRuntimeContext runtimeContext;

    AdventuringDayTopBarBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        AdventuringDayTopBarViewModel viewModel = new AdventuringDayTopBarViewModel(party);
        AdventuringDayTopBarView view = new AdventuringDayTopBarView();
        view.triggerTextProperty().bind(viewModel.triggerTextProperty());
        view.setCalculationProvider((levels, totalGroupXp) -> toCalculation(viewModel.calculate(levels, totalGroupXp)));
        view.showPanel(toPanelContent(viewModel.panelProperty().get()));
        viewModel.panelProperty().addListener((ignored, before, after) -> view.showPanel(toPanelContent(after)));
        view.onOpen(viewModel::refresh);
        viewModel.refresh();
        return new Binding(view);
    }

    private static AdventuringDayTopBarView.PanelContent toPanelContent(AdventuringDayTopBarViewModel.PanelModel model) {
        AdventuringDayTopBarViewModel.PanelModel safeModel = model == null
                ? AdventuringDayTopBarViewModel.PanelModel.loadingModel()
                : model;
        return new AdventuringDayTopBarView.PanelContent(
                safeModel.loading(),
                safeModel.error(),
                safeModel.empty(),
                safeModel.activePartyLevels());
    }

    private static AdventuringDayCalculatorView.Calculation toCalculation(
            AdventuringDayTopBarViewModel.CalculationModel model
    ) {
        AdventuringDayTopBarViewModel.CalculationModel safeModel = model == null
                ? AdventuringDayTopBarViewModel.CalculationModel.empty(0)
                : model;
        return new AdventuringDayCalculatorView.Calculation(
                toBudget(safeModel.budget()),
                toProgress(safeModel.progress()));
    }

    private static AdventuringDayCalculatorView.Budget toBudget(AdventuringDayTopBarViewModel.BudgetModel model) {
        AdventuringDayTopBarViewModel.BudgetModel safeModel = model == null
                ? new AdventuringDayTopBarViewModel.BudgetModel(0, 0, 0, 0, 0)
                : model;
        return new AdventuringDayCalculatorView.Budget(
                safeModel.totalXp(),
                safeModel.perThirdXp(),
                safeModel.firstShortRestXp(),
                safeModel.secondShortRestXp(),
                safeModel.characterCount());
    }

    private static AdventuringDayCalculatorView.Progress toProgress(AdventuringDayTopBarViewModel.ProgressModel model) {
        AdventuringDayTopBarViewModel.ProgressModel safeModel = model == null
                ? new AdventuringDayTopBarViewModel.ProgressModel(
                        0,
                        0,
                        0,
                        0,
                        0.0,
                        0,
                        0,
                        java.util.List.of(),
                        java.util.List.of())
                : model;
        return new AdventuringDayCalculatorView.Progress(
                safeModel.totalGroupXp(),
                safeModel.perCharacterAwardedXp(),
                safeModel.partySize(),
                safeModel.fullDays(),
                safeModel.totalDays(),
                safeModel.shortRests(),
                safeModel.longRests(),
                safeModel.levelProgressions().stream()
                        .map(AdventuringDayTopBarBinder::toLevelProgress)
                        .toList(),
                safeModel.events().stream()
                        .map(AdventuringDayTopBarBinder::toProgressEvent)
                        .toList());
    }

    private static AdventuringDayCalculatorView.LevelProgress toLevelProgress(
            AdventuringDayTopBarViewModel.LevelProgressModel model
    ) {
        AdventuringDayTopBarViewModel.LevelProgressModel safeModel = model == null
                ? new AdventuringDayTopBarViewModel.LevelProgressModel(1, 1, 0, 0)
                : model;
        return new AdventuringDayCalculatorView.LevelProgress(
                safeModel.startLevel(),
                safeModel.endLevel(),
                safeModel.characterCount(),
                safeModel.levelUps());
    }

    private static AdventuringDayCalculatorView.ProgressEvent toProgressEvent(
            AdventuringDayTopBarViewModel.ProgressEventModel model
    ) {
        AdventuringDayTopBarViewModel.ProgressEventModel safeModel = model == null
                ? new AdventuringDayTopBarViewModel.ProgressEventModel(
                        0,
                        AdventuringDayTopBarViewModel.ProgressEventTypeModel.LONG_REST,
                        0,
                        0,
                        0,
                        false)
                : model;
        return new AdventuringDayCalculatorView.ProgressEvent(
                safeModel.groupXp(),
                toProgressEventType(safeModel.type()),
                safeModel.dayNumber(),
                safeModel.newLevel(),
                safeModel.affectedCharacters(),
                safeModel.partialDay());
    }

    private static AdventuringDayCalculatorView.ProgressEventType toProgressEventType(
            AdventuringDayTopBarViewModel.ProgressEventTypeModel type
    ) {
        return switch (type == null ? AdventuringDayTopBarViewModel.ProgressEventTypeModel.LONG_REST : type) {
            case LEVEL_UP -> AdventuringDayCalculatorView.ProgressEventType.LEVEL_UP;
            case SHORT_REST -> AdventuringDayCalculatorView.ProgressEventType.SHORT_REST;
            case LONG_REST -> AdventuringDayCalculatorView.ProgressEventType.LONG_REST;
        };
    }

    private record Binding(Node topBar) implements ShellBinding {

        @Override
        public String title() {
            return "Adventuring Day";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.TOP_BAR, topBar);
        }
    }
}
