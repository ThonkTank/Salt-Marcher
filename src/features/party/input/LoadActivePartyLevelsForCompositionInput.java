package features.party.input;

import java.sql.Connection;
import java.util.List;

@SuppressWarnings("unused")
public record LoadActivePartyLevelsForCompositionInput(Connection connection) {

    public record LoadedActivePartyLevelsForCompositionInput(List<Integer> levels) {
    }
}
