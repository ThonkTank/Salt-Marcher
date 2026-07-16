package features.worldplanner.api;

public interface WorldPlannerApi {

    void refresh(RefreshWorldPlannerCommand command);

    void createNpc(CreateWorldNpcCommand command);

    void updateNpcNotes(UpdateWorldNpcNotesCommand command);

    void setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand command);

    void createFaction(CreateWorldFactionCommand command);

    void addFactionNpc(AddWorldFactionNpcCommand command);

    void setFactionInventoryLimit(SetWorldFactionInventoryLimitCommand command);

    void createLocation(CreateWorldLocationCommand command);

    void addLocationFaction(AddWorldLocationFactionCommand command);

    void addLocationEncounterTable(AddWorldLocationEncounterTableCommand command);
}
