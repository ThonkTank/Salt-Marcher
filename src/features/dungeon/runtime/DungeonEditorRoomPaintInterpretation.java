package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PaintSession;

record DungeonEditorRoomPaintInterpretation(
        InteractionState nextState,
        DungeonEditorSessionEffect effect,
        PaintSession commitSession
) {
    DungeonEditorRoomPaintInterpretation {
        nextState = Objects.requireNonNull(nextState, "nextState");
        effect = Objects.requireNonNull(effect, "effect");
        commitSession = commitSession == null ? PaintSession.none() : commitSession;
    }

    static DungeonEditorRoomPaintInterpretation from(DungeonEditorMainViewInterpretation interpretation) {
        DungeonEditorMainViewInterpretation safeInterpretation =
                Objects.requireNonNull(interpretation, "interpretation");
        return new DungeonEditorRoomPaintInterpretation(
                safeInterpretation.nextState(),
                safeInterpretation.effect(),
                PaintSession.none());
    }

}
