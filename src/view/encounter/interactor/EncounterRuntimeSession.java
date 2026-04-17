package src.view.encounter.interactor;

import javafx.scene.Node;
import shell.host.ShellRuntimeContext;
import src.domain.creatures.creaturesAPI;
import src.domain.encounter.encounterAPI;
import src.view.encounter.Controller.EncounterController;
import src.view.encounter.Model.EncounterModel;
import src.view.encounter.View.EncounterView;

import java.util.Objects;

public final class EncounterRuntimeSession {

    private final EncounterView view;
    private final EncounterRuntimeStatePane statePane;

    public static EncounterRuntimeSession from(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        return runtimeContext.session(EncounterRuntimeSession.class, () -> {
            var persistence = runtimeContext.persistence();
            var party = persistence.require(src.domain.party.partyAPI.Factory.class).create();
            var creatures = persistence.require(creaturesAPI.Factory.class).create();
            return new EncounterRuntimeSession(new encounterAPI(party, creatures), creatures);
        });
    }

    public EncounterRuntimeSession(encounterAPI encounters, creaturesAPI creatures) {
        Objects.requireNonNull(encounters, "encounters");
        Objects.requireNonNull(creatures, "creatures");
        EncounterModel model = new EncounterModel();
        EncounterInteractor interactor = new EncounterInteractor(encounters, creatures, model);
        EncounterController controller = new EncounterController(interactor);
        this.view = new EncounterView(model, controller);
        this.statePane = new EncounterRuntimeStatePane(model, controller);
        controller.initialize();
    }

    public Node controls() {
        return view.controls();
    }

    public Node workspace() {
        return view.workspace();
    }

    public Node state() {
        return statePane.content();
    }
}
