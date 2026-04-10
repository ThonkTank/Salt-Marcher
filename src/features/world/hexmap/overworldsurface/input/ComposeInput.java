package features.world.hexmap.overworldsurface.input;

import features.world.api.input.TravelSurfaceInput;

import java.util.Objects;

@SuppressWarnings("unused")
public record ComposeInput(TravelSurfaceInput travelSurface) {

    public ComposeInput {
        Objects.requireNonNull(travelSurface, "travelSurface");
    }
}
