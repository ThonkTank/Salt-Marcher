package src.domain.dungeon.model.worldspace.interaction.model;

import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;

public record DungeonEditorMainViewInterpretation(
        InteractionState nextState,
        DungeonEditorMainViewEffect effect
) {
    public DungeonEditorMainViewInterpretation {
        nextState = nextState == null ? InteractionState.empty() : nextState;
        effect = effect == null ? DungeonEditorMainViewEffect.none() : effect;
    }
}
