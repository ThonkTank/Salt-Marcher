package src.domain.sessionplanner.published;

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

    record SelectSessionCommand(long sessionId) implements SessionPlannerCatalogCommand {
        public SelectSessionCommand {
            sessionId = Math.max(0L, sessionId);
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
