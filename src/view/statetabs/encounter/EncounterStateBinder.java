package src.view.statetabs.encounter;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.party.PartyApplicationService;
import src.view.slotcontent.state.encounter.EncounterRuntimeViewModel;

final class EncounterStateBinder {

    private final ShellRuntimeContext runtimeContext;

    EncounterStateBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
        EncounterApplicationService encounters = new EncounterApplicationService(party, creatures);
        EncounterRuntimeViewModel encounterSession = runtimeContext.session(
                EncounterRuntimeViewModel.class,
                EncounterRuntimeViewModel::new);
        EncounterStateViewModel viewModel = new EncounterStateViewModel(encounters, creatures, party);
        EncounterStateView state = new EncounterStateView();
        state.statusTextProperty().bind(viewModel.statusProperty());
        wireActions(state, viewModel, encounterSession);
        wireSession(encounterSession, viewModel);
        wireRendering(state, viewModel);
        render(state, viewModel);
        return new Binding(state);
    }

    private void wireActions(
            EncounterStateView state,
            EncounterStateViewModel viewModel,
            EncounterRuntimeViewModel encounterSession
    ) {
        state.setOnGenerate(input -> {
            EncounterRuntimeViewModel.EncounterFilters filters = encounterSession.filters();
            viewModel.generate(
                    new EncounterStateViewModel.BuilderSettings(
                            input.difficultyLabel(),
                            input.balanceLevel(),
                            input.amountValue(),
                            input.diversityLevel()),
                    filters.types(),
                    filters.subtypes(),
                    filters.biomes(),
                    encounterSession.difficulty());
        });
        state.setOnStartInitiative(viewModel::openInitiative);
        state.setOnInitiativeBack(viewModel::backToBuilder);
        state.setOnInitiativeConfirm(inputs -> viewModel.confirmInitiative(inputs.stream()
                .map(input -> new EncounterStateViewModel.InitiativeInput(input.id(), input.initiative()))
                .toList()));
        state.setOnNextTurn(viewModel::nextTurn);
        state.setOnDamage(viewModel::applyDamage);
        state.setOnHeal(viewModel::heal);
        state.setOnSetInitiative(viewModel::setInitiative);
        state.setOnEndCombat(viewModel::endCombat);
        state.setOnAwardXp(viewModel::awardXp);
        state.setOnReturnToBuilder(viewModel::returnToBuilderAfterResults);
    }

    private void wireSession(EncounterRuntimeViewModel encounterSession, EncounterStateViewModel viewModel) {
        encounterSession.creatureAddRequestProperty().addListener((obs, oldRequest, newRequest) -> {
            if (newRequest != null) {
                viewModel.addCreature(newRequest.creatureId());
            }
        });
        encounterSession.partyRefreshTokenProperty().addListener((obs, oldToken, newToken) ->
                viewModel.refreshPartyContext());
    }

    private void wireRendering(EncounterStateView state, EncounterStateViewModel viewModel) {
        viewModel.modeProperty().addListener((obs, oldMode, newMode) -> render(state, viewModel));
        viewModel.builderStateProperty().addListener((obs, oldState, newState) -> render(state, viewModel));
        viewModel.initiativeStateProperty().addListener((obs, oldState, newState) -> render(state, viewModel));
        viewModel.combatStateProperty().addListener((obs, oldState, newState) -> render(state, viewModel));
        viewModel.resultStateProperty().addListener((obs, oldState, newState) -> render(state, viewModel));
    }

    private void render(EncounterStateView state, EncounterStateViewModel viewModel) {
        switch (viewModel.modeProperty().get()) {
            case BUILDER -> state.showBuilder(toBuilderState(viewModel.builderStateProperty().get()));
            case INITIATIVE -> state.showInitiative(toInitiativeState(viewModel.initiativeStateProperty().get()));
            case COMBAT -> state.showCombat(toCombatState(viewModel.combatStateProperty().get()));
            case RESULTS -> state.showResults(toResultState(viewModel.resultStateProperty().get()));
        }
    }

    private EncounterStateView.BuilderStateView toBuilderState(EncounterStateViewModel.BuilderState source) {
        EncounterStateViewModel.DifficultySummary difficulty = source.difficulty();
        EncounterStateViewModel.BuilderSettings settings = source.settings();
        String partyLabel = "Party: " + source.party().size() + ", Lv "
                + Math.round(source.party().stream().mapToInt(EncounterStateViewModel.PartyMember::level)
                .average().orElse(1.0));
        return new EncounterStateView.BuilderStateView(
                partyLabel,
                source.templateLabel(),
                new EncounterStateView.DifficultySummaryView(
                        difficulty.easy(),
                        difficulty.medium(),
                        difficulty.hard(),
                        difficulty.deadly(),
                        difficulty.adjustedXp(),
                        difficulty.difficulty()),
                new EncounterStateView.BuilderSettingsInput(
                        settings.difficultyLabel(),
                        settings.balanceLevel(),
                        settings.amountValue(),
                        settings.diversityLevel()),
                source.roster().stream()
                        .map(creature -> new EncounterStateView.RosterCardView(
                                creature.name(),
                                creature.cr(),
                                creature.totalXp(),
                                creature.ac(),
                                creature.type(),
                                creature.role(),
                                creature.count()))
                        .toList(),
                source.canStartCombat(),
                source.message());
    }

    private EncounterStateView.InitiativeStateView toInitiativeState(
            EncounterStateViewModel.InitiativeState source
    ) {
        return new EncounterStateView.InitiativeStateView(source.entries().stream()
                .map(entry -> new EncounterStateView.InitiativeEntryView(
                        entry.id(),
                        entry.label(),
                        entry.kind(),
                        entry.initiative()))
                .toList());
    }

    private EncounterStateView.CombatStateView toCombatState(EncounterStateViewModel.CombatState source) {
        return new EncounterStateView.CombatStateView(
                source.round(),
                source.status(),
                source.cards().stream()
                        .map(card -> new EncounterStateView.CombatCardView(
                                card.id(),
                                card.name(),
                                card.playerCharacter(),
                                card.active(),
                                card.alive(),
                                card.currentHp(),
                                card.maxHp(),
                                card.armorClass(),
                                card.initiative(),
                                card.count(),
                                card.detail()))
                        .toList(),
                source.allEnemiesDefeated());
    }

    private EncounterStateView.ResultStateView toResultState(EncounterStateViewModel.ResultState source) {
        return new EncounterStateView.ResultStateView(
                source.enemies().stream()
                        .map(enemy -> new EncounterStateView.ResultEnemyView(
                                enemy.name(),
                                enemy.status(),
                                enemy.hpLoss(),
                                enemy.xp(),
                                enemy.defeatedByDefault(),
                                enemy.loot()))
                        .toList(),
                source.defeatedCount(),
                source.eligibleXp(),
                source.perPlayerXp(),
                source.goldSummary(),
                source.lootDetail(),
                source.awardStatus(),
                source.xpAwarded(),
                source.canAwardXp(),
                source.partySize());
    }

    private record Binding(Node state) implements ShellBinding {

        @Override
        public String title() {
            return "Encounter";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(ShellSlot.COCKPIT_STATE, state);
        }
    }
}
