package src.domain.dungeon.model.editor.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class DungeonEditorDungeonState {

    private final MutableState mutable = new MutableState();

    public DungeonAuthoredPublishedStateRepository.CatalogPublication catalog() {
        return mutable.catalog;
    }

    public @Nullable DungeonMapIdentity mutationMapId() {
        return mutable.mutationMapId;
    }

    public DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshot() {
        return mutable.snapshot;
    }

    public DungeonAuthoredPublishedStateRepository.@Nullable InspectorPublication inspector() {
        return mutable.inspector;
    }

    public DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutation() {
        return mutable.mutation;
    }

    public void replaceCatalog(DungeonAuthoredPublishedStateRepository.CatalogPublication catalog) {
        mutable.catalog = catalog == null
                ? new DungeonAuthoredPublishedStateRepository.CatalogPublication(List.of())
                : catalog;
    }

    public void replaceMutationMapId(@Nullable DungeonMapIdentity mutationMapId) {
        mutable.mutationMapId = mutationMapId;
    }

    public void replaceSnapshot(DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshot) {
        mutable.snapshot = snapshot;
    }

    public void replaceInspector(DungeonAuthoredPublishedStateRepository.@Nullable InspectorPublication inspector) {
        mutable.inspector = inspector;
    }

    public void replaceMutation(DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutation) {
        mutable.mutation = mutation;
    }

    private static final class MutableState {
        private DungeonAuthoredPublishedStateRepository.CatalogPublication catalog =
                new DungeonAuthoredPublishedStateRepository.CatalogPublication(List.of());
        private @Nullable DungeonMapIdentity mutationMapId;
        private DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshot;
        private DungeonAuthoredPublishedStateRepository.@Nullable InspectorPublication inspector;
        private DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutation;
    }
}
