package src.domain.party.published;

import src.domain.party.application.LoadAdventuringDaySummaryUseCase;

public enum RestMilestone {
    SHORT_REST_ONE,
    SHORT_REST_TWO,
    LONG_REST;

    public static RestMilestone fromInternal(LoadAdventuringDaySummaryUseCase.RestMilestone milestone) {
        if (milestone == null) {
            return LONG_REST;
        }
        return RestMilestone.valueOf(milestone.name());
    }

    public LoadAdventuringDaySummaryUseCase.RestMilestone toInternal() {
        return switch (this) {
            case SHORT_REST_ONE -> LoadAdventuringDaySummaryUseCase.RestMilestone.SHORT_REST_ONE;
            case SHORT_REST_TWO -> LoadAdventuringDaySummaryUseCase.RestMilestone.SHORT_REST_TWO;
            case LONG_REST -> LoadAdventuringDaySummaryUseCase.RestMilestone.LONG_REST;
        };
    }
}
