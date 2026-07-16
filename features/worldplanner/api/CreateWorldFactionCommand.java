package features.worldplanner.api;

public record CreateWorldFactionCommand(
        String displayName,
        String notes,
        long primaryEncounterTableId
) { }
