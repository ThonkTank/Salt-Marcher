package src.view.statetabs.encounter;

final class EncounterStateRenderer {

    private final EncounterStateView state;
    private final EncounterBuilderStateView builderView;
    private final EncounterInitiativeStateView initiativeView;
    private final EncounterCombatStateView combatView;
    private final EncounterResultsStateView resultsView;
    private final EncounterStateContributionModel presentationModel;

    EncounterStateRenderer(
            EncounterStateView state,
            EncounterBuilderStateView builderView,
            EncounterInitiativeStateView initiativeView,
            EncounterCombatStateView combatView,
            EncounterResultsStateView resultsView,
            EncounterStateContributionModel presentationModel
    ) {
        this.state = state;
        this.builderView = builderView;
        this.initiativeView = initiativeView;
        this.combatView = combatView;
        this.resultsView = resultsView;
        this.presentationModel = presentationModel;
    }

    void render() {
        switch (presentationModel.modeProperty().get()) {
            case BUILDER -> showBuilder();
            case INITIATIVE -> showInitiative();
            case COMBAT -> showCombat();
            case RESULTS -> showResults();
            default -> showBuilder();
        }
    }

    private void showBuilder() {
        builderView.showBuilder(presentationModel.builderStateProperty().get());
        state.showContent(builderView);
    }

    private void showInitiative() {
        initiativeView.showInitiative(presentationModel.initiativeStateProperty().get());
        state.showContent(initiativeView);
    }

    private void showCombat() {
        combatView.showCombat(presentationModel.combatStateProperty().get());
        state.showContent(combatView);
    }

    private void showResults() {
        resultsView.showResults(presentationModel.resultStateProperty().get());
        state.showContent(resultsView);
    }
}
