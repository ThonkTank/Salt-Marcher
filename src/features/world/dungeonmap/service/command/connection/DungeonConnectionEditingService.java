package features.world.dungeonmap.service.command.connection;

import features.world.dungeonmap.model.domain.DungeonEndpoint;
import features.world.dungeonmap.model.domain.DungeonLink;
import features.world.dungeonmap.model.domain.DungeonLinkAnchor;
import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.repository.connection.DungeonEndpointRepository;
import features.world.dungeonmap.repository.connection.DungeonLinkRepository;
import features.world.dungeonmap.repository.connection.DungeonPassageRepository;
import features.world.dungeonmap.service.command.support.DungeonEditingTransactions;
import features.world.dungeonmap.service.integration.campaign.DungeonCampaignStateAdapter;
import features.world.dungeonmap.service.support.DungeonLinkIntegrityService;
import features.world.dungeonmap.service.topology.DungeonTopologyService;

import java.sql.SQLException;
import java.util.Optional;

public final class DungeonConnectionEditingService {

    private DungeonConnectionEditingService() {
        throw new AssertionError("No instances");
    }

    public static long saveEndpoint(DungeonEndpoint endpoint) throws Exception {
        return DungeonEditingTransactions.withConnection(conn -> DungeonEndpointRepository.upsertEndpoint(conn, endpoint));
    }

    public static void deleteEndpoint(long endpointId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlVoid(conn -> {
            Optional<DungeonEndpoint> endpoint = DungeonEndpointRepository.findEndpoint(conn, endpointId);
            if (endpoint.isEmpty()) {
                return;
            }
            Long currentEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
            if (currentEndpointId != null && currentEndpointId.equals(endpointId)) {
                Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(endpoint.get().mapId());
                DungeonCampaignStateAdapter.updateDungeonPosition(conn, currentMapId, null);
            }
            DungeonLinkIntegrityService.deleteLinksTouchingAnchor(conn, DungeonLinkAnchor.endpoint(endpointId));
            DungeonEndpointRepository.deleteEndpoint(conn, endpointId);
        });
    }

    public static DungeonLinkCreateResult createLink(long mapId, DungeonLinkAnchor fromAnchor, DungeonLinkAnchor toAnchor, String label) throws Exception {
        if (fromAnchor == null || toAnchor == null) {
            return new DungeonLinkCreateResult(DungeonLinkCreateStatus.INVALID_ANCHOR, null);
        }
        if (fromAnchor.equals(toAnchor)) {
            return new DungeonLinkCreateResult(DungeonLinkCreateStatus.SAME_ANCHOR, null);
        }
        return DungeonEditingTransactions.withConnection(conn -> {
            if (!DungeonLinkIntegrityService.isValidAnchor(conn, mapId, fromAnchor)
                    || !DungeonLinkIntegrityService.isValidAnchor(conn, mapId, toAnchor)) {
                return new DungeonLinkCreateResult(DungeonLinkCreateStatus.INVALID_ANCHOR, null);
            }
            Long existing = DungeonLinkIntegrityService.findExistingLink(conn, mapId, fromAnchor, toAnchor).orElse(null);
            if (existing != null) {
                return new DungeonLinkCreateResult(DungeonLinkCreateStatus.DUPLICATE, existing);
            }
            long linkId = DungeonLinkRepository.insertLink(conn, new DungeonLink(
                    null, mapId, fromAnchor, toAnchor, label, null));
            return new DungeonLinkCreateResult(DungeonLinkCreateStatus.CREATED, linkId);
        });
    }

    public static void deleteLink(long linkId) throws Exception {
        DungeonEditingTransactions.withConnectionVoid(conn -> DungeonLinkRepository.deleteLink(conn, linkId));
    }

    public static void updateLinkLabel(long linkId, String label) throws Exception {
        DungeonEditingTransactions.withConnectionVoid(conn -> DungeonLinkRepository.updateLinkLabel(conn, linkId, label));
    }

    public static long savePassage(DungeonPassage passage) throws Exception {
        return DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntime(conn -> {
            DungeonTopologyService.validatePassageForSave(conn, passage);
            return DungeonPassageRepository.upsertPassage(conn, passage);
        });
    }

    public static void deletePassage(long passageId) throws Exception {
        DungeonEditingTransactions.withConnectionVoid(conn -> {
            DungeonLinkIntegrityService.deleteLinksTouchingAnchor(conn, DungeonLinkAnchor.passage(passageId));
            DungeonPassageRepository.deletePassage(conn, passageId);
        });
    }
}
