package clean.creatures.statblock.input;

import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.shell.input.ComposeShellInput;

@SuppressWarnings("unused")
public record ComposeStatblockInput(
        ComposeCatalogInput.CatalogInput catalog
) {

    public record ShowCreatureStatblockInput(
            Long creatureId,
            Integer mobCount
    ) {
    }

    public record StatblockInput(
            java.util.function.Consumer<ComposeShellInput.ShellHooksInput> onShellReady,
            java.util.function.Consumer<ShowCreatureStatblockInput> showCreatureStatblock
    ) {
    }
}
