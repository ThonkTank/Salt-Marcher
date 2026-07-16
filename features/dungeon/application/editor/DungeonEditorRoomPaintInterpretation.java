package features.dungeon.application.editor;

import java.util.Objects;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PaintSession;

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
