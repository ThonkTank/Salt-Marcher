package features.items.domain.importing;

import java.util.List;

public interface PublicItemSource {

    List<ImportedItem> fetchAll();
}
