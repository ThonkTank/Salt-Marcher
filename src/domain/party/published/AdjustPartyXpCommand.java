package src.domain.party.published;

import java.util.List;

public record AdjustPartyXpCommand(List<Long> ids, int xpDelta) {

    public AdjustPartyXpCommand {
        ids = ids == null ? List.of() : List.copyOf(ids);
    }
}
