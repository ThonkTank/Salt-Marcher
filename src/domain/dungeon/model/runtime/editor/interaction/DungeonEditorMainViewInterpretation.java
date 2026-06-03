package src.domain.dungeon.model.runtime.editor.interaction;

import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.InteractionState;

public record DungeonEditorMainViewInterpretation(
        InteractionState nextState,
        DungeonEditorMainViewEffect effect
) {
    public DungeonEditorMainViewInterpretation {
        nextState = nextState == null ? InteractionState.empty() : nextState;
        effect = effect == null ? DungeonEditorMainViewEffect.none() : effect;
    }
}
