package src.data.dungeon.repository;

import src.domain.dungeon.entity.DungeonDocument;

/**
 * Placeholder write-side adapter seam for future extraction from the domain skeleton.
 */
public final class InMemoryDungeonRepository {

    private DungeonDocument document = DungeonDocument.demo();

    public DungeonDocument load() {
        return document;
    }

    public void save(DungeonDocument nextDocument) {
        document = nextDocument == null ? DungeonDocument.demo() : nextDocument;
    }
}
