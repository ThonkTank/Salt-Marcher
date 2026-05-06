package src.domain.dungeoneditor.application;

import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.InteractionState;

record DungeonEditorMainViewInterpretation(
        InteractionState nextState,
        DungeonEditorMainViewEffect effect
) {
    DungeonEditorMainViewInterpretation {
        nextState = nextState == null ? InteractionState.empty() : nextState;
        effect = effect == null ? DungeonEditorMainViewEffect.none() : effect;
    }
}
