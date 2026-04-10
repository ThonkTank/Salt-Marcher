package features.campaignstate.state;

import features.campaignstate.input.AdvanceDayInput;

@SuppressWarnings("unused")
public record AdvanceDayState(int days) {

    public static AdvanceDayState advanceDay(AdvanceDayInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new AdvanceDayState(input.days());
    }
}
