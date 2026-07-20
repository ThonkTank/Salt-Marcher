package features.dungeon.qualification;

import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.travel.DungeonTravelApi;
import features.dungeon.api.DungeonTravelActionId;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.port.DungeonCompoundUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonContinuationPage;
import features.dungeon.application.authored.port.DungeonContinuationPageRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonInboundReferenceRequest;
import features.dungeon.application.authored.port.DungeonInboundReferenceResult;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysResult;
import features.dungeon.application.authored.port.DungeonTravelStartRequest;
import features.dungeon.application.authored.port.DungeonTravelStartResult;
import features.dungeon.application.authored.port.DungeonUnitOfWork;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowContentRequest;
import features.dungeon.application.authored.port.DungeonWindowContentSource;
import features.dungeon.application.authored.port.DungeonWindowIndex;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import java.util.Objects;
import java.util.Optional;

/** Narrow cumulative counters around the production ports used by M5 qualification. */
public final class DungeonRuntimeWorkProbe {
    private long indexCalls;
    private long contentCalls;
    private long closureCalls;
    private long continuationCalls;
    private long unitOfWorkCalls;
    private long travelStartReads;
    private long travelChunkReads;
    private long travelRefreshes;
    private long hydratedEntities;
    private long requestedChunks;
    private long reloadedChunks;
    private long touchedChunks;

    public DungeonWindowContentSource count(DungeonWindowContentSource delegate) {
        return new CountingContentSource(Objects.requireNonNull(delegate, "delegate"));
    }

    public DungeonUnitOfWork count(DungeonUnitOfWork delegate) {
        return new CountingUnitOfWork(Objects.requireNonNull(delegate, "delegate"));
    }

    public DungeonTravelApi count(DungeonTravelApi delegate) {
        return new CountingTravelApi(Objects.requireNonNull(delegate, "delegate"));
    }

    public synchronized Snapshot snapshot() {
        return new Snapshot(indexCalls, contentCalls, closureCalls, continuationCalls,
                unitOfWorkCalls, travelStartReads, travelChunkReads, travelRefreshes,
                hydratedEntities, requestedChunks, reloadedChunks, touchedChunks);
    }

    public record Snapshot(
            long indexCalls,
            long contentCalls,
            long closureCalls,
            long continuationCalls,
            long unitOfWorkCalls,
            long travelStartReads,
            long travelChunkReads,
            long travelRefreshes,
            long hydratedEntities,
            long requestedChunks,
            long reloadedChunks,
            long touchedChunks
    ) {
        public Snapshot subtract(Snapshot before) {
            Objects.requireNonNull(before, "before");
            return new Snapshot(
                    indexCalls - before.indexCalls,
                    contentCalls - before.contentCalls,
                    closureCalls - before.closureCalls,
                    continuationCalls - before.continuationCalls,
                    unitOfWorkCalls - before.unitOfWorkCalls,
                    travelStartReads - before.travelStartReads,
                    travelChunkReads - before.travelChunkReads,
                    travelRefreshes - before.travelRefreshes,
                    hydratedEntities - before.hydratedEntities,
                    requestedChunks - before.requestedChunks,
                    reloadedChunks - before.reloadedChunks,
                    touchedChunks - before.touchedChunks);
        }

        public long repositoryCalls() {
            return indexCalls + contentCalls + closureCalls + continuationCalls
                    + unitOfWorkCalls + travelStartReads + travelChunkReads;
        }
    }

    private final class CountingContentSource implements DungeonWindowContentSource {
        private final DungeonWindowContentSource delegate;

        private CountingContentSource(DungeonWindowContentSource delegate) {
            this.delegate = delegate;
        }

        @Override
        public Optional<DungeonWindowIndex> loadIndex(DungeonWindowRequest request) {
            synchronized (DungeonRuntimeWorkProbe.this) {
                indexCalls++;
                requestedChunks += request.chunkKeys().size();
            }
            return delegate.loadIndex(request);
        }

        @Override
        public Optional<DungeonWindow> loadContent(DungeonWindowContentRequest request) {
            Optional<DungeonWindow> result = delegate.loadContent(request);
            synchronized (DungeonRuntimeWorkProbe.this) {
                contentCalls++;
                reloadedChunks += request.chunks().size();
                result.ifPresent(window -> hydratedEntities += window.fragments().size());
            }
            return result;
        }

        @Override
        public Optional<DungeonContinuationPage> loadContinuationPage(DungeonContinuationPageRequest request) {
            synchronized (DungeonRuntimeWorkProbe.this) {
                continuationCalls++;
            }
            return delegate.loadContinuationPage(request);
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            DungeonIdentityClosureResult result = delegate.loadIdentityClosure(request);
            synchronized (DungeonRuntimeWorkProbe.this) {
                closureCalls++;
                if (result instanceof DungeonIdentityClosureResult.Complete complete) {
                    hydratedEntities += complete.entities().size();
                }
            }
            return result;
        }

        @Override
        public DungeonTravelStartResult locateTravelStart(DungeonTravelStartRequest request) {
            synchronized (DungeonRuntimeWorkProbe.this) {
                travelStartReads++;
            }
            return delegate.locateTravelStart(request);
        }

        @Override
        public DungeonTravelChunkKeysResult discoverTravelChunkKeys(DungeonTravelChunkKeysRequest request) {
            DungeonTravelChunkKeysResult result = delegate.discoverTravelChunkKeys(request);
            synchronized (DungeonRuntimeWorkProbe.this) {
                travelChunkReads++;
                if (result instanceof DungeonTravelChunkKeysResult.Complete complete) {
                    requestedChunks += complete.chunkKeys().size();
                }
            }
            return result;
        }

        @Override
        public DungeonInboundReferenceResult discoverInboundReferences(DungeonInboundReferenceRequest request) {
            return delegate.discoverInboundReferences(request);
        }
    }

    private final class CountingUnitOfWork implements DungeonUnitOfWork {
        private final DungeonUnitOfWork delegate;

        private CountingUnitOfWork(DungeonUnitOfWork delegate) {
            this.delegate = delegate;
        }

        @Override
        public DungeonUnitOfWorkResult commit(DungeonPatch patch) {
            synchronized (DungeonRuntimeWorkProbe.this) {
                unitOfWorkCalls++;
                touchedChunks += patch.touchedChunks().size();
            }
            return delegate.commit(patch);
        }

        @Override
        public DungeonCompoundUnitOfWorkResult commit(DungeonCompoundPatch patch) {
            synchronized (DungeonRuntimeWorkProbe.this) {
                unitOfWorkCalls++;
                touchedChunks += patch.touchedChunks().size();
            }
            return delegate.commit(patch);
        }
    }

    private final class CountingTravelApi implements DungeonTravelApi {
        private final DungeonTravelApi delegate;

        private CountingTravelApi(DungeonTravelApi delegate) {
            this.delegate = delegate;
        }

        @Override
        public void refresh() {
            synchronized (DungeonRuntimeWorkProbe.this) {
                travelRefreshes++;
            }
            delegate.refresh();
        }

        @Override
        public void performAction(DungeonTravelActionId actionId) {
            delegate.performAction(actionId);
        }

        @Override
        public void moveTo(features.dungeon.api.DungeonCellRef target) {
            delegate.moveTo(target);
        }

        @Override
        public void selectMap(long mapId) {
            delegate.selectMap(mapId);
        }

        @Override
        public void shiftProjectionLevel(int projectionLevelShift) {
            delegate.shiftProjectionLevel(projectionLevelShift);
        }

        @Override
        public void setOverlay(DungeonOverlaySettings overlaySettings) {
            delegate.setOverlay(overlaySettings);
        }
    }
}
