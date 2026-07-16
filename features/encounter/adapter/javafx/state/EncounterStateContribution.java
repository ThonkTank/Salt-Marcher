package features.encounter.adapter.javafx.state;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import shell.api.ContributionKey;
import shell.api.InspectorSink;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellStateTabSpec;
import features.creatures.api.CreaturesApi;
import features.creatures.api.CreatureDetailModel;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterStateModel;
import features.worldplanner.api.WorldPlannerApi;
import features.encounter.adapter.javafx.details.CreatureDetailsView;

public final class EncounterStateContribution implements ShellContribution {

    private final CreatureDetailModel detailModel;
    private final CreaturesApi creatures;
    private final EncounterStateModel stateModel;
    private final EncounterApi encounters;
    private final @Nullable WorldPlannerApi worldPlanner;
    private final InspectorSink inspector;

    public EncounterStateContribution(
            CreatureDetailModel detailModel,
            CreaturesApi creatures,
            EncounterStateModel stateModel,
            EncounterApi encounters,
            @Nullable WorldPlannerApi worldPlanner,
            InspectorSink inspector
    ) {
        this.detailModel = Objects.requireNonNull(detailModel, "detailModel");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.worldPlanner = worldPlanner;
        this.inspector = Objects.requireNonNull(inspector, "inspector");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellStateTabSpec(new ContributionKey("encounter"), "Encounter", 30);
    }

    @Override
    public ShellBinding bind() {
        EncounterStateViewModel viewModel = new EncounterStateViewModel(
                encounters,
                worldPlanner,
                creatures,
                creatureId -> CreatureDetailsView.openInspector(inspector, detailModel, creatureId));
        EncounterBuilderStateView builderView = new EncounterBuilderStateView();
        EncounterInitiativeStateView initiativeView = new EncounterInitiativeStateView();
        EncounterCombatStateView combatView = new EncounterCombatStateView();
        EncounterResultsStateView resultsView = new EncounterResultsStateView();
        EncounterStateView state = new EncounterStateView(builderView, initiativeView, combatView, resultsView);
        state.bind(viewModel.activeModeProperty());
        builderView.bind(viewModel.builderPanelProperty());
        initiativeView.bind(viewModel.initiativePanelProperty());
        combatView.bind(viewModel.combatPanelProperty());
        resultsView.bind(viewModel.resultsPanelProperty());
        stateModel.subscribe(viewModel::apply);
        viewModel.apply(stateModel.current());
        builderView.onGenerate(viewModel::generate);
        builderView.onShiftAlternative(viewModel::shiftAlternative);
        builderView.onSaveCurrentPlan(viewModel::saveCurrentPlan);
        builderView.onOpenSavedPlan(viewModel::openSavedPlan);
        builderView.onChangeRosterCount(viewModel::changeRosterCount);
        builderView.onRemoveCreature(viewModel::removeCreature);
        builderView.onUndoRemove(viewModel::undoRemove);
        builderView.onClearGenerationHistory(viewModel::clearGenerationHistory);
        builderView.onOpenInitiative(viewModel::openInitiative);
        builderView.onOpenCreatureDetail(viewModel::openCreatureDetail);
        initiativeView.onBackToBuilder(viewModel::backToBuilder);
        initiativeView.onConfirmInitiative(viewModel::confirmInitiative);
        combatView.onAdvanceTurn(viewModel::advanceTurn);
        combatView.onEndCombat(viewModel::endCombat);
        combatView.onChangeHitPoints(viewModel::mutateHitPoints);
        combatView.onEditInitiative(viewModel::adjustInitiative);
        combatView.onAddPartyMember(viewModel::addPartyMemberToCombat);
        resultsView.onSelectionChanged(viewModel::updateResultSelection);
        resultsView.onAwardExperience(viewModel::awardXp);
        resultsView.onReturnToBuilder(viewModel::returnToBuilderAfterResults);
        return ShellBinding.state("Encounter", state);
    }

}
