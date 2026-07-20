package features.worldplanner.api;

public record AddWorldLocationEncounterTableCommand(
        long locationId,
        long encounterTableId
) { }
