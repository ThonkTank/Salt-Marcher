package features.dungeon.application.editor;

import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;

record DungeonEditorMainViewInterpretation(
        InteractionState nextState,
        DungeonEditorSessionEffect effect
) {
    DungeonEditorMainViewInterpretation {
        nextState = nextState == null ? InteractionState.empty() : nextState;
        effect = effect == null ? DungeonEditorSessionEffect.none() : effect;
    }
}
