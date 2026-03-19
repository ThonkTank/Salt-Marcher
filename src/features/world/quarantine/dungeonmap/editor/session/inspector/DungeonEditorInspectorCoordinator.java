package features.world.quarantine.dungeonmap.editor.session.inspector;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;

import java.util.Objects;
import java.util.function.Supplier;

public final class DungeonEditorInspectorCoordinator {

    private final DungeonEditorInspectorPublisher inspectorPublisher;
    private final Supplier<DungeonSelection> selectedTarget;

    public DungeonEditorInspectorCoordinator(
            DungeonEditorInspectorPublisher inspectorPublisher,
            Supplier<DungeonSelection> selectedTarget
    ) {
        this.inspectorPublisher = Objects.requireNonNull(inspectorPublisher, "inspectorPublisher");
        this.selectedTarget = Objects.requireNonNull(selectedTarget, "selectedTarget");
    }

    public void publishForCurrentSelection(DungeonLayout layout) {
        DungeonSelection target = selectedTarget.get();
        if (layout == null || target == null) {
            return;
        }
        inspectorPublisher.publish(layout, target);
    }

    public void refreshIfShowing(DungeonLayout layout) {
        DungeonSelection target = selectedTarget.get();
        if (target == null || layout == null || !inspectorPublisher.isShowing(target)) {
            return;
        }
        inspectorPublisher.publish(layout, target);
    }
}
