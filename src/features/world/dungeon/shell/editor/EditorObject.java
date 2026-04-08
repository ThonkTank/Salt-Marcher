package features.world.dungeon.shell.editor;

import features.world.dungeon.shell.editor.input.ComposeEditorInput;
import features.world.dungeon.shell.editor.input.ViewsInput;

import java.util.Objects;

/**
 * Public root owner object for dungeon editor surfaces.
 */
public final class EditorObject {

    private final ui.shell.AppView dungeonEditorView;

    public EditorObject(ComposeEditorInput input) {
        ComposeEditorInput resolvedInput = Objects.requireNonNull(input, "input");
        features.world.dungeon.state.EditorInteractionState interactionState =
                new features.world.dungeon.state.EditorInteractionState();
        features.world.dungeon.shell.editor.statepane.StatePaneObject statePaneObject =
                new features.world.dungeon.shell.editor.statepane.StatePaneObject(
                        new features.world.dungeon.shell.editor.statepane.input.ComposeStatePaneInput(
                                resolvedInput.mapState(),
                                resolvedInput.loadingService(),
                                resolvedInput.roomObject(),
                                interactionState));
        features.world.dungeon.shell.editor.interaction.InteractionObject interactionObject =
                new features.world.dungeon.shell.editor.interaction.InteractionObject(
                        new features.world.dungeon.shell.editor.interaction.input.ComposeInteractionInput(
                                resolvedInput.mapState(),
                                resolvedInput.loadingService(),
                                resolvedInput.sessionState(),
                                resolvedInput.mapApplicationService(),
                                resolvedInput.clusterApplicationService(),
                                resolvedInput.corridorApplicationService(),
                                resolvedInput.stairApplicationService(),
                                resolvedInput.hitCollector(),
                                interactionState,
                                statePaneObject));
        features.world.dungeon.shell.editor.interaction.state.EditorInteraction editorInteraction =
                interactionObject.editorInteraction(
                        new features.world.dungeon.shell.editor.interaction.input.EditorInteractionInput())
                        .editorInteraction();
        this.dungeonEditorView = new features.world.dungeon.shell.editor.state.DungeonEditorView(
                resolvedInput.loadingService(),
                resolvedInput.mapState(),
                resolvedInput.mapCatalogService(),
                resolvedInput.sessionState(),
                editorInteraction);
    }

    public ViewsInput views(ViewsInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new ViewsInput(dungeonEditorView);
    }
}
