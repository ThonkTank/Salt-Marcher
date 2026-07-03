package src.domain.worldplanner;

import java.util.Objects;
import src.domain.worldplanner.model.world.usecase.AddWorldFactionNpcUseCase;
import src.domain.worldplanner.model.world.usecase.AddWorldLocationEncounterTableUseCase;
import src.domain.worldplanner.model.world.usecase.AddWorldLocationFactionUseCase;
import src.domain.worldplanner.model.world.usecase.CreateWorldFactionUseCase;
import src.domain.worldplanner.model.world.usecase.CreateWorldLocationUseCase;
import src.domain.worldplanner.model.world.usecase.CreateWorldNpcUseCase;
import src.domain.worldplanner.model.world.usecase.LoadWorldPlannerUseCase;
import src.domain.worldplanner.model.world.usecase.SetWorldFactionInventoryLimitUseCase;
import src.domain.worldplanner.model.world.usecase.SetWorldNpcLifecycleStatusUseCase;
import src.domain.worldplanner.model.world.usecase.UpdateWorldNpcNotesUseCase;
import src.domain.worldplanner.published.AddWorldFactionNpcCommand;
import src.domain.worldplanner.published.AddWorldLocationEncounterTableCommand;
import src.domain.worldplanner.published.AddWorldLocationFactionCommand;
import src.domain.worldplanner.published.CreateWorldFactionCommand;
import src.domain.worldplanner.published.CreateWorldLocationCommand;
import src.domain.worldplanner.published.CreateWorldNpcCommand;
import src.domain.worldplanner.published.RefreshWorldPlannerCommand;
import src.domain.worldplanner.published.SetWorldFactionInventoryLimitCommand;
import src.domain.worldplanner.published.SetWorldNpcLifecycleStatusCommand;
import src.domain.worldplanner.published.UpdateWorldNpcNotesCommand;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.TooManyMethods"})
public final class WorldPlannerApplicationService {

    private static final String COMMAND_PARAMETER = "command";
    private final LoadWorldPlannerUseCase loadWorldPlannerUseCase;
    private final CreateWorldNpcUseCase createNpcUseCase;
    private final UpdateWorldNpcNotesUseCase updateNpcNotesUseCase;
    private final SetWorldNpcLifecycleStatusUseCase setNpcLifecycleStatusUseCase;
    private final CreateWorldFactionUseCase createFactionUseCase;
    private final AddWorldFactionNpcUseCase addFactionNpcUseCase;
    private final SetWorldFactionInventoryLimitUseCase setFactionInventoryLimitUseCase;
    private final CreateWorldLocationUseCase createLocationUseCase;
    private final AddWorldLocationFactionUseCase addLocationFactionUseCase;
    private final AddWorldLocationEncounterTableUseCase addLocationEncounterTableUseCase;

    WorldPlannerApplicationService(Dependencies dependencies) {
        Dependencies safeDependencies = Objects.requireNonNull(dependencies, "dependencies");
        this.loadWorldPlannerUseCase =
                Objects.requireNonNull(safeDependencies.loadWorldPlannerUseCase(), "loadWorldPlannerUseCase");
        this.createNpcUseCase = Objects.requireNonNull(safeDependencies.createNpcUseCase(), "createNpcUseCase");
        this.updateNpcNotesUseCase =
                Objects.requireNonNull(safeDependencies.updateNpcNotesUseCase(), "updateNpcNotesUseCase");
        this.setNpcLifecycleStatusUseCase =
                Objects.requireNonNull(safeDependencies.setNpcLifecycleStatusUseCase(), "setNpcLifecycleStatusUseCase");
        this.createFactionUseCase =
                Objects.requireNonNull(safeDependencies.createFactionUseCase(), "createFactionUseCase");
        this.addFactionNpcUseCase =
                Objects.requireNonNull(safeDependencies.addFactionNpcUseCase(), "addFactionNpcUseCase");
        this.setFactionInventoryLimitUseCase =
                Objects.requireNonNull(
                        safeDependencies.setFactionInventoryLimitUseCase(),
                        "setFactionInventoryLimitUseCase");
        this.createLocationUseCase =
                Objects.requireNonNull(safeDependencies.createLocationUseCase(), "createLocationUseCase");
        this.addLocationFactionUseCase =
                Objects.requireNonNull(safeDependencies.addLocationFactionUseCase(), "addLocationFactionUseCase");
        this.addLocationEncounterTableUseCase =
                Objects.requireNonNull(
                        safeDependencies.addLocationEncounterTableUseCase(),
                        "addLocationEncounterTableUseCase");
    }

    public void refresh(RefreshWorldPlannerCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> loadWorldPlannerUseCase.refresh());
    }

    public void createNpc(CreateWorldNpcCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> createNpcUseCase.execute(new CreateWorldNpcUseCase.Request(
                    command.displayName(),
                    command.creatureStatblockId(),
                    command.appearanceNotes(),
                    command.behaviorNotes(),
                    command.historyNotes(),
                    command.generalNotes())));
    }

    public void updateNpcNotes(UpdateWorldNpcNotesCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> updateNpcNotesUseCase.execute(new UpdateWorldNpcNotesUseCase.Request(
                    command.npcId(),
                    command.appearanceNotes(),
                    command.behaviorNotes(),
                    command.historyNotes(),
                    command.generalNotes())));
    }

    public void setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> setNpcLifecycleStatusUseCase.execute(toLifecycleRequest(command)));
    }

    public void createFaction(CreateWorldFactionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(
                () -> createFactionUseCase.execute(
                        command.displayName(),
                        command.notes(),
                        command.primaryEncounterTableId()));
    }

    public void addFactionNpc(AddWorldFactionNpcCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> addFactionNpcUseCase.execute(command.factionId(), command.npcId()));
    }

    public void setFactionInventoryLimit(SetWorldFactionInventoryLimitCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> setFactionInventoryLimitUseCase.execute(
                    command.factionId(),
                    command.creatureStatblockId(),
                    command.finite(),
                    command.quantity()));
    }

    public void createLocation(CreateWorldLocationCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> createLocationUseCase.execute(command.displayName(), command.notes()));
    }

    public void addLocationFaction(AddWorldLocationFactionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(
                () -> addLocationFactionUseCase.execute(command.locationId(), command.factionId()));
    }

    public void addLocationEncounterTable(AddWorldLocationEncounterTableCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(
                () -> addLocationEncounterTableUseCase.execute(
                        command.locationId(),
                        command.encounterTableId()));
    }

    record Dependencies(
            LoadWorldPlannerUseCase loadWorldPlannerUseCase,
            CreateWorldNpcUseCase createNpcUseCase,
            UpdateWorldNpcNotesUseCase updateNpcNotesUseCase,
            SetWorldNpcLifecycleStatusUseCase setNpcLifecycleStatusUseCase,
            CreateWorldFactionUseCase createFactionUseCase,
            AddWorldFactionNpcUseCase addFactionNpcUseCase,
            SetWorldFactionInventoryLimitUseCase setFactionInventoryLimitUseCase,
            CreateWorldLocationUseCase createLocationUseCase,
            AddWorldLocationFactionUseCase addLocationFactionUseCase,
            AddWorldLocationEncounterTableUseCase addLocationEncounterTableUseCase
    ) { }

    private static void ignoreStorageFailure(IllegalStateException exception) {
        System.getLogger(WorldPlannerApplicationService.class.getName())
                .log(System.Logger.Level.DEBUG, "World Planner storage failure", exception);
    }

    private static void runIgnoringStorageFailure(StorageAction action) {
        try {
            action.execute();
        } catch (IllegalStateException exception) {
            ignoreStorageFailure(exception);
        }
    }

    private static SetWorldNpcLifecycleStatusUseCase.Request toLifecycleRequest(
            SetWorldNpcLifecycleStatusCommand command
    ) {
        SetWorldNpcLifecycleStatusUseCase.LifecycleStatus status = command.status() == null
                ? null
                : SetWorldNpcLifecycleStatusUseCase.LifecycleStatus.valueOf(command.status().name());
        return new SetWorldNpcLifecycleStatusUseCase.Request(
                command.npcId(),
                status,
                command.expectedCreatureStatblockId());
    }

    private interface StorageAction {
        void execute();
    }
}
