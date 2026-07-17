package features.dungeon.api.editor;

/** Stable result of the most recently completed authored Editor command. */
public sealed interface DungeonEditorCommandOutcome {

    static DungeonEditorCommandOutcome idle() {
        return Idle.INSTANCE;
    }

    static DungeonEditorCommandOutcome accepted(long authoredRevision) {
        return new Accepted(authoredRevision);
    }

    static DungeonEditorCommandOutcome rejected(RejectionReason reason) {
        return new Rejected(reason);
    }

    enum Idle implements DungeonEditorCommandOutcome {
        INSTANCE
    }

    record Accepted(long authoredRevision) implements DungeonEditorCommandOutcome {
        public Accepted {
            authoredRevision = Math.max(0L, authoredRevision);
        }
    }

    record Rejected(RejectionReason reason) implements DungeonEditorCommandOutcome {
        public Rejected {
            reason = reason == null ? RejectionReason.INVALID_TARGET : reason;
        }
    }

    enum RejectionReason {
        BLOCKED_ROUTE,
        PROTECTED_EXTERIOR_WALL,
        REFERENCED_CONNECTION,
        INVALID_STAIR_GEOMETRY,
        STALE_REVISION,
        MISSING_TRANSITION_DESTINATION,
        INVALID_TARGET,
        NO_EFFECT
    }
}
