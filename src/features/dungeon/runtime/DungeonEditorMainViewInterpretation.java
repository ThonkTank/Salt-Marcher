package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;

record DungeonEditorMainViewInterpretation(
        InteractionState nextState,
        DungeonEditorSessionEffect effect
) {
    DungeonEditorMainViewInterpretation {
        nextState = nextState == null ? InteractionState.empty() : nextState;
        effect = effect == null ? DungeonEditorSessionEffect.none() : effect;
    }
}
