package src.domain.worldplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.worldplanner.model.world.WorldFaction;
import src.domain.worldplanner.model.world.WorldFactionInventoryLimit;
import src.domain.worldplanner.model.world.WorldLocation;
import src.domain.worldplanner.model.world.WorldNpc;
import src.domain.worldplanner.model.world.WorldNpcLifecycleState;
import src.domain.worldplanner.model.world.WorldPlannerIds;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;
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
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.TooManyMethods"})
public final class WorldPlannerApplicationService {

    private static final String COMMAND_PARAMETER = "command";
    private static final String LOAD_FAILURE = "World Planner konnte nicht geladen werden.";
    private static final String SAVE_FAILURE = "World Planner konnte nicht gespeichert werden.";

    private final WorldPlannerRepository repository;
    private final WorldPlannerReferencePort referenceValidator;
    private final WorldPlannerSnapshotModel snapshotModel;

    WorldPlannerApplicationService(
            WorldPlannerRepository repository,
            WorldPlannerReferencePort referenceValidator,
            WorldPlannerSnapshotModel snapshotModel
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.referenceValidator = Objects.requireNonNull(referenceValidator, "referenceValidator");
        this.snapshotModel = Objects.requireNonNull(snapshotModel, "snapshotModel");
    }

    public void refresh(RefreshWorldPlannerCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(this::load);
    }

    public void createNpc(CreateWorldNpcCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> {
            WorldPlannerState state = load();
            long statblockId = command.creatureStatblockId();
            if (!WorldPlannerIds.isPositive(statblockId) || !referenceValidator.creatureStatblockExists(statblockId)) {
                save(state.withStatus("Creature Statblock nicht gefunden."));
                return;
            }
            WorldNpc.Notes notes = new WorldNpc.Notes(
                    command.appearanceNotes(),
                    command.behaviorNotes(),
                    command.historyNotes(),
                    command.generalNotes());
            WorldNpc npc = new WorldNpc(
                    state.nextNpcId(),
                    command.displayName(),
                    statblockId,
                    notes.appearanceNotes(),
                    notes.behaviorNotes(),
                    notes.historyNotes(),
                    notes.generalNotes(),
                    WorldNpcLifecycleState.ACTIVE);
            save(new WorldPlannerState(
                    append(state.npcs(), npc),
                    state.factions(),
                    state.locations(),
                    state.nextNpcId() + 1L,
                    state.nextFactionId(),
                    state.nextLocationId(),
                    "NPC erstellt."));
        });
    }

    public void updateNpcNotes(UpdateWorldNpcNotesCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> {
            WorldPlannerState state = load();
            WorldNpc npc = state.npc(command.npcId());
            if (npc == null) {
                save(state.withStatus("NPC nicht gefunden."));
                return;
            }
            WorldNpc.Notes notes = new WorldNpc.Notes(
                    command.appearanceNotes(),
                    command.behaviorNotes(),
                    command.historyNotes(),
                    command.generalNotes());
            save(replaceNpc(state, npc.updateNotes(notes), "NPC-Notizen aktualisiert."));
        });
    }

    public void setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> {
            WorldPlannerState state = load();
            if (command.status() == null) {
                save(state.withStatus("NPC Status nicht gefunden."));
                return;
            }
            WorldNpc npc = state.npc(command.npcId());
            if (npc == null) {
                save(state.withStatus("NPC nicht gefunden."));
                return;
            }
            if (command.expectedCreatureStatblockId() > 0L
                    && command.expectedCreatureStatblockId() != npc.creatureStatblockId()) {
                save(state.withStatus("NPC passt nicht zum Encounter-Statblock."));
                return;
            }
            WorldNpc replacement = WorldNpcLifecycleState.valueOf(command.status().name()) == WorldNpcLifecycleState.DEFEATED
                    ? npc.markDefeated()
                    : npc.reactivate();
            save(replaceNpc(
                    state,
                    replacement,
                    replacement.status() == WorldNpcLifecycleState.DEFEATED
                            ? "NPC besiegt markiert."
                            : "NPC reaktiviert."));
        });
    }

    public void createFaction(CreateWorldFactionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> {
            WorldPlannerState state = load();
            long tableId = command.primaryEncounterTableId();
            if (!WorldPlannerIds.isPositive(tableId) || !referenceValidator.encounterTableExists(tableId)) {
                save(state.withStatus("Encounter Table nicht gefunden."));
                return;
            }
            WorldFaction faction = new WorldFaction(
                    state.nextFactionId(),
                    command.displayName(),
                    command.notes(),
                    tableId,
                    List.of(),
                    List.of());
            save(new WorldPlannerState(
                    state.npcs(),
                    append(state.factions(), faction),
                    state.locations(),
                    state.nextNpcId(),
                    state.nextFactionId() + 1L,
                    state.nextLocationId(),
                    "Fraktion erstellt."));
        });
    }

    public void addFactionNpc(AddWorldFactionNpcCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> {
            WorldPlannerState state = load();
            WorldFaction faction = state.faction(command.factionId());
            if (faction == null || state.npc(command.npcId()) == null) {
                save(state.withStatus("Fraktion oder NPC nicht gefunden."));
                return;
            }
            if (faction.npcIds().contains(command.npcId())) {
                save(state.withStatus("NPC ist bereits Teil der Fraktion."));
                return;
            }
            save(replaceFaction(state, faction.addNpc(command.npcId()), "NPC zur Fraktion hinzugefuegt."));
        });
    }

    public void setFactionInventoryLimit(SetWorldFactionInventoryLimitCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> {
            WorldPlannerState state = load();
            WorldFaction faction = state.faction(command.factionId());
            long statblockId = command.creatureStatblockId();
            if (faction == null
                    || !WorldPlannerIds.isPositive(statblockId)
                    || !referenceValidator.creatureStatblockExists(statblockId)) {
                save(state.withStatus("Fraktion oder Creature Statblock nicht gefunden."));
                return;
            }
            if (command.finite() && command.quantity() < 0) {
                save(state.withStatus("Fraktionsbestand ungueltig."));
                return;
            }
            WorldFactionInventoryLimit limit =
                    new WorldFactionInventoryLimit(statblockId, command.finite(), command.quantity());
            save(replaceFaction(state, faction.setInventoryLimit(limit), "Fraktionsbestand aktualisiert."));
        });
    }

    public void createLocation(CreateWorldLocationCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> {
            WorldPlannerState state = load();
            WorldLocation location =
                    new WorldLocation(state.nextLocationId(), command.displayName(), command.notes(), List.of(), List.of());
            save(new WorldPlannerState(
                    state.npcs(),
                    state.factions(),
                    append(state.locations(), location),
                    state.nextNpcId(),
                    state.nextFactionId(),
                    state.nextLocationId() + 1L,
                    "Location erstellt."));
        });
    }

    public void addLocationFaction(AddWorldLocationFactionCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> {
            WorldPlannerState state = load();
            WorldLocation location = state.location(command.locationId());
            if (location == null || state.faction(command.factionId()) == null) {
                save(state.withStatus("Location oder Fraktion nicht gefunden."));
                return;
            }
            if (location.factionIds().contains(command.factionId())) {
                save(state.withStatus("Fraktion ist bereits mit der Location verlinkt."));
                return;
            }
            save(replaceLocation(state, location.addFaction(command.factionId()), "Fraktion zur Location hinzugefuegt."));
        });
    }

    public void addLocationEncounterTable(AddWorldLocationEncounterTableCommand command) {
        Objects.requireNonNull(command, COMMAND_PARAMETER);
        runIgnoringStorageFailure(() -> {
            WorldPlannerState state = load();
            WorldLocation location = state.location(command.locationId());
            long tableId = command.encounterTableId();
            if (location == null
                    || !WorldPlannerIds.isPositive(tableId)
                    || !referenceValidator.encounterTableExists(tableId)) {
                save(state.withStatus("Location oder Encounter Table nicht gefunden."));
                return;
            }
            if (location.encounterTableIds().contains(tableId)) {
                save(state.withStatus("Encounter Table ist bereits mit der Location verlinkt."));
                return;
            }
            save(replaceLocation(state, location.addEncounterTable(tableId), "Encounter Table zur Location hinzugefuegt."));
        });
    }

    private WorldPlannerState load() {
        try {
            WorldPlannerState state = repository.load();
            snapshotModel.publish(WorldPlannerSnapshotProjection.from(state));
            return state;
        } catch (IllegalStateException exception) {
            snapshotModel.publishStorageError(LOAD_FAILURE);
            throw exception;
        }
    }

    private void save(WorldPlannerState state) {
        try {
            snapshotModel.publish(WorldPlannerSnapshotProjection.from(repository.save(state)));
        } catch (IllegalStateException exception) {
            snapshotModel.publishStorageError(SAVE_FAILURE);
            throw exception;
        }
    }

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

    private static WorldPlannerState replaceNpc(WorldPlannerState state, WorldNpc replacement, String statusText) {
        return new WorldPlannerState(
                replaceNpc(state.npcs(), replacement),
                state.factions(),
                state.locations(),
                state.nextNpcId(),
                state.nextFactionId(),
                state.nextLocationId(),
                statusText);
    }

    private static WorldPlannerState replaceFaction(
            WorldPlannerState state,
            WorldFaction replacement,
            String statusText
    ) {
        return new WorldPlannerState(
                state.npcs(),
                replaceFaction(state.factions(), replacement),
                state.locations(),
                state.nextNpcId(),
                state.nextFactionId(),
                state.nextLocationId(),
                statusText);
    }

    private static WorldPlannerState replaceLocation(
            WorldPlannerState state,
            WorldLocation replacement,
            String statusText
    ) {
        return new WorldPlannerState(
                state.npcs(),
                state.factions(),
                replaceLocation(state.locations(), replacement),
                state.nextNpcId(),
                state.nextFactionId(),
                state.nextLocationId(),
                statusText);
    }

    private static <T> List<T> append(List<T> values, T value) {
        List<T> nextValues = new ArrayList<>(values);
        nextValues.add(value);
        return nextValues;
    }

    private static List<WorldNpc> replaceNpc(List<WorldNpc> values, WorldNpc replacement) {
        List<WorldNpc> nextValues = new ArrayList<>(values);
        for (int index = 0; index < nextValues.size(); index++) {
            if (nextValues.get(index).npcId() == replacement.npcId()) {
                nextValues.set(index, replacement);
            }
        }
        return List.copyOf(nextValues);
    }

    private static List<WorldFaction> replaceFaction(List<WorldFaction> values, WorldFaction replacement) {
        List<WorldFaction> nextValues = new ArrayList<>(values);
        for (int index = 0; index < nextValues.size(); index++) {
            if (nextValues.get(index).factionId() == replacement.factionId()) {
                nextValues.set(index, replacement);
            }
        }
        return List.copyOf(nextValues);
    }

    private static List<WorldLocation> replaceLocation(List<WorldLocation> values, WorldLocation replacement) {
        List<WorldLocation> nextValues = new ArrayList<>(values);
        for (int index = 0; index < nextValues.size(); index++) {
            if (nextValues.get(index).locationId() == replacement.locationId()) {
                nextValues.set(index, replacement);
            }
        }
        return List.copyOf(nextValues);
    }

    private interface StorageAction {
        void execute();
    }
}
