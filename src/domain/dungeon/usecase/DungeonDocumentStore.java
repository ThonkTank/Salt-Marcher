package src.domain.dungeon.usecase;

import src.domain.dungeon.entity.DungeonDocument;

/**
 * In-memory document store used for the architecture skeleton.
 */
public final class DungeonDocumentStore {

    private DungeonDocument document;

    private DungeonDocumentStore(DungeonDocument document) {
        this.document = document;
    }

    public static DungeonDocumentStore demo() {
        return new DungeonDocumentStore(DungeonDocument.demo());
    }

    public DungeonDocument load() {
        return document;
    }

    public void save(DungeonDocument nextDocument) {
        this.document = nextDocument == null ? DungeonDocument.demo() : nextDocument;
    }
}
