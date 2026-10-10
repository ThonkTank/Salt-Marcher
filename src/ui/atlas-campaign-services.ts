import { CampaignLifecycle } from "../features/campaign/campaign-lifecycle";
import {
  CampaignRuntimeSource,
  CampaignRuntimeNavigationProvider,
  parseCampaignRuntimeManifest,
  type CampaignRuntimeStorage,
} from "../features/campaign/campaign-runtime-source";
import {
  campaignId,
  campaignNamespace,
  campaignContextToken,
  campaignReceiptId,
  type CampaignId,
} from "../features/campaign/campaign-contracts";
import type { CampaignOwnershipDigest } from "../features/campaign/campaign-ownership";
import type { AtlasCampaignServices } from "./atlas-campaign-host";

/** Instantiate once per host. Manifest lookups request targets; only the provider confirms authority. */
export function atlasCampaignServices(
  storage: CampaignRuntimeStorage,
  digest: CampaignOwnershipDigest,
): AtlasCampaignServices & { close(): void } {
  const source = new CampaignRuntimeSource(storage, digest);
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
