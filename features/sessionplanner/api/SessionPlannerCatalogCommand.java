package features.sessionplanner.api;

import java.util.Optional;

public sealed interface SessionPlannerCatalogCommand permits
        SessionPlannerCatalogCommand.CreateSessionCommand,
        SessionPlannerCatalogCommand.SelectSessionCommand,
        SessionPlannerCatalogCommand.RenameSessionCommand,
        SessionPlannerCatalogCommand.DeleteSessionCommand {

    record CreateSessionCommand(String displayName) implements SessionPlannerCatalogCommand {
        public CreateSessionCommand {
            displayName = displayName == null ? "" : displayName.trim();
        }
    }

    record SelectSessionCommand(
            long sessionId,
            Optional<UpdateSessionEncounterSceneCommand> pendingSceneEdit
    ) implements SessionPlannerCatalogCommand {
        public SelectSessionCommand {
            if (sessionId <= 0L) {
                throw new IllegalArgumentException("session id must be positive");
            }
            pendingSceneEdit = pendingSceneEdit == null ? Optional.empty() : pendingSceneEdit;
        }

        public SelectSessionCommand(long sessionId) {
            this(sessionId, Optional.empty());
        }
    }

    record RenameSessionCommand(long sessionId, String displayName) implements SessionPlannerCatalogCommand {
        public RenameSessionCommand {
            sessionId = Math.max(0L, sessionId);
            displayName = displayName == null ? "" : displayName.trim();
        }
    }

    record DeleteSessionCommand(long sessionId) implements SessionPlannerCatalogCommand {
        public DeleteSessionCommand {
            sessionId = Math.max(0L, sessionId);
        }
    }
}
