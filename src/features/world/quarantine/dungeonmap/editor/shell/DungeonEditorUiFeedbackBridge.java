package features.world.quarantine.dungeonmap.editor.shell;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

import java.util.Objects;

final class DungeonEditorUiFeedbackBridge implements DungeonEditorUiFeedback {

    private DungeonEditorUiFeedback delegate = new DungeonEditorUiFeedback() {
        @Override
        public void onLayoutChanged(DungeonLayout layout) {
        }

        @Override
        public void onSelectionChanged() {
        }

        @Override
        public void onStatePaneChanged() {
        }

        @Override
        public void onReloadRequested(Long preferredMapId) {
        }
    };

    void bind(DungeonEditorUiFeedback delegate) {
        this.delegate = Objects.requireNonNull(delegate, "delegate");
    }

    @Override
    public void onLayoutChanged(DungeonLayout layout) {
        delegate.onLayoutChanged(layout);
    }

    @Override
    public void onSelectionChanged() {
        delegate.onSelectionChanged();
    }

    @Override
    public void onStatePaneChanged() {
        delegate.onStatePaneChanged();
    }

    @Override
    public void onReloadRequested(Long preferredMapId) {
        delegate.onReloadRequested(preferredMapId);
    }
}
