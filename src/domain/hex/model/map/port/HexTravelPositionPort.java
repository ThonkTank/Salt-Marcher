package src.domain.hex.model.map.port;

import java.util.Objects;
import src.domain.hex.model.map.HexPartyTravelPositionFact;
import src.domain.hex.model.map.usecase.UpdateHexTravelPositionUseCase;

public final class HexTravelPositionPort {

    private final UpdateHexTravelPositionUseCase updateTravelPositionUseCase;

    public HexTravelPositionPort(UpdateHexTravelPositionUseCase updateTravelPositionUseCase) {
        this.updateTravelPositionUseCase = Objects.requireNonNull(
                updateTravelPositionUseCase,
                "updateTravelPositionUseCase");
    }

    public void acceptPartyTravelPosition(HexPartyTravelPositionFact fact) {
        updateTravelPositionUseCase.execute(fact);
    }
}
