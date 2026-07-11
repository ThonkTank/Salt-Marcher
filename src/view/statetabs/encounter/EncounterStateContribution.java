package src.view.statetabs.encounter;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellStateTabSpec;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.view.slotcontent.details.creature.CreatureDetailsView;

public final class EncounterStateContribution implements ShellContribution {

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellStateTabSpec(new ContributionKey("encounter"), "Encounter", 30);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        ShellRuntimeContext safeRuntimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
        var services = safeRuntimeContext.services();
        var detailModel = services.require(CreatureDetailModel.class);
        var creatures = services.require(CreaturesApplicationService.class);
        var stateModel = services.require(EncounterStateModel.class);
        var encounters = services.require(EncounterApplicationService.class);
        var worldPlanner = services.find(WorldPlannerApplicationService.class).orElse(null);
        EncounterStateViewModel viewModel = new EncounterStateViewModel(
                encounters,
                worldPlanner,
                creatures,
                creatureId -> CreatureDetailsView.openInspector(safeRuntimeContext.inspector(), detailModel, creatureId));
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
