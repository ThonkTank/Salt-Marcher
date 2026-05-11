package src.domain.dungeon.application;

import src.domain.dungeon.model.map.model.DungeonState;

final class PublishDungeonAuthoredScalarUseCase {

    private PublishDungeonAuthoredScalarUseCase() {
    }

    static int revision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }

    static String aggregateSummary(DungeonState aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }
}
