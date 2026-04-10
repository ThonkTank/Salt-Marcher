package features.party.input;

import java.util.List;

@SuppressWarnings("unused")
public record CalculatePartyLevelInput(List<Integer> levels) {

    public record CalculatedPartyLevelInput(int level) {
    }
}
