package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsLookup;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;
import src.domain.sessionplanner.model.session.usecase.AddSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.AddSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.AttachSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.ClearSessionRestGapUseCase;
import src.domain.sessionplanner.model.session.usecase.CreateSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterDownUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterUpUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.SelectSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterAllocationUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterDaysUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionRestGapUseCase;

public final class SessionPlannerApplicationServiceFactory {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public SessionPlannerApplicationServiceFactory() {
        // Public factory bridge for data-layer runtime assembly.
    }

    public SessionPlannerApplicationService create(
            SessionPlanRepository repository,
            SessionPartyFactsLookup partyFacts,
            SessionPlannerPublishedStateRepository publishedStateRepository
    ) {
        SessionPlanRepository sessionRepository = Objects.requireNonNull(repository, "repository");
        SessionPartyFactsLookup partyFactsLookup = Objects.requireNonNull(partyFacts, "partyFacts");
        SessionPlannerPublishedStateRepository publishedState =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        SeedSessionPlanUseCase seedSessionPlanUseCase = new SeedSessionPlanUseCase(partyFactsLookup);
        LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase =
                new LoadCurrentSessionPlanUseCase(sessionRepository, seedSessionPlanUseCase);
        SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase =
                new SaveCurrentSessionPlanUseCase(sessionRepository, publishedState);
        return new SessionPlannerApplicationService(
                new CreateSessionPlanUseCase(sessionRepository, saveCurrentSessionPlanUseCase, seedSessionPlanUseCase),
                new AddSessionParticipantUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new RemoveSessionParticipantUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new SetSessionEncounterDaysUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new AttachSessionEncounterUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new RemoveSessionEncounterUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new MoveSessionEncounterUpUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new MoveSessionEncounterDownUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new SetSessionEncounterAllocationUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new SelectSessionEncounterUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new SetSessionRestGapUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new ClearSessionRestGapUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new AddSessionLootPlaceholderUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new RemoveSessionLootPlaceholderUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase));
    }
}
