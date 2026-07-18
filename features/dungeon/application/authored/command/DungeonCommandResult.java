package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import java.util.Objects;

/** Typed authored-command result before persistence and publication. */
public sealed interface DungeonCommandResult {

    record Rejected(DungeonEditorCommandOutcome.RejectionReason reason) implements DungeonCommandResult {
        public Rejected {
            reason = reason == null ? DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET : reason;
        }
    }

    record Accepted(DungeonPatch patch, DungeonPatch inverse) implements DungeonCommandResult {
        public Accepted {
            patch = Objects.requireNonNull(patch, "patch");
            inverse = Objects.requireNonNull(inverse, "inverse");
            if (!patch.mapId().equals(inverse.mapId())
                    || inverse.expectedRevision() != patch.committedRevision()) {
                throw new IllegalArgumentException("inverse patch must follow the accepted forward patch");
            }
            if (!inverse.equals(patch.inverse())) {
                throw new IllegalArgumentException("accepted command must carry the exact inverse patch");
            }
        }

        public static Accepted from(DungeonPatch patch) {
            DungeonPatch safePatch = Objects.requireNonNull(patch, "patch");
            return new Accepted(safePatch, safePatch.inverse());
        }
    }
}
