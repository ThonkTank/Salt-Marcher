package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import java.util.Objects;

/** Typed result for an authored command that may require or mutate multiple maps. */
public sealed interface DungeonCompoundCommandResult {

    record Rejected(DungeonEditorCommandOutcome.RejectionReason reason)
            implements DungeonCompoundCommandResult {
        public Rejected {
            reason = reason == null ? DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET : reason;
        }
    }

    record RequiresMap(long mapId) implements DungeonCompoundCommandResult {
        public RequiresMap {
            if (mapId <= 0L) {
                throw new IllegalArgumentException("required map id must be positive");
            }
        }
    }

    record Accepted(DungeonCompoundPatch patch, DungeonCompoundPatch inverse)
            implements DungeonCompoundCommandResult {
        public Accepted {
            patch = Objects.requireNonNull(patch, "patch");
            inverse = Objects.requireNonNull(inverse, "inverse");
            if (!inverse.equals(patch.inverse())) {
                throw new IllegalArgumentException("accepted compound command requires the exact inverse");
            }
        }

        public static Accepted from(DungeonCompoundPatch patch) {
            DungeonCompoundPatch safePatch = Objects.requireNonNull(patch, "patch");
            return new Accepted(safePatch, safePatch.inverse());
        }
    }
}
