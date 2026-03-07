package features.world.hexmap.service;

import database.DatabaseManager;
import features.world.hexmap.service.adapter.HexMapCampaignStateAdapter;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Stateful session for debounced persistence of party tile updates.
 * Each UI/session owner controls lifecycle explicitly via {@link #close()}.
 */
public final class PartyPositionSession implements AutoCloseable {
    private static final Logger LOGGER = Logger.getLogger(PartyPositionSession.class.getName());
    private static final long SAVE_DEBOUNCE_MS = 300L;

    private final AtomicLong pendingPartyTileId = new AtomicLong(-1L);
    private final Consumer<Throwable> onPersistError;
    private final Object saveLock = new Object();
    private final ScheduledExecutorService saveExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "sm-save-party-pos");
        thread.setDaemon(true);
        return thread;
    });

    private ScheduledFuture<?> pendingSave;
    private boolean closed;

    public PartyPositionSession(Consumer<Throwable> onPersistError) {
        this.onPersistError = Objects.requireNonNull(onPersistError, "onPersistError");
    }

    public void scheduleUpdate(long tileId) {
        synchronized (saveLock) {
            ensureOpen();
            pendingPartyTileId.set(tileId);
            if (pendingSave != null) {
                pendingSave.cancel(false);
            }
            pendingSave = saveExecutor.schedule(this::persistLatestTile, SAVE_DEBOUNCE_MS, TimeUnit.MILLISECONDS);
        }
    }

    @Override
    public void close() {
        synchronized (saveLock) {
            if (closed) {
                return;
            }
            if (pendingSave != null) {
                pendingSave.cancel(false);
                pendingSave = null;
                persistLatestTile();
            }
            saveExecutor.shutdown();
            closed = true;
        }
    }

    private void ensureOpen() {
        if (closed) {
            throw new IllegalStateException("PartyPositionSession is closed");
        }
    }

    private void persistLatestTile() {
        long tileId = pendingPartyTileId.get();
        try (Connection conn = DatabaseManager.getConnection()) {
            HexMapCampaignStateAdapter.updatePartyTile(conn, tileId);
        } catch (SQLException e) {
            onPersistError.accept(e);
            LOGGER.log(Level.WARNING, "PartyPositionSession.persistLatestTile(): persist failed", e);
        }
    }
}
