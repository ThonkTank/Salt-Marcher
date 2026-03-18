package features.world.dungeonmap.editor.shell.ui;

import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionReadModel;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdate;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.view.model.DungeonSelection;

import java.util.Objects;
import java.util.function.Supplier;

public final class DungeonEditorInspectorCoordinator {

    private final DungeonEditorInspectorPublisher inspectorPublisher;
    private final Supplier<DungeonSelection> selectedTarget;
    private final DungeonEditorSessionReadModel sessionReadModel;

    public DungeonEditorInspectorCoordinator(
            DungeonEditorInspectorPublisher inspectorPublisher,
            Supplier<DungeonSelection> selectedTarget,
            DungeonEditorSessionReadModel sessionReadModel
    ) {
        this.inspectorPublisher = Objects.requireNonNull(inspectorPublisher, "inspectorPublisher");
        this.selectedTarget = Objects.requireNonNull(selectedTarget, "selectedTarget");
        this.sessionReadModel = Objects.requireNonNull(sessionReadModel, "sessionReadModel");
    }

    public void onSessionUpdate(DungeonEditorSessionUpdate update) {
        switch (update.kind()) {
            case SELECTION_CHANGED -> publishForCurrentSelection(sessionReadModel.currentLayout());
            case LAYOUT_CHANGED -> refreshIfShowing(update.layout());
            default -> { }
        }
    }

    private void publishForCurrentSelection(DungeonLayout layout) {
        DungeonSelection target = selectedTarget.get();
        if (layout == null || target == null) {
            return;
        }
        inspectorPublisher.publish(layout, target);
    }

    private void refreshIfShowing(DungeonLayout layout) {
        DungeonSelection target = selectedTarget.get();
        if (target == null || layout == null) {
            return;
        }
        if (!inspectorPublisher.isShowing(target)) {
            return;
        }
        inspectorPublisher.publish(layout, target);
    }
}
