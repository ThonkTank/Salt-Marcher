package src.view.leftbartabs.dungeoneditor;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;

public final class DungeonEditorContributionModel {

    private final ReadOnlyObjectWrapper<DungeonEditorControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(DungeonEditorControlsProjection.initial());
    private final ReadOnlyObjectWrapper<DungeonEditorStateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(DungeonEditorStateProjection.initial());
    private DungeonEditorProjectionSource projectionSource = DungeonEditorProjectionSource.empty();
    private DungeonEditorLocalState localState = DungeonEditorLocalState.initial();
    private DungeonEditorInteractionState interactionState = DungeonEditorInteractionState.empty();

    public DungeonEditorContributionModel() {
        refreshProjection();
    }

    public ReadOnlyObjectProperty<DungeonEditorControlsProjection> controlsProjectionProperty() {
        return controlsProjection.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<DungeonEditorStateProjection> stateProjectionProperty() {
        return stateProjection.getReadOnlyProperty();
    }

    public void apply(DungeonEditorSnapshot editorSnapshot) {
        projectionSource = DungeonEditorProjectionSource.from(editorSnapshot);
        refreshProjection();
    }

    void applyLocalMutation(DungeonEditorLocalMutation mutation) {
        if (mutation == null) {
            return;
        }
        localState = DungeonEditorLocalStateReducer.apply(localState, interactionState, mutation);
        refreshProjection();
    }

    DungeonEditorInteractionState currentInteractionState() {
        return interactionState;
    }

    private void refreshProjection() {
        DungeonEditorProjectionBundle bundle = DungeonEditorProjectionFactory.create(projectionSource, localState);
        localState = bundle.localState();
        interactionState = bundle.interactionState();
        controlsProjection.set(bundle.controlsProjection());
        stateProjection.set(bundle.stateProjection());
    }
}
