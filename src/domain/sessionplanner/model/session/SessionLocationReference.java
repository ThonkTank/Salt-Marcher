package src.domain.sessionplanner.model.session;

public record SessionLocationReference(long locationId, String displayName) {

    public SessionLocationReference {
        locationId = Math.max(0L, locationId);
        displayName = displayName == null || displayName.isBlank()
                ? "Location #" + locationId
                : displayName.trim();
    }
}
