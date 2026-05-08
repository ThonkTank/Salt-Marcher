package src.domain.party.published;

import src.domain.party.application.LoadAdventuringDaySummaryUseCase;

public final class RestCadenceStatus {

    private final LoadAdventuringDaySummaryUseCase.RestCadenceStatus status;

    public RestCadenceStatus(
            Long characterId,
            RestMilestone nextMilestone,
            int xpDelta,
            RestCadenceUrgency urgency
    ) {
        this(new LoadAdventuringDaySummaryUseCase.RestCadenceStatus(
                characterId,
                nextMilestone == null
                        ? LoadAdventuringDaySummaryUseCase.RestMilestone.LONG_REST
                        : nextMilestone.toInternal(),
                xpDelta,
                urgency == null
                        ? LoadAdventuringDaySummaryUseCase.RestCadenceUrgency.NORMAL
                        : urgency.toInternal()));
    }

    public RestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadenceStatus status) {
        this.status = status == null
                ? new LoadAdventuringDaySummaryUseCase.RestCadenceStatus(
                        null,
                        LoadAdventuringDaySummaryUseCase.RestMilestone.LONG_REST,
                        0,
                        LoadAdventuringDaySummaryUseCase.RestCadenceUrgency.NORMAL)
                : status;
    }

    public static RestCadenceStatus fromInternal(LoadAdventuringDaySummaryUseCase.RestCadenceStatus status) {
        return new RestCadenceStatus(status);
    }

    public LoadAdventuringDaySummaryUseCase.RestCadenceStatus toInternal() {
        return status;
    }

    public Long characterId() {
        return status.characterId();
    }

    public RestMilestone nextMilestone() {
        return RestMilestone.fromInternal(status.nextMilestone());
    }

    public int xpDelta() {
        return status.xpDelta();
    }

    public RestCadenceUrgency urgency() {
        return RestCadenceUrgency.fromInternal(status.urgency());
    }
}
