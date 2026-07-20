package features.worldplanner.api;

public interface WorldPlannerApi {

    void refresh(RefreshWorldPlannerCommand command);

    void createNpc(CreateWorldNpcCommand command);

    void updateNpcNotes(UpdateWorldNpcNotesCommand command);

    void updateNpc(UpdateWorldNpcCommand command);

    void deleteNpc(DeleteWorldNpcCommand command);

    void setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand command);

    void createFaction(CreateWorldFactionCommand command);

    void addFactionNpc(AddWorldFactionNpcCommand command);

    void removeFactionNpc(RemoveWorldFactionNpcCommand command);

    void updateFaction(UpdateWorldFactionCommand command);

    void deleteFaction(DeleteWorldFactionCommand command);

    void setFactionDisposition(SetWorldFactionDispositionCommand command);

    void setFactionInventoryLimit(SetWorldFactionInventoryLimitCommand command);

    void setNpcDispositionModifier(SetWorldNpcDispositionModifierCommand command);

    void createLocation(CreateWorldLocationCommand command);

    void addLocationFaction(AddWorldLocationFactionCommand command);

    void removeLocationFaction(RemoveWorldLocationFactionCommand command);

    void addLocationEncounterTable(AddWorldLocationEncounterTableCommand command);

    void removeLocationEncounterTable(RemoveWorldLocationEncounterTableCommand command);

    void updateLocation(UpdateWorldLocationCommand command);

    void deleteLocation(DeleteWorldLocationCommand command);
}
