package src.domain.scene;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import src.domain.encounter.published.EncounterRuntimeContextApi;
import src.domain.party.published.ActivePartyModel;
import src.domain.scene.model.repository.SceneWorkspaceRepository;
import src.domain.scene.published.SceneModel;
import src.domain.scene.published.SceneSnapshot;
import src.domain.sessionplanner.published.PreparedSceneSource;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class SceneServiceAssembly {
    private final SceneApplicationService application;
    private final List<Consumer<SceneSnapshot>> listeners = new ArrayList<>();
    private final SceneModel model;

    public SceneServiceAssembly(
            SceneWorkspaceRepository repository,
            ActivePartyModel party,
            WorldPlannerSnapshotModel world,
            PreparedSceneSource preparedScenes,
            EncounterRuntimeContextApi encounters
    ) {
        application = new SceneApplicationService(repository, party, world, preparedScenes, encounters);
        model = new SceneModel(application::current, this::subscribe);
        party.subscribe(ignored -> refresh());
        world.subscribe(ignored -> refresh());
    }

    public SceneApplicationService application() { return application; }
    public SceneModel model() { return model; }

    public void publish() { notifyListeners(); }

    private void refresh() {
        application.refreshForeignFacts();
        notifyListeners();
    }

    private Runnable subscribe(Consumer<SceneSnapshot> listener) {
        listeners.add(listener);
        return () -> listeners.remove(listener);
    }

    private void notifyListeners() {
        SceneSnapshot snapshot = application.current();
        for (Consumer<SceneSnapshot> listener : List.copyOf(listeners)) {
            listener.accept(snapshot);
        }
    }
}
