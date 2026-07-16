package features.party.api;

import java.util.List;

public record AwardPartyXpCommand(List<Long> ids, int xpPerCharacter) {

    public AwardPartyXpCommand {
        ids = ids == null ? List.of() : List.copyOf(ids);
    }
}
