package src.domain.dungeoneditor.interaction.value;

import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.InteractionState;

public record DungeonEditorMainViewInterpretation(
        InteractionState nextState,
        DungeonEditorMainViewEffect effect
) {
    public DungeonEditorMainViewInterpretation {
        nextState = nextState == null ? InteractionState.empty() : nextState;
        effect = effect == null ? DungeonEditorMainViewEffect.none() : effect;
    }
}
