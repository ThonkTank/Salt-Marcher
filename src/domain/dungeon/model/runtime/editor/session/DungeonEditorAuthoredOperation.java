package src.domain.dungeon.model.runtime.editor.session;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleMovement;

public final class DungeonEditorAuthoredOperation {

    private final Variant variant;

    private DungeonEditorAuthoredOperation(Variant variant) {
        this.variant = Objects.requireNonNull(variant, "variant");
    }

    public Variant variant() {
        return variant;
    }

    public sealed interface Variant permits MoveEditorHandle {
    }

    public static DungeonEditorAuthoredOperation moveEditorHandle(
            DungeonEditorHandleMovement handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new DungeonEditorAuthoredOperation(new MoveEditorHandle(handle, deltaQ, deltaR, deltaLevel));
    }

    public static final class MoveEditorHandle implements Variant {
        private final DungeonEditorHandleMovement handle;
        private final int deltaQ;
        private final int deltaR;
        private final int deltaLevel;

        private MoveEditorHandle(DungeonEditorHandleMovement handle, int deltaQ, int deltaR, int deltaLevel) {
            this.handle = handle;
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
            this.deltaLevel = deltaLevel;
        }

        public DungeonEditorHandleMovement handle() {
            return handle;
        }

        public int deltaQ() {
            return deltaQ;
        }

        public int deltaR() {
            return deltaR;
        }

        public int deltaLevel() {
            return deltaLevel;
        }
    }

}
