package features.catalog.application;

/** Complete typed input vocabulary for the Items Catalog section. */
public sealed interface ItemsCatalogIntent {

    record ChangeDraft(ItemsCatalogFilterDraft draft) implements ItemsCatalogIntent {
        public ChangeDraft {
            draft = draft == null ? ItemsCatalogFilterDraft.empty() : draft;
        }
    }

    record Search() implements ItemsCatalogIntent {
    }

    record ShiftPage(int direction) implements ItemsCatalogIntent {
    }

    record SelectItem(String sourceKey) implements ItemsCatalogIntent {
        public SelectItem {
            sourceKey = sourceKey == null ? "" : sourceKey;
        }
    }

    record OpenItem(String sourceKey) implements ItemsCatalogIntent {
        public OpenItem {
            sourceKey = sourceKey == null ? "" : sourceKey;
        }
    }

}
