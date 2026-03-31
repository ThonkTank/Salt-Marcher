package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
import features.world.dungeonmap.shell.interaction.DungeonSelection;
import features.world.dungeonmap.shell.interaction.DungeonSelectionDecision;

import java.util.Objects;

public final class DungeonEditorSelectionPolicy {

    public enum EditorInteractionPhase {
        PRESS,
        DRAG,
        RELEASE
    }

    public DungeonSelectionDecision select(
            EditorInteractionPhase phase,
            DungeonCanvasPointerEvent event,
            DungeonHitSnapshot snapshot
    ) {
        Objects.requireNonNull(phase, "phase");
        DungeonSelection selection = new DungeonSelection(
                Objects.requireNonNull(snapshot, "snapshot"),
                snapshot.candidates());
        if (event == null || !dispatchAllowed(phase, event)) {
            return new DungeonSelectionDecision(selection, false, false);
        }
        // Editor tools own the meaning of floor, vertex, and object hits. The shared policy
        // only gates raw input phases so new hit subjects cannot be dropped by a central allowlist.
        return new DungeonSelectionDecision(selection, true, false);
    }

    private static boolean dispatchAllowed(EditorInteractionPhase phase, DungeonCanvasPointerEvent event) {
        return switch (phase) {
            case PRESS -> event.isPrimaryButton() || event.isSecondaryButton();
            case DRAG -> event.isPrimaryButtonDown();
            case RELEASE -> true;
        };
    }
}
