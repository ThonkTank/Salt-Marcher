package features.world.quarantine.dungeonmap.editor.quarantine.state;

import features.world.quarantine.dungeonmap.editor.quarantine.loading.DungeonEditorSessionWorkflow;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

import java.util.Objects;
import java.util.function.Consumer;

/**
 * Holds the mutable layout state and provides {@link DungeonEditorSessionReadModel} to
 * subobjects before the coordinator is constructed. The {@code currentLayout} field starts
 * {@code null} and is kept up to date via {@link #updateLayout} and
 * {@link #applyExternalUpdate}. The {@code onExternalUpdate} callback is required at
 * construction time.
 */
final class DungeonEditorMutableReadModel implements DungeonEditorSessionReadModel {

    private final DungeonEditorSessionWorkflow sessionWorkflow;
    private Consumer<DungeonEditorSessionUpdate> onExternalUpdate;
    private DungeonLayout currentLayout;

    DungeonEditorMutableReadModel(DungeonEditorSessionWorkflow sessionWorkflow) {
        this.sessionWorkflow = sessionWorkflow;
    }

    void updateLayout(DungeonLayout layout) {
        this.currentLayout = layout;
    }

    void setOnExternalUpdate(Consumer<DungeonEditorSessionUpdate> onExternalUpdate) {
        this.onExternalUpdate = Objects.requireNonNull(onExternalUpdate, "onExternalUpdate");
    }

    void applyExternalUpdate(DungeonEditorSessionUpdate update) {
        if (update == null) return;
        if (update.kind() == DungeonEditorSessionUpdate.Kind.LAYOUT_CHANGED) {
            this.currentLayout = update.layout();
        }
        if (onExternalUpdate != null) {
            onExternalUpdate.accept(update);
        }
    }

    @Override public DungeonLayout currentLayout() { return currentLayout; }
    @Override public Long sessionMapId() { return sessionWorkflow.sessionMapId(); }
    @Override public Long activeEditSessionId() { return sessionWorkflow.activeEditSessionId(); }
    @Override public boolean editingEnabled() { return sessionWorkflow.editingEnabled(); }
}
