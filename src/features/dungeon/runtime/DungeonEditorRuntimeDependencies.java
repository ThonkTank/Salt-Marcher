package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;

public record DungeonEditorRuntimeDependencies(
        CompatibilityReadbackModels compatibilityReadbackModels,
        PublishedStateRepositories publishedStateRepositories,
        AuthoredMapPersistence authoredMapPersistence
) {
    public DungeonEditorRuntimeDependencies {
        compatibilityReadbackModels =
                Objects.requireNonNull(compatibilityReadbackModels, "compatibilityReadbackModels");
        publishedStateRepositories =
                Objects.requireNonNull(publishedStateRepositories, "publishedStateRepositories");
        authoredMapPersistence = Objects.requireNonNull(authoredMapPersistence, "authoredMapPersistence");
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
            DungeonAuthoredPublishedStateRepository authoredPublishedStateRepository,
            DungeonEditorSnapshotPublishedStateRepository editorSnapshotPublishedStateRepository
    ) {
        public PublishedStateRepositories {
            authoredPublishedStateRepository =
                    Objects.requireNonNull(authoredPublishedStateRepository, "authoredPublishedStateRepository");
            editorSnapshotPublishedStateRepository =
                    Objects.requireNonNull(
                            editorSnapshotPublishedStateRepository,
                            "editorSnapshotPublishedStateRepository");
        }
    }

    public static final class AuthoredMapPersistence {
        private final DungeonMapRepository dungeonMapRepository;

        public AuthoredMapPersistence(DungeonMapRepository dungeonMapRepository) {
            this.dungeonMapRepository = Objects.requireNonNull(dungeonMapRepository, "dungeonMapRepository");
        }

        DungeonMapRepository repositoryForRuntimeAssembly() {
            return dungeonMapRepository;
        }
    }
}
