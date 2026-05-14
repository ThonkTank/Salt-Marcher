package src.domain.encounter.application;

import java.util.Objects;
import src.domain.encounter.model.session.model.EncounterSession;
import src.domain.encounter.model.session.model.EncounterSessionCommand;

public final class ApplyEncounterSessionUseCase {

    private final EncounterSession.SessionRepository runtimeAccess;
    private final EncounterSession session = new EncounterSession();

    public ApplyEncounterSessionUseCase(EncounterSession.SessionRepository runtimeAccess) {
        this.runtimeAccess = Objects.requireNonNull(runtimeAccess, "runtimeAccess");
        session.apply(EncounterSessionCommand.refresh(), runtimeAccess);
    }

    public EncounterSession session() {
        return session;
    }

    public EncounterSession apply(EncounterSessionCommand command) {
        EncounterSessionCommand effective = command == null ? EncounterSessionCommand.refresh() : command;
        return session.apply(effective, runtimeAccess);
    }
}
