package src.domain.worldplanner.published;

public record AddWorldLocationEncounterTableCommand(
        long locationId,
        long encounterTableId
) { }
