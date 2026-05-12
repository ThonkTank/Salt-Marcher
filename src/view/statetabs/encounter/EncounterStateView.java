package src.view.statetabs.encounter;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

public final class EncounterStateView extends VBox {

    private final EncounterBuilderStateView builderView;
    private final EncounterInitiativeStateView initiativeView;
    private final EncounterCombatStateView combatView;
    private final EncounterResultsStateView resultsView;
    private final ContentArea contentArea = new ContentArea();

    public EncounterStateView(
            EncounterBuilderStateView builderView,
            EncounterInitiativeStateView initiativeView,
            EncounterCombatStateView combatView,
            EncounterResultsStateView resultsView
    ) {
        this.builderView = builderView;
        this.initiativeView = initiativeView;
        this.combatView = combatView;
        this.resultsView = resultsView;
        setSpacing(0);
        setPadding(new Insets(0));
        getStyleClass().add("surface-root");
        setFillWidth(true);
        setVgrow(contentArea, Priority.ALWAYS);
        getChildren().add(contentArea);
    }

    public void render(EncounterStateContributionModel contributionModel) {
        EncounterStateContributionModel safeModel = contributionModel == null
                ? new EncounterStateContributionModel()
                : contributionModel;
        switch (safeModel.modeProperty().get()) {
            case INITIATIVE -> showInitiative(safeModel.initiativeStateProperty().get());
            case COMBAT -> showCombat(safeModel.combatStateProperty().get());
            case RESULTS -> showResults(safeModel.resultStateProperty().get());
            case BUILDER -> showBuilder(safeModel.builderStateProperty().get());
            default -> showBuilder(safeModel.builderStateProperty().get());
        }
    }

    private void showBuilder(EncounterBuilderState state) {
        builderView.showBuilder(state);
        showContent(builderView);
    }

    private void showInitiative(EncounterInitiativeStateViewModel state) {
        initiativeView.showInitiative(state);
        showContent(initiativeView);
    }

    private void showCombat(EncounterCombatStateViewModel state) {
        combatView.showCombat(state);
        showContent(combatView);
    }

    private void showResults(EncounterResultStateView state) {
        resultsView.showResults(state);
        showContent(resultsView);
    }

    private void showContent(Node node) {
        if (contentArea.shows(node)) {
            return;
        }
        contentArea.showOnly(node);
    }

    private static final class ContentArea extends StackPane {

        private boolean shows(Node node) {
            return getChildren().size() == 1 && java.util.Objects.equals(getChildren().get(0), node);
        }

        private void showOnly(Node node) {
            getChildren().setAll(node);
        }
    }
}
