package src.domain.encounter.model.session.model;

public final class EncounterInitiativeInput {

    private final String targetId;
    private final int initiativeScore;

    public EncounterInitiativeInput(String targetId, int initiativeScore) {
        this.targetId = targetId == null ? "" : targetId;
        this.initiativeScore = initiativeScore;
    }

    public String id() {
        return targetId;
    }

    public int initiative() {
        return initiativeScore;
    }
}
