package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.model.SessionRestPlacement;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
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
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerActionCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerParticipantCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;

public final class SessionPlannerApplicationService {

    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SessionPlannerPublishedStateRepository publishedStateRepository;
    private final CreateSessionPlanUseCase createSessionUseCase;
    private final AddSessionParticipantUseCase addParticipantUseCase;
    private final RemoveSessionParticipantUseCase removeParticipantUseCase;
    private final SetSessionEncounterDaysUseCase setEncounterDaysUseCase;
    private final AttachSessionEncounterUseCase attachEncounterUseCase;
    private final RemoveSessionEncounterUseCase removeEncounterUseCase;
    private final MoveSessionEncounterUpUseCase moveEncounterUpUseCase;
    private final MoveSessionEncounterDownUseCase moveEncounterDownUseCase;
    private final SetSessionEncounterAllocationUseCase setEncounterAllocationUseCase;
    private final SelectSessionEncounterUseCase selectEncounterUseCase;
    private final SetSessionRestGapUseCase setRestGapUseCase;
    private final ClearSessionRestGapUseCase clearRestGapUseCase;
    private final AddSessionLootPlaceholderUseCase addLootPlaceholderUseCase;
    private final RemoveSessionLootPlaceholderUseCase removeLootPlaceholderUseCase;

    public SessionPlannerApplicationService(
            SessionPlanRepository repository,
            SessionPartyFactsRepository partyFacts,
            SessionPlannerPublishedStateRepository publishedStateRepository
    ) {
        Objects.requireNonNull(repository, "repository");
        Objects.requireNonNull(partyFacts, "partyFacts");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        SeedSessionPlanUseCase seedSessionPlanUseCase = new SeedSessionPlanUseCase(partyFacts);
        this.loadCurrentSessionPlanUseCase = new LoadCurrentSessionPlanUseCase(repository, seedSessionPlanUseCase);
        SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase =
                new SaveCurrentSessionPlanUseCase(repository, loadCurrentSessionPlanUseCase);
        this.createSessionUseCase = new CreateSessionPlanUseCase(
                repository, saveCurrentSessionPlanUseCase, seedSessionPlanUseCase);
        this.addParticipantUseCase = new AddSessionParticipantUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.removeParticipantUseCase = new RemoveSessionParticipantUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.setEncounterDaysUseCase = new SetSessionEncounterDaysUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.attachEncounterUseCase = new AttachSessionEncounterUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.removeEncounterUseCase = new RemoveSessionEncounterUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.moveEncounterUpUseCase = new MoveSessionEncounterUpUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.moveEncounterDownUseCase = new MoveSessionEncounterDownUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.setEncounterAllocationUseCase = new SetSessionEncounterAllocationUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.selectEncounterUseCase = new SelectSessionEncounterUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.setRestGapUseCase = new SetSessionRestGapUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.clearRestGapUseCase = new ClearSessionRestGapUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.addLootPlaceholderUseCase = new AddSessionLootPlaceholderUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        this.removeLootPlaceholderUseCase = new RemoveSessionLootPlaceholderUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase);
        publishCurrentState();
    }

    public void createSession(SessionPlannerActionCommand command) {
        Objects.requireNonNull(command, "command");
        createSessionUseCase.execute();
        publishCurrentState();
    }

    public void addParticipant(SessionPlannerParticipantCommand command) {
        SessionPlannerParticipantCommand effective = Objects.requireNonNull(command, "command");
        addParticipantUseCase.execute(effective.characterId());
        publishCurrentState();
    }

    public void removeParticipant(SessionPlannerParticipantCommand command) {
        SessionPlannerParticipantCommand effective = Objects.requireNonNull(command, "command");
        removeParticipantUseCase.execute(effective.characterId());
        publishCurrentState();
    }

    public void setEncounterDays(SetSessionEncounterDaysCommand command) {
        SetSessionEncounterDaysCommand effective = Objects.requireNonNull(command, "command");
        setEncounterDaysUseCase.execute(effective.encounterDays());
        publishCurrentState();
    }

    public void attachEncounter(AttachSessionEncounterCommand command) {
        AttachSessionEncounterCommand effective = Objects.requireNonNull(command, "command");
        attachEncounterUseCase.execute(effective.encounterPlanId());
        publishCurrentState();
    }

    public void removeEncounter(SessionPlannerEncounterCommand command) {
        SessionPlannerEncounterCommand effective = Objects.requireNonNull(command, "command");
        removeEncounterUseCase.execute(effective.encounterId());
        publishCurrentState();
    }

    public void moveEncounterUp(SessionPlannerEncounterCommand command) {
        SessionPlannerEncounterCommand effective = Objects.requireNonNull(command, "command");
        moveEncounterUpUseCase.execute(effective.encounterId());
        publishCurrentState();
    }

    public void moveEncounterDown(SessionPlannerEncounterCommand command) {
        SessionPlannerEncounterCommand effective = Objects.requireNonNull(command, "command");
        moveEncounterDownUseCase.execute(effective.encounterId());
        publishCurrentState();
    }

    public void selectEncounter(SessionPlannerEncounterCommand command) {
        SessionPlannerEncounterCommand effective = Objects.requireNonNull(command, "command");
        selectEncounterUseCase.execute(effective.encounterId());
        publishCurrentState();
    }

    public void setEncounterAllocation(SessionPlannerEncounterAllocationCommand command) {
        SessionPlannerEncounterAllocationCommand effective = Objects.requireNonNull(command, "command");
        setEncounterAllocationUseCase.execute(
                effective.encounterId(),
                effective.budgetPercentage());
        publishCurrentState();
    }

    public void setRestGap(SetSessionRestGapCommand command) {
        SetSessionRestGapCommand effective = Objects.requireNonNull(command, "command");
        setRestGapUseCase.execute(toRestPlacement(effective));
        publishCurrentState();
    }

    public void clearRestGap(ClearSessionRestGapCommand command) {
        ClearSessionRestGapCommand effective = Objects.requireNonNull(command, "command");
        clearRestGapUseCase.execute(
                effective.leftEncounterId(),
                effective.rightEncounterId());
        publishCurrentState();
    }

    public void addLootPlaceholder(SessionPlannerActionCommand command) {
        Objects.requireNonNull(command, "command");
        addLootPlaceholderUseCase.execute();
        publishCurrentState();
    }

    public void removeLootPlaceholder(RemoveSessionLootPlaceholderCommand command) {
        RemoveSessionLootPlaceholderCommand effective = Objects.requireNonNull(command, "command");
        removeLootPlaceholderUseCase.execute(effective.lootId());
        publishCurrentState();
    }

    private void publishCurrentState() {
        publishedStateRepository.publishCurrentSession(loadCurrentSessionPlanUseCase.execute());
    }

    private static SessionRestPlacement toRestPlacement(SetSessionRestGapCommand command) {
        return switch (command.restKind()) {
            case SHORT_REST -> SessionRestPlacement.shortRestBetween(command.leftEncounterId(), command.rightEncounterId());
            case LONG_REST -> SessionRestPlacement.longRestBetween(command.leftEncounterId(), command.rightEncounterId());
            case NONE -> throw new IllegalArgumentException("NONE rest kind has no placement.");
        };
    }
}
