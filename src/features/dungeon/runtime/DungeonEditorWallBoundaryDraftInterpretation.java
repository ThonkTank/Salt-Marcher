package src.features.dungeon.runtime;

import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;

record DungeonEditorWallBoundaryDraftInterpretation(
        InteractionState nextState,
        DungeonEditorSessionEffect effect,
        @Nullable WallBoundaryCommit commit
) {
    DungeonEditorWallBoundaryDraftInterpretation {
        nextState = nextState == null ? InteractionState.empty() : nextState;
        effect = effect == null ? DungeonEditorSessionEffect.none() : effect;
    }

    static DungeonEditorWallBoundaryDraftInterpretation from(DungeonEditorMainViewInterpretation interpretation) {
        DungeonEditorMainViewInterpretation safeInterpretation = interpretation == null
                ? new DungeonEditorMainViewInterpretation(InteractionState.empty(), DungeonEditorSessionEffect.none())
                : interpretation;
        return new DungeonEditorWallBoundaryDraftInterpretation(
                safeInterpretation.nextState(),
                safeInterpretation.effect(),
                null);
    }

    DungeonEditorWallBoundaryDraftInterpretation withNextState(InteractionState replacement) {
        return new DungeonEditorWallBoundaryDraftInterpretation(replacement, effect, commit);
    }

    DungeonEditorMainViewInterpretation asMainViewInterpretation() {
        return new DungeonEditorMainViewInterpretation(nextState, effect);
    }

    record WallBoundaryCommit(
            long clusterId,
            Set<EdgeKey> edges,
            boolean deleteMode
    ) {
        WallBoundaryCommit {
            edges = edges == null ? Set.of() : Set.copyOf(edges);
        }

        @Override
        public Set<EdgeKey> edges() {
            return Set.copyOf(edges);
        }
    }
}
