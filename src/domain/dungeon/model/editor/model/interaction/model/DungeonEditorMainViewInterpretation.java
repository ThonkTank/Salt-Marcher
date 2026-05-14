package src.domain.dungeon.model.editor.model.interaction.model;

import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;

public record DungeonEditorMainViewInterpretation(
        InteractionState nextState,
        DungeonEditorMainViewEffect effect
) {
    public DungeonEditorMainViewInterpretation {
        nextState = nextState == null ? InteractionState.empty() : nextState;
        effect = effect == null ? DungeonEditorMainViewEffect.none() : effect;
    }
}
