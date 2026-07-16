package features.scene;

import features.encounter.api.EncounterRuntimeContextApi;
import features.party.api.ActivePartyModel;
import features.scene.adapter.javafx.SceneContribution;
import features.scene.adapter.sqlite.SqliteSceneWorkspaceRepository;
import features.scene.api.SceneApi;
import features.scene.api.SceneModel;
import features.scene.application.SceneApplicationService;
import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.Objects;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.ui.UiDispatcher;
import shell.api.ShellContribution;

public final class SceneFeature {

    private SceneFeature() { }

    public static Component create(
            SqliteDatabase database,
            ActivePartyModel party,
            WorldPlannerSnapshotModel world,
            PreparedSceneCatalogModel preparedScenes,
            EncounterRuntimeContextApi encounters,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        SceneApplicationService application = new SceneApplicationService(
                new SqliteSceneWorkspaceRepository(Objects.requireNonNull(database, "database")),
                party,
                world,
                preparedScenes,
                encounters,
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

        public ShellContribution contribution() {
            return new SceneContribution(application, model);
        }
    }
}
