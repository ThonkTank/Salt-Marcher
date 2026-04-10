package features.creatures.api;

import features.creatures.catalog.input.SearchCreaturesInput;

@SuppressWarnings("unused")
@FunctionalInterface
public interface CreatureBrowserPageLoader {
    SearchCreaturesInput.SearchedCreaturesInput load(
            SearchCreaturesInput.CriteriaInput criteria,
            SearchCreaturesInput.PageInput pageRequest);
}
