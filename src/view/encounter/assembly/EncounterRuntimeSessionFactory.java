package src.view.encounter.assembly;

import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.view.encounter.View.EncounterRuntimeStatePane;
import src.view.encounter.View.EncounterView;
import src.view.encounter.ViewModel.EncounterViewModel;
import src.view.encounter.api.EncounterRuntimeSession;

import java.util.Objects;

public final class EncounterRuntimeSessionFactory {

    private EncounterRuntimeSessionFactory() {
    }

    public static EncounterRuntimeSession create(Object encounterService, Object creatureService) {
        EncounterApplicationService encounters =
                (EncounterApplicationService) Objects.requireNonNull(encounterService, "encounterService");
        CreaturesApplicationService creatures =
                (CreaturesApplicationService) Objects.requireNonNull(creatureService, "creatureService");
        EncounterViewModel viewModel = new EncounterViewModel(encounters, creatures);
        EncounterView view = new EncounterView(viewModel);
        EncounterRuntimeStatePane statePane = new EncounterRuntimeStatePane(viewModel);
        viewModel.initialize();
        return EncounterRuntimeSession.of(view.controls(), view.workspace(), statePane.content());
    }
}
