package features.party.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadAdventuringDayPartyInput() {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public record AdventuringDayPartySummaryInput(
            List<Integer> activePartyLevels,
            int remainingToShortRest,
            int remainingToLongRest
    ) {
    }

    public record LoadedAdventuringDayPartyInput(
            Status status,
            AdventuringDayPartySummaryInput summary
    ) {
    }
}
