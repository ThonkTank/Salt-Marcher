package features.creatures.ui.shared.statblock;

import features.creatures.api.CreatureCatalogService;
import features.creatures.api.StatBlockRequest;
import features.creatures.model.Creature;
import javafx.application.Platform;
import javafx.beans.value.ObservableIntegerValue;
import javafx.concurrent.Task;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Shared stat block loading helper for callers that want async fetch + cache behavior.
 */
public final class StatBlockLoader {

    // LRU cache (access-ordered LinkedHashMap, max 50 entries).
    // NOT thread-safe: all reads and writes must happen on the FX Application Thread.
    // The background Task only does the DB fetch; cache insertion happens in setOnSucceeded (FX thread).
    private static final Map<Long, Creature> creatureCache = new LinkedHashMap<>(16, 0.75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<Long, Creature> eldest) {
            return size() > 50;
        }
    };

    private StatBlockLoader() {
        throw new AssertionError("No instances");
    }

    /**
     * Loads a stat block into {@code container} asynchronously.
     * Returns {@code null} if the creature is already cached.
     */
    public static Task<CreatureCatalogService.ServiceResult<Creature>> loadAsync(Long creatureId, VBox container) {
        return loadAsync(StatBlockRequest.forCreature(creatureId), container);
    }

    /**
     * Loads a stat block into {@code container} asynchronously with optional context.
     */
    public static Task<CreatureCatalogService.ServiceResult<Creature>> loadAsync(StatBlockRequest request, VBox container) {
        return loadAsync(request, container, null);
    }

    /**
     * Loads a stat block into {@code container} asynchronously with optional mob AC input.
     */
    public static Task<CreatureCatalogService.ServiceResult<Creature>> loadAsync(
            StatBlockRequest request,
            VBox container,
            ObservableIntegerValue targetAcInput) {
        if (!Platform.isFxApplicationThread()) {
            throw new IllegalStateException("StatBlockLoader.loadAsync must be called on the FX Application Thread");
        }
        if (request == null || request.creatureId() == null) {
            throw new IllegalArgumentException("request.creatureId must not be null");
        }

        Label loading = new Label("Loading stat block...");
        loading.getStyleClass().add("stat-block-loading");
        container.getChildren().setAll(loading);

        Long creatureId = request.creatureId();
        Creature cached = creatureCache.get(creatureId);
        if (cached != null) {
            container.getChildren().setAll(new StatBlockPane(cached, request, targetAcInput));
            return null;
        }

        Task<CreatureCatalogService.ServiceResult<Creature>> task = new Task<>() {
            @Override
            protected CreatureCatalogService.ServiceResult<Creature> call() {
                return CreatureCatalogService.getCreature(creatureId);
            }
        };
        UiAsyncTasks.submit(
                task,
                result -> {
                    Creature c = result.value();
                    if (c != null) {
                        creatureCache.put(creatureId, c);
                        container.getChildren().setAll(new StatBlockPane(c, request, targetAcInput));
                    } else if (result.isOk()) {
                        container.getChildren().setAll(new Label("Creature not found."));
                    } else {
                        UiErrorReporter.reportBackgroundFailure(
                                "StatBlockLoader.loadAsync(id=" + creatureId + ")",
                                new IllegalStateException("CreatureCatalogService status: " + result.status()));
                        container.getChildren().setAll(new Label("Failed to load."));
                    }
                },
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("StatBlockLoader.loadAsync(id=" + creatureId + ")", throwable);
                    container.getChildren().setAll(new Label("Failed to load."));
                });
        return task;
    }
}
