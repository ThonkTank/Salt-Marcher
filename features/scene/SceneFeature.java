package features.scene;

import features.creatures.api.CreatureReferenceIndexModel;
import features.encounter.api.EncounterRuntimeContextApi;
import features.party.api.ActivePartyModel;
import features.scene.adapter.javafx.SceneContribution;
import features.scene.adapter.sqlite.SqliteSceneWorkspaceRepository;
import features.scene.api.SceneApi;
import features.scene.api.SceneModel;
import features.scene.application.SceneApplicationService;
import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;

import java.util.Objects;

public final class SceneFeature {

    private SceneFeature() { }

    public static FeatureStoreDefinition storeDefinition() {
        return SqliteSceneWorkspaceRepository.storeDefinition();
    }

    public static Component create(
            FeatureStoreHandle store,
            ActivePartyModel party,
            WorldPlannerSnapshotModel world,
            PreparedSceneCatalogModel preparedScenes,
            EncounterRuntimeContextApi encounters,
            CreatureReferenceIndexModel creatureReferences,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        SceneApplicationService application = new SceneApplicationService(
                new SqliteSceneWorkspaceRepository(store),
                party,
                world,
                preparedScenes,
                encounters,
                creatureReferences,
                executionLane,
                uiDispatcher,
                diagnostics);
        return new Component(application, application.model());
    }

    public record Component(SceneApi application, SceneModel model) {

        public Component {
            application = Objects.requireNonNull(application, "application");
            model = Objects.requireNonNull(model, "model");
        }

        public ShellContribution contribution(java.util.function.LongConsumer openStatblock) {
            return new SceneContribution(application, model, openStatblock);
        }
    }
}
