package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.model.session.usecase.AddSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.AddSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.AttachSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.ClearSessionRestGapUseCase;
import src.domain.sessionplanner.model.session.usecase.CreateSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterDownUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterUpUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.SelectSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterAllocationUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterDaysUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionRestGapUseCase;
import src.domain.sessionplanner.published.AttachSessionEncounterCommand;
import src.domain.sessionplanner.published.ClearSessionRestGapCommand;
import src.domain.sessionplanner.published.RemoveSessionLootPlaceholderCommand;
import src.domain.sessionplanner.published.SessionPlannerActionCommand;
import src.domain.sessionplanner.published.SessionPlannerCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterAllocationCommand;
import src.domain.sessionplanner.published.SessionPlannerEncounterCommand;
import src.domain.sessionplanner.published.SessionPlannerParticipantCommand;
import src.domain.sessionplanner.published.SetSessionEncounterDaysCommand;
import src.domain.sessionplanner.published.SetSessionRestGapCommand;

public final class SessionPlannerApplicationService {

    private static final String COMMAND_PARAMETER = "command";

    private final SessionUseCases sessionUseCases;
    private final ParticipantUseCases participantUseCases;
    private final EncounterUseCases encounterUseCases;
    private final RestUseCases restUseCases;
    private final LootUseCases lootUseCases;

    public SessionPlannerApplicationService(UseCases useCases) {
        UseCases requiredUseCases = Objects.requireNonNull(useCases, "useCases");
        this.sessionUseCases = requiredUseCases.sessionUseCases();
        this.participantUseCases = requiredUseCases.participantUseCases();
        this.encounterUseCases = requiredUseCases.encounterUseCases();
        this.restUseCases = requiredUseCases.restUseCases();
        this.lootUseCases = requiredUseCases.lootUseCases();
    }

    public void apply(SessionPlannerCommand command) {
        switch (requireCommand(command)) {
            case SessionPlannerActionCommand actionCommand -> applyAction(actionCommand);
            case SessionPlannerParticipantCommand participantCommand -> applyParticipant(participantCommand);
            case SetSessionEncounterDaysCommand daysCommand ->
                    encounterUseCases.setDaysUseCase().execute(daysCommand.encounterDays());
            case AttachSessionEncounterCommand attachCommand ->
                    encounterUseCases.attachUseCase().execute(attachCommand.encounterPlanId());
            case SessionPlannerEncounterCommand encounterCommand -> applyEncounter(encounterCommand);
            case SessionPlannerEncounterAllocationCommand allocationCommand ->
                    encounterUseCases.setAllocationUseCase().execute(
                            allocationCommand.encounterId(),
                            allocationCommand.budgetPercentage());
            case SetSessionRestGapCommand restCommand -> restUseCases.setUseCase().execute(
                    restCommand.leftEncounterId(),
                    restCommand.rightEncounterId(),
                    restCommand.restKind().name());
            case ClearSessionRestGapCommand clearCommand -> restUseCases.clearUseCase().execute(
                    clearCommand.leftEncounterId(),
                    clearCommand.rightEncounterId());
            case RemoveSessionLootPlaceholderCommand lootCommand ->
                    lootUseCases.removeUseCase().execute(lootCommand.lootId());
            default -> throw new IllegalArgumentException("Unsupported session planner command: " + command.getClass());
        }
    }

    private static SessionPlannerCommand requireCommand(SessionPlannerCommand command) {
        return Objects.requireNonNull(command, COMMAND_PARAMETER);
    }

    private void applyAction(SessionPlannerActionCommand command) {
        switch (command.action()) {
            case CREATE_SESSION -> sessionUseCases.createUseCase().execute();
            case ADD_LOOT_PLACEHOLDER -> lootUseCases.addUseCase().execute();
        }
    }

    private void applyParticipant(SessionPlannerParticipantCommand command) {
        switch (command.action()) {
            case ADD -> participantUseCases.addUseCase().execute(command.characterId());
            case REMOVE -> participantUseCases.removeUseCase().execute(command.characterId());
        }
    }

    private void applyEncounter(SessionPlannerEncounterCommand command) {
        switch (command.action()) {
            case SELECT -> encounterUseCases.selectUseCase().execute(command.encounterId());
            case REMOVE -> encounterUseCases.removeUseCase().execute(command.encounterId());
            case MOVE_UP -> encounterUseCases.moveUpUseCase().execute(command.encounterId());
            case MOVE_DOWN -> encounterUseCases.moveDownUseCase().execute(command.encounterId());
        }
    }

    public record UseCases(
            SessionUseCases sessionUseCases,
            ParticipantUseCases participantUseCases,
            EncounterUseCases encounterUseCases,
            RestUseCases restUseCases,
            LootUseCases lootUseCases
    ) {

        public UseCases {
            sessionUseCases = Objects.requireNonNull(sessionUseCases, "sessionUseCases");
            participantUseCases = Objects.requireNonNull(participantUseCases, "participantUseCases");
            encounterUseCases = Objects.requireNonNull(encounterUseCases, "encounterUseCases");
            restUseCases = Objects.requireNonNull(restUseCases, "restUseCases");
            lootUseCases = Objects.requireNonNull(lootUseCases, "lootUseCases");
        }
    }

    public record SessionUseCases(CreateSessionPlanUseCase createUseCase) {

        public SessionUseCases {
            createUseCase = Objects.requireNonNull(createUseCase, "createUseCase");
        }
    }

    public record ParticipantUseCases(
            AddSessionParticipantUseCase addUseCase,
            RemoveSessionParticipantUseCase removeUseCase
    ) {

        public ParticipantUseCases {
            addUseCase = Objects.requireNonNull(addUseCase, "addUseCase");
            removeUseCase = Objects.requireNonNull(removeUseCase, "removeUseCase");
        }
    }

    public record EncounterUseCases(
            SetSessionEncounterDaysUseCase setDaysUseCase,
            AttachSessionEncounterUseCase attachUseCase,
            RemoveSessionEncounterUseCase removeUseCase,
            MoveSessionEncounterUpUseCase moveUpUseCase,
            MoveSessionEncounterDownUseCase moveDownUseCase,
            SetSessionEncounterAllocationUseCase setAllocationUseCase,
            SelectSessionEncounterUseCase selectUseCase
    ) {

        public EncounterUseCases {
            setDaysUseCase = Objects.requireNonNull(setDaysUseCase, "setDaysUseCase");
            attachUseCase = Objects.requireNonNull(attachUseCase, "attachUseCase");
            removeUseCase = Objects.requireNonNull(removeUseCase, "removeUseCase");
            moveUpUseCase = Objects.requireNonNull(moveUpUseCase, "moveUpUseCase");
            moveDownUseCase = Objects.requireNonNull(moveDownUseCase, "moveDownUseCase");
            setAllocationUseCase = Objects.requireNonNull(setAllocationUseCase, "setAllocationUseCase");
            selectUseCase = Objects.requireNonNull(selectUseCase, "selectUseCase");
        }
    }

    public record RestUseCases(
            SetSessionRestGapUseCase setUseCase,
            ClearSessionRestGapUseCase clearUseCase
    ) {

        public RestUseCases {
            setUseCase = Objects.requireNonNull(setUseCase, "setUseCase");
            clearUseCase = Objects.requireNonNull(clearUseCase, "clearUseCase");
        }
    }

    public record LootUseCases(
            AddSessionLootPlaceholderUseCase addUseCase,
            RemoveSessionLootPlaceholderUseCase removeUseCase
    ) {

        public LootUseCases {
            addUseCase = Objects.requireNonNull(addUseCase, "addUseCase");
            removeUseCase = Objects.requireNonNull(removeUseCase, "removeUseCase");
        }
    }
}
