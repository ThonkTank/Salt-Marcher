package src.view.encounter.assembly;

import javafx.scene.Node;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.party.PartyApplicationService;
import src.view.encounter.View.EncounterNavigationGraphic;
import src.view.encounter.api.EncounterRuntimeSession;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

public final class EncounterAssembly {

    private EncounterAssembly() {
    }

    public static ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        EncounterRuntimeSession session = runtimeContext.session(
                EncounterRuntimeSession.class,
                () -> createRuntimeSession(runtimeContext));
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Encounter Builder";
            }

            @Override
            public String getNavigationLabel() {
                return "Encounter";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, session.controls(),
                        ShellSlot.COCKPIT_MAIN, session.workspace());
            }
        };
    }

    public static Supplier navigationGraphicSupplier() {
        return EncounterNavigationGraphic::create;
    }

    private static EncounterRuntimeSession createRuntimeSession(ShellRuntimeContext runtimeContext) {
        var services = runtimeContext.services();
        PartyApplicationService party = services.require(PartyApplicationService.class);
        CreaturesApplicationService creatures = services.require(CreaturesApplicationService.class);
        EncounterApplicationService encounters = new EncounterApplicationService(party, creatures);
        return EncounterRuntimeSession.create(encounters, creatures);
    }

}
