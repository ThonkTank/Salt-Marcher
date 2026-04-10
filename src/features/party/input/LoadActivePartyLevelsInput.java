package features.party.input;

import java.sql.Connection;
import java.util.List;

@SuppressWarnings("unused")
public record LoadActivePartyLevelsInput(Connection connection) {

    public record LoadedActivePartyLevelsInput(List<Integer> levels) {
    }
}
