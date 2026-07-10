package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;

public record DungeonEditorRuntimeDependencies(
        CompatibilityReadbackModels compatibilityReadbackModels,
        DungeonAuthoredApplicationService authoredApplicationService,
        PublishedStateRepositories publishedStateRepositories
) {
    public DungeonEditorRuntimeDependencies {
        compatibilityReadbackModels =
                Objects.requireNonNull(compatibilityReadbackModels, "compatibilityReadbackModels");
        authoredApplicationService =
                Objects.requireNonNull(authoredApplicationService, "authoredApplicationService");
        publishedStateRepositories =
                Objects.requireNonNull(publishedStateRepositories, "publishedStateRepositories");
    }

    public record CompatibilityReadbackModels(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel
    ) {
        public CompatibilityReadbackModels {
            controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
            mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
            stateModel = Objects.requireNonNull(stateModel, "stateModel");
        }
    }

    public record PublishedStateRepositories(
            DungeonEditorSnapshotPublishedStateRepository editorSnapshotPublishedStateRepository
    ) {
        public PublishedStateRepositories {
            editorSnapshotPublishedStateRepository =
                    Objects.requireNonNull(
                            editorSnapshotPublishedStateRepository,
                            "editorSnapshotPublishedStateRepository");
        }
    }
}
