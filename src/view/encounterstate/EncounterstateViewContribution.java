package src.view.encounterstate;

import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import shell.api.ShellViewContribution;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.party.PartyApplicationService;
import src.view.encounter.View.EncounterRuntimeSession;
import src.view.encounter.ViewModel.EncounterViewModel;

public final class EncounterstateViewContribution implements ShellViewContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public EncounterstateViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("encounter-state"), "Encounter", 10);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        EncounterRuntimeSession session = runtimeContext.session(
                EncounterRuntimeSession.class,
                () -> createRuntimeSession(runtimeContext));
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Encounter State";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.COCKPIT_STATE, session.state());
            }
        };
    }

    private static EncounterRuntimeSession createRuntimeSession(ShellRuntimeContext runtimeContext) {
        var services = runtimeContext.services();
        PartyApplicationService party = services.require(PartyApplicationService.class);
        CreaturesApplicationService creatures = services.require(CreaturesApplicationService.class);
        EncounterApplicationService encounters = new EncounterApplicationService(party, creatures);
        return EncounterRuntimeSession.create(new EncounterViewModel(encounters, creatures));
    }
}
