package src.view.encounter.interactor;

import javafx.scene.Node;
import src.domain.creatures.creaturesAPI;
import src.domain.encounter.encounterAPI;
import src.view.encounter.Controller.EncounterController;
import src.view.encounter.Model.EncounterModel;
import src.view.encounter.View.EncounterView;

import java.util.Objects;

public final class EncounterRuntimeSession {

    private final EncounterView view;
    private final EncounterRuntimeStatePane statePane;

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
