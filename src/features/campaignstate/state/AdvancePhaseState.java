package features.campaignstate.state;

import features.campaignstate.input.AdvancePhaseInput;

@SuppressWarnings("unused")
public record AdvancePhaseState() {

    public static AdvancePhaseState advancePhase(AdvancePhaseInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new AdvancePhaseState();
    }
}
