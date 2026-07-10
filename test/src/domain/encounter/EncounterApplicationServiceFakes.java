package src.domain.encounter;

public final class EncounterApplicationServiceFakes {

    private EncounterApplicationServiceFakes() {
    }

    public static EncounterApplicationService noOp() {
        return new EncounterApplicationService(
                ignored -> { },
                ignored -> { },
                ignored -> { });
    }

}
