package clean.world.hex;

import clean.world.hex.input.ComposeHexeditorInput;
import clean.world.hex.input.ComposeHextravelInput;
import clean.world.hex.state.HexState;

/**
 * Owner root seam for Hexmap world child hosts.
 */
public final class HexObject {

    public ComposeHextravelInput.HextravelInput composeHextravel(ComposeHextravelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return HexState.composeHextravel(input);
    }

    public ComposeHexeditorInput.HexeditorInput composeHexeditor(ComposeHexeditorInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return HexState.composeHexeditor(input);
    }
}
