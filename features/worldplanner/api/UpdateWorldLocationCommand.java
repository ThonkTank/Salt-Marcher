package features.worldplanner.api;

public record UpdateWorldLocationCommand(long locationId, String displayName, String notes) {
}
