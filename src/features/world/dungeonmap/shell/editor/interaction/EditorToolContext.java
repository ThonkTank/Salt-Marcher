package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.shell.interaction.DungeonHitProbe;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.state.EditorInteractionState;

public record EditorToolContext(
        DungeonCanvasPointerEvent event,
        DungeonLayout activeMap,
        DungeonHitProbe probe,
        DungeonHitSnapshot snapshot,
        DungeonHitSubject resolvedSubject,
        DungeonSelectionRef resolvedRef,
        EditorInteractionState state
) {
    public EditorToolContext {
        activeMap = activeMap == null ? DungeonLayout.empty() : activeMap;
    }

    public EditorToolContext withResolved(DungeonHitSubject subject, DungeonSelectionRef ref) {
        return new EditorToolContext(event, activeMap, probe, snapshot, subject, ref, state);
    }

    public DungeonSelectionRef resolvedSelectionRef() {
        if (resolvedRef != null) {
            return resolvedRef;
        }
        return resolvedSubject == null ? null : resolvedSubject.ref();
    }
}
