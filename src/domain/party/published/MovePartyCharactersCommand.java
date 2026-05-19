package src.domain.party.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record MovePartyCharactersCommand(
        List<Long> characterIds,
        @Nullable PartyTravelLocationSnapshot target,
        boolean attachToPartyToken
) {

    public MovePartyCharactersCommand {
        characterIds = characterIds == null ? List.of() : List.copyOf(characterIds);
    }
}
