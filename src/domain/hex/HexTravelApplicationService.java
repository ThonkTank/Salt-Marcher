package src.domain.hex;

import java.util.Objects;
import src.domain.hex.model.map.usecase.MoveHexPartyTokenUseCase;
import src.domain.hex.published.MoveHexPartyTokenCommand;

public final class HexTravelApplicationService {

    private final MoveHexPartyTokenUseCase movePartyTokenUseCase;

    public HexTravelApplicationService(MoveHexPartyTokenUseCase movePartyTokenUseCase) {
        this.movePartyTokenUseCase = Objects.requireNonNull(movePartyTokenUseCase, "movePartyTokenUseCase");
    }

    public void movePartyToken(MoveHexPartyTokenCommand command) {
        if (command == null) {
            return;
        }
        movePartyTokenUseCase.execute(
                command.mapId(),
                command.q(),
                command.r(),
                command.partyTokenCharacterIds());
    }
}
