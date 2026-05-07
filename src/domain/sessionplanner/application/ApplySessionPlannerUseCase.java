package src.domain.sessionplanner.application;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.sessionplanner.published.ApplySessionPlannerCommand;
import src.domain.sessionplanner.published.SessionPlannerRestGapChange;
import src.domain.sessionplanner.session.value.SessionRestPlacement;

public final class ApplySessionPlannerUseCase {

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
    private final Map<ApplySessionPlannerCommand.Action, Consumer<ApplySessionPlannerCommand>> handlers =
            new EnumMap<>(ApplySessionPlannerCommand.Action.class);

    public ApplySessionPlannerUseCase(CurrentSessionPlanRuntimeAccess runtime) {
        CurrentSessionPlanRuntimeAccess effectiveRuntime = Objects.requireNonNull(runtime, "runtime");
        this.createSessionUseCase = new CreateSessionPlanUseCase(effectiveRuntime);
        this.addParticipantUseCase = new AddSessionParticipantUseCase(effectiveRuntime);
        this.removeParticipantUseCase = new RemoveSessionParticipantUseCase(effectiveRuntime);
        this.setEncounterDaysUseCase = new SetSessionEncounterDaysUseCase(effectiveRuntime);
        this.attachEncounterUseCase = new AttachSessionEncounterUseCase(effectiveRuntime);
        this.removeEncounterUseCase = new RemoveSessionEncounterUseCase(effectiveRuntime);
        this.moveEncounterUpUseCase = new MoveSessionEncounterUpUseCase(effectiveRuntime);
        this.moveEncounterDownUseCase = new MoveSessionEncounterDownUseCase(effectiveRuntime);
        this.setEncounterAllocationUseCase = new SetSessionEncounterAllocationUseCase(effectiveRuntime);
        this.selectEncounterUseCase = new SelectSessionEncounterUseCase(effectiveRuntime);
        this.setRestGapUseCase = new SetSessionRestGapUseCase(effectiveRuntime);
        this.clearRestGapUseCase = new ClearSessionRestGapUseCase(effectiveRuntime);
        this.addLootPlaceholderUseCase = new AddSessionLootPlaceholderUseCase(effectiveRuntime);
        this.removeLootPlaceholderUseCase = new RemoveSessionLootPlaceholderUseCase(effectiveRuntime);
        bindHandlers();
    }

    public void execute(ApplySessionPlannerCommand command) {
        ApplySessionPlannerCommand effective = Objects.requireNonNull(command, "command");
        handlers.getOrDefault(effective.action(), ignored -> { }).accept(effective);
    }

    private void bindHandlers() {
        handlers.put(ApplySessionPlannerCommand.Action.REFRESH_SESSION, ignored -> { });
        handlers.put(ApplySessionPlannerCommand.Action.CREATE_SESSION, ignored -> createSessionUseCase.execute());
        handlers.put(ApplySessionPlannerCommand.Action.ADD_PARTICIPANT,
                command -> addParticipantUseCase.execute(command.participant().characterId()));
        handlers.put(ApplySessionPlannerCommand.Action.REMOVE_PARTICIPANT,
                command -> removeParticipantUseCase.execute(command.participant().characterId()));
        handlers.put(ApplySessionPlannerCommand.Action.SET_ENCOUNTER_DAYS,
                command -> setEncounterDaysUseCase.execute(command.encounterDays().encounterDays()));
        handlers.put(ApplySessionPlannerCommand.Action.ATTACH_ENCOUNTER,
                command -> attachEncounterUseCase.execute(command.encounterPlan().encounterPlanId()));
        handlers.put(ApplySessionPlannerCommand.Action.REMOVE_ENCOUNTER,
                command -> removeEncounterUseCase.execute(command.encounter().encounterId()));
        handlers.put(ApplySessionPlannerCommand.Action.MOVE_ENCOUNTER_UP,
                command -> moveEncounterUpUseCase.execute(command.encounter().encounterId()));
        handlers.put(ApplySessionPlannerCommand.Action.MOVE_ENCOUNTER_DOWN,
                command -> moveEncounterDownUseCase.execute(command.encounter().encounterId()));
        handlers.put(ApplySessionPlannerCommand.Action.SET_ENCOUNTER_ALLOCATION, command -> setEncounterAllocationUseCase.execute(
                command.encounterAllocation().encounterId(),
                command.encounterAllocation().budgetPercentage()));
        handlers.put(ApplySessionPlannerCommand.Action.SELECT_ENCOUNTER,
                command -> selectEncounterUseCase.execute(command.encounter().encounterId()));
        handlers.put(ApplySessionPlannerCommand.Action.SET_REST_GAP,
                command -> setRestGapUseCase.execute(toRestPlacement(command.restGap())));
        handlers.put(ApplySessionPlannerCommand.Action.CLEAR_REST_GAP,
                command -> clearRestGapUseCase.execute(
                        command.restGapRef().leftEncounterId(),
                        command.restGapRef().rightEncounterId()));
        handlers.put(ApplySessionPlannerCommand.Action.ADD_LOOT_PLACEHOLDER,
                ignored -> addLootPlaceholderUseCase.execute());
        handlers.put(ApplySessionPlannerCommand.Action.REMOVE_LOOT_PLACEHOLDER,
                command -> removeLootPlaceholderUseCase.execute(command.loot().lootId()));
    }

    private static SessionRestPlacement toRestPlacement(SessionPlannerRestGapChange command) {
        return switch (command.restKind()) {
            case SHORT_REST -> SessionRestPlacement.shortRestBetween(command.leftEncounterId(), command.rightEncounterId());
            case LONG_REST -> SessionRestPlacement.longRestBetween(command.leftEncounterId(), command.rightEncounterId());
            case NONE -> throw new IllegalArgumentException("NONE rest kind has no placement.");
        };
    }
}
