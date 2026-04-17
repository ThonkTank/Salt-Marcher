package src.view.encounterstate;

import javafx.scene.Node;
import shell.host.ContributionKey;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellRuntimeStateSpec;
import shell.host.ShellScreen;
import shell.host.ShellSlot;
import shell.host.ShellViewContribution;
import src.domain.creatures.creaturesAPI;
import src.domain.encounter.encounterAPI;
import src.domain.party.partyAPI;
import src.view.encounter.interactor.EncounterRuntimeSession;

import java.util.Map;

public final class EncounterstateViewContribution implements ShellViewContribution {

    public EncounterstateViewContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellRuntimeStateSpec(new ContributionKey("encounter-state"), "Encounter", 10);
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        EncounterRuntimeSession session = runtimeContext.session(EncounterRuntimeSession.class, () -> {
            partyAPI party = runtimeContext.persistence().require(partyAPI.Factory.class).create();
            creaturesAPI creatures = runtimeContext.persistence().require(creaturesAPI.Factory.class).create();
            return new EncounterRuntimeSession(new encounterAPI(party, creatures), creatures);
        });
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
}
