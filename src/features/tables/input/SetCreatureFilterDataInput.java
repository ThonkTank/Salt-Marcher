package features.tables.input;

import features.creatures.catalog.input.LoadFilterOptionsInput;

@SuppressWarnings("unused")
public record SetCreatureFilterDataInput(
        LoadFilterOptionsInput.LoadedFilterOptionsInput filterData
) {

    public record AppliedCreatureFilterDataInput() {
    }
}
