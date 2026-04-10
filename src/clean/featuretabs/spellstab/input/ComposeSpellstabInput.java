package clean.featuretabs.spellstab.input;

import clean.shell.input.ComposeShellInput;
import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeSpellstabInput(
        Node navigationGraphic
) {

    public record SpellstabInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
