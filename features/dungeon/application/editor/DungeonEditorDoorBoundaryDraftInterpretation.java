package features.dungeon.application.editor;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;

record DungeonEditorDoorBoundaryDraftInterpretation(
        InteractionState nextState,
        DungeonEditorSessionEffect effect,
        @Nullable DoorBoundaryCommit commit
) {
    DungeonEditorDoorBoundaryDraftInterpretation {
        nextState = nextState == null ? InteractionState.empty() : nextState;
        effect = effect == null ? DungeonEditorSessionEffect.none() : effect;
    }

    static DungeonEditorDoorBoundaryDraftInterpretation from(DungeonEditorMainViewInterpretation interpretation) {
        DungeonEditorMainViewInterpretation safeInterpretation = interpretation == null
                ? new DungeonEditorMainViewInterpretation(InteractionState.empty(), DungeonEditorSessionEffect.none())
                : interpretation;
        return new DungeonEditorDoorBoundaryDraftInterpretation(
                safeInterpretation.nextState(),
                safeInterpretation.effect(),
                null);
    }

    DungeonEditorDoorBoundaryDraftInterpretation withNextState(InteractionState replacement) {
        return new DungeonEditorDoorBoundaryDraftInterpretation(replacement, effect, commit);
    }

    record DoorBoundaryCommit(
            long clusterId,
            EdgeKey edge,
            boolean deleteMode
    ) {
    }
}
