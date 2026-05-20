package src.domain.dungeon.model.editor.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;

public final class DungeonEditorDungeonState {

    private final MutableState mutable = new MutableState();

    public CatalogFacts catalog() {
        return mutable.catalog;
    }

    public @Nullable DungeonMapIdentity mutationMapId() {
        return mutable.mutationMapId;
    }

    public @Nullable SnapshotFacts snapshot() {
        return mutable.snapshot;
    }

    public @Nullable InspectorFacts inspector() {
        return mutable.inspector;
    }

    public @Nullable MutationFacts mutation() {
        return mutable.mutation;
    }

    public void replaceCatalog(CatalogFacts catalog) {
        mutable.catalog = catalog == null ? new CatalogFacts(List.of()) : catalog;
    }

    public void replaceMutationMapId(@Nullable DungeonMapIdentity mutationMapId) {
        mutable.mutationMapId = mutationMapId;
    }

    public void replaceSnapshot(@Nullable SnapshotFacts snapshot) {
        mutable.snapshot = snapshot;
    }

    public void replaceInspector(@Nullable InspectorFacts inspector) {
        mutable.inspector = inspector;
    }

    public void replaceMutation(@Nullable MutationFacts mutation) {
        mutable.mutation = mutation;
    }

    private static final class MutableState {
        private CatalogFacts catalog = new CatalogFacts(List.of());
        private @Nullable DungeonMapIdentity mutationMapId;
        private @Nullable SnapshotFacts snapshot;
        private @Nullable InspectorFacts inspector;
        private @Nullable MutationFacts mutation;
    }

    public record CatalogFacts(List<MapSummaryFacts> maps) {
        public CatalogFacts {
            maps = maps == null ? List.of() : List.copyOf(maps);
        }
    }

    public record MapSummaryFacts(DungeonMapIdentity mapId, String mapName, long revision) {
    }

    public record SnapshotFacts(
            String mapName,
            DungeonDerivedState derived,
            List<DungeonEditorHandleFacts> editorHandles,
            long revision
    ) {
        public SnapshotFacts {
            editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
        }
    }

    public record InspectorFacts(
            String title,
            String description,
            List<String> facts,
            List<RoomNarrationFacts> roomNarrations
    ) {
        public InspectorFacts {
            facts = facts == null ? List.of() : List.copyOf(facts);
            roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
        }
    }

    public record RoomNarrationFacts(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarrationFacts> exits
    ) {
        public RoomNarrationFacts {
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record RoomExitNarrationFacts(
            String label,
            DungeonCell cell,
            DungeonEdgeDirection direction,
            String description
    ) {
    }

    public record MutationFacts(
            SnapshotFacts snapshot,
            List<String> validationMessages,
            List<String> reactionMessages
    ) {
        public MutationFacts {
            validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
            reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
        }
    }
}
