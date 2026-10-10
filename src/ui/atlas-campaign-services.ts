import { CampaignLifecycle } from "../features/campaign/campaign-lifecycle";
import {
  CampaignRuntimeSource,
  CampaignRuntimeNavigationProvider,
  parseCampaignRuntimeManifest,
  type CampaignRuntimeStorage,
  type CampaignRuntimeSaveAcknowledgmentV1,
  type CampaignRuntimeSaveRollbackV1,
} from "../features/campaign/campaign-runtime-source";
import {
  campaignId,
  campaignNamespace,
  campaignContextToken,
  campaignReceiptId,
  type CampaignId,
  sameSnapshot,
} from "../features/campaign/campaign-contracts";
import type { CampaignOwnershipDigest } from "../features/campaign/campaign-ownership";
import type { AtlasCampaignServices } from "./atlas-campaign-host";
import { AtlasCampaignManifestSave } from "../features/atlas/atlas-campaign-save";
import type { CampaignRuntimeManifestSaveParticipant } from "../features/campaign/campaign-runtime-save-participant";

/** Instantiate once per host. Manifest lookups request targets; only the provider confirms authority. */
export function atlasCampaignServices(
  storage: CampaignRuntimeStorage,
  digest: CampaignOwnershipDigest,
): AtlasCampaignServices & { close(): void } {
  const issuers = new WeakMap<object, CampaignRuntimeManifestSaveParticipant>();
  const issuer = (proof: object) => {
    const participant = issuers.get(proof);
    if (!participant) throw new Error("Campaign-Receipt wurde nicht vom zuständigen Atlas-Save ausgestellt.");
    return participant;
  };
  const source = new CampaignRuntimeSource(storage, digest, {
    validateAcknowledgment: (proof: CampaignRuntimeSaveAcknowledgmentV1) => issuer(proof).validateAcknowledgment(proof),
    validateRollback: (proof: CampaignRuntimeSaveRollbackV1) => issuer(proof).validateRollback(proof),
  });
  const lifecycle = new CampaignLifecycle(source.lifecycle, {
    campaignId: () => campaignId(crypto.randomUUID()),
    namespace: () => campaignNamespace(crypto.randomUUID()),
    contextToken: () => campaignContextToken(crypto.randomUUID()),
    receiptId: () => campaignReceiptId(crypto.randomUUID()),
  });
  const provider = new CampaignRuntimeNavigationProvider(source, lifecycle);
  const retainedDrafts: { title: string; element: HTMLElement }[] = [];
  let closed = false;
  const closedListeners = new Set<() => void>();
  const assertOpen = () => {
    if (closed) throw new Error("Kampagnenanschluss ist geschlossen.");
  };
  const hints = async () => {
    assertOpen();
    const parsed = [];
    for (const file of await storage.list()) {
      try {
        parsed.push(parseCampaignRuntimeManifest(file.bytes, digest));
      } catch {
        /* the provider lists the malformed file and its actual reason */
      }
    }
    assertOpen();
    return parsed;
  };
  return {
    provider,
    assertOpen,
    subscribeClosed: (listener) => {
      closedListeners.add(listener);
      return () => {
        closedListeners.delete(listener);
      };
    },
    retainedDrafts,
    retainDraft: (draft) => {
      retainedDrafts.push(draft);
    },
    worldHint: async (id: CampaignId) => {
      const matches = (await hints()).filter(
        (m) => m.snapshot.campaignId === id,
      );
      if (matches.length !== 1)
        throw new Error("Kampagnenziel fehlt oder ist mehrdeutig.");
      return matches[0]!.atlas.worldId;
    },
    campaignHint: async (path) => {
      const all = await hints(),
        matches = all.filter((m) =>
          m.atlas.files.some((f) => f.kind === "world" && f.path === path),
        );
      if (!matches.length) {
        if ((await storage.list()).length)
          throw new Error(
            "Dieser Atlas gehört keinem bestätigten Kampagnenbestand. Bestand ergänzen oder reparieren.",
          );
        return null;
      }
      if (
        matches.length !== 1 ||
        all.filter(
          (m) => m.snapshot.campaignId === matches[0]!.snapshot.campaignId,
        ).length !== 1
      )
        throw new Error("Atlas ist mehreren Kampagnenbeständen zugeordnet.");
      return matches[0]!.snapshot.campaignId;
    },
    createSave: async (input) => {
      const guard = () => {
        assertOpen(); input.assertCurrent();
        const context = provider.currentContext();
        if (!context || !sameSnapshot(context, input.context) || context.contextToken !== input.context.contextToken)
          throw new Error("Atlas-Save besitzt keinen aktuellen Campaigncontext.");
      };
      guard();
      const matches = (await storage.list()).filter((file) => {
        try { return parseCampaignRuntimeManifest(file.bytes, digest).snapshot.campaignId === input.context.campaignId; }
        catch { return false; }
      });
      guard();
      if (matches.length !== 1) throw new Error("Atlas-Save besitzt kein eindeutiges Campaignmanifest.");
      const file = matches[0]!, manifest = parseCampaignRuntimeManifest(file.bytes, digest);
      if (!sameSnapshot(manifest.snapshot, input.context) || manifest.atlas.worldId !== input.inventory.worldId ||
          manifest.registry.registryId !== input.projection.registryId || manifest.registry.registryRevision !== input.projection.registryRevision ||
          manifest.atlas.files.length !== input.inventory.files.length || manifest.atlas.files.some((f) =>
            !input.inventory.files.some((i) => i.path === f.path && i.kind === f.kind && i.id === f.id && i.savedDigest === f.savedDigest)))
        throw new Error("Atlas-Save-Manifest passt nicht zum bestätigten Bestand.");
      return new AtlasCampaignManifestSave(file.path, file.bytes, digest, {
        basis: async () => {
          guard(); const read = await provider.registry.read(input.context); guard();
          if (read.kind !== "confirmed") throw new Error("Atlas-Save benötigt eine bestätigte Registrybasis.");
          return { context: input.context, projection: read.projection };
        },
        issued: (participant, proof) => { assertOpen(); issuers.set(proof, participant); },
        prepared: (proof) => { guard(); provider.prepareSaveAcknowledgment(proof); },
        committed: async (proof) => { await provider.acknowledgeCommittedSave(proof); guard(); },
        rolledBack: (proof) => { provider.cancelSaveAcknowledgment(proof); guard(); },
      });
    },
    close: () => {
      if (closed) return;
      closed = true;
      for (const listener of closedListeners) listener();
      closedListeners.clear();
      provider.close();
      source.close();
    },
  };
}
