package features.worldplanner.api;

public record UpdateWorldFactionCommand(
        long factionId,
        String displayName,
        String notes,
        long primaryEncounterTableId
) {
}
