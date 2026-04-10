package features.creatures.identity;

import features.creatures.identity.input.ResolveImportIdInput;
import features.creatures.identity.input.ResolveRecoveryIdInput;
import features.creatures.identity.input.UpsertAliasInput;
import features.creatures.repository.identity.CreatureIdentityLookupRepository;
import features.creatures.repository.identity.CreatureImportAliasRepository;
import features.creatures.repository.identity.CreatureImportIdentityRepository;

import java.sql.SQLException;

/**
 * Canonical root seam for stable creature identity resolution across import and
 * recovery workflows.
 */
@SuppressWarnings("unused")
public final class IdentityObject {

    public ResolveRecoveryIdInput.ResolvedRecoveryIdInput resolveRecoveryId(ResolveRecoveryIdInput input)
            throws SQLException {
        long localId = input.creatureId();
        if (CreatureIdentityLookupRepository.existsById(input.connection(), localId)) {
            return new ResolveRecoveryIdInput.ResolvedRecoveryIdInput(localId);
        }
        long bySlug = CreatureIdentityLookupRepository.findUniqueBySourceSlug(input.connection(), input.sourceSlug());
        if (bySlug > 0) {
            return new ResolveRecoveryIdInput.ResolvedRecoveryIdInput(bySlug);
        }
        long bySlugName = CreatureIdentityLookupRepository.findUniqueBySlugAndName(
                input.connection(),
                input.slugKey(),
                input.creatureName());
        if (bySlugName > 0) {
            return new ResolveRecoveryIdInput.ResolvedRecoveryIdInput(bySlugName);
        }
        return new ResolveRecoveryIdInput.ResolvedRecoveryIdInput(
                CreatureIdentityLookupRepository.findUniqueByName(input.connection(), input.creatureName()));
    }

    public ResolveImportIdInput.ResolvedImportIdInput resolveImportId(ResolveImportIdInput input) throws SQLException {
        Long aliasId = CreatureImportAliasRepository.findLocalIdBySourceSlug(input.connection(), input.sourceSlug());
        if (aliasId != null && aliasId > 0) {
            return new ResolveImportIdInput.ResolvedImportIdInput(aliasId, null);
        }

        long sameSource = CreatureIdentityLookupRepository.findUniqueBySourceSlug(input.connection(), input.sourceSlug());
        if (sameSource > 0) {
            return new ResolveImportIdInput.ResolvedImportIdInput(sameSource, null);
        }

        long sameSlugAndName = CreatureIdentityLookupRepository.findUniqueBySlugAndName(
                input.connection(),
                input.slugKey(),
                input.name());
        if (sameSlugAndName > 0) {
            return new ResolveImportIdInput.ResolvedImportIdInput(sameSlugAndName, null);
        }

        if (input.externalId() == null) {
            Long reassigned = CreatureImportIdentityRepository.nextAvailableId(input.connection(), input.reservedIds());
            return new ResolveImportIdInput.ResolvedImportIdInput(reassigned, "missing-external-id");
        }

        CreatureImportIdentityRepository.CreatureIdentity existingAtExternal =
                CreatureImportIdentityRepository.loadCreatureIdentity(input.connection(), input.externalId());
        if (existingAtExternal == null) {
            return new ResolveImportIdInput.ResolvedImportIdInput(input.externalId(), null);
        }

        if (identityCompatible(existingAtExternal, input.sourceSlug(), input.slugKey(), input.name())) {
            return new ResolveImportIdInput.ResolvedImportIdInput(input.externalId(), null);
        }

        Long reassigned = CreatureImportIdentityRepository.nextAvailableId(input.connection(), input.reservedIds());
        String driftReason = "external-id-conflict existing(id=" + input.externalId()
                + ",name=" + safe(existingAtExternal.name())
                + ",source_slug=" + safe(existingAtExternal.sourceSlug())
                + ",slug_key=" + safe(existingAtExternal.slugKey()) + ")";
        return new ResolveImportIdInput.ResolvedImportIdInput(reassigned, driftReason);
    }

    public void upsertAlias(UpsertAliasInput input) throws SQLException {
        CreatureImportAliasRepository.upsertAlias(
                input.connection(),
                input.sourceSlug(),
                input.slugKey(),
                input.externalId(),
                input.localId());
    }

    private boolean identityCompatible(
            CreatureImportIdentityRepository.CreatureIdentity existing,
            String sourceSlug,
            String slugKey,
            String name) {
        if (existing == null) {
            return false;
        }
        if (sourceSlug != null && sourceSlug.equals(existing.sourceSlug())) {
            return true;
        }
        if (slugKey != null && slugKey.equals(existing.slugKey())
                && name != null && name.equals(existing.name())) {
            return true;
        }
        return name != null
                && name.equals(existing.name())
                && existing.sourceSlug() == null
                && existing.slugKey() == null;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
