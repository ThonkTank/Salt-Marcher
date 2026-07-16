package features.sessionplanner.domain.session;

public final class SessionPartyMemberProfile {

    private final long characterId;
    private final String displayName;
    private final int currentLevel;

    public SessionPartyMemberProfile(long characterId, String displayName, int currentLevel) {
        this.characterId = Math.max(0L, characterId);
        this.displayName = displayName == null ? "" : displayName.trim();
        this.currentLevel = Math.max(0, currentLevel);
    }

    public long characterId() {
        return characterId;
    }

    public String displayName() {
        return displayName;
    }

    public int currentLevel() {
        return currentLevel;
    }
}
