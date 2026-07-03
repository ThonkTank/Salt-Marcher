package src.domain.worldplanner.published;

public record CreateWorldFactionCommand(
        String displayName,
        String notes,
        long primaryEncounterTableId
) { }
