import type {
    CartographerMode,
    CartographerModeLifecycleContext,
} from "../presenter";

export interface CartographerModeMetadata {
    readonly id: string;
    readonly label: string;
    readonly summary: string;
    readonly keywords?: readonly string[];
    readonly order?: number;
    readonly source: string;
    readonly version?: string;
}

export interface CartographerModeProvider {
    readonly metadata: CartographerModeMetadata;
    load(): Promise<CartographerMode>;
}

type ProviderEntry = {
    readonly provider: CartographerModeProvider;
    readonly metadata: CartographerModeMetadata;
};

type RegisteredProvider = ProviderEntry & {
    readonly mode: CartographerMode;
};

export interface CartographerModeRegistryEntry {
    readonly metadata: CartographerModeMetadata;
    readonly mode: CartographerMode;
}

export type CartographerModeRegistryEvent =
    | { readonly type: "initial"; readonly entries: readonly CartographerModeRegistryEntry[] }
    | {
          readonly type: "registered";
          readonly entry: CartographerModeRegistryEntry;
          readonly index: number;
          readonly entries: readonly CartographerModeRegistryEntry[];
      }
    | {
          readonly type: "deregistered";
          readonly id: string;
          readonly entries: readonly CartographerModeRegistryEntry[];
      }
    | { readonly type: "reset"; readonly entries: readonly CartographerModeRegistryEntry[] };

type CartographerModeRegistryListener = (event: CartographerModeRegistryEvent) => void;

const providers = new Map<string, RegisteredProvider>();
const listeners = new Set<CartographerModeRegistryListener>();

const cloneMetadata = (metadata: CartographerModeMetadata): CartographerModeMetadata => {
    const keywords = metadata.keywords ? [...metadata.keywords] : undefined;
    const normalized: CartographerModeMetadata = {
        ...metadata,
        keywords,
    };
    return Object.freeze(normalized);
};

const normalizeProvider = (provider: CartographerModeProvider): ProviderEntry => {
    if (!provider?.metadata?.id) {
        throw new Error("[cartographer:mode-registry] provider metadata requires an id");
    }
    if (!provider.metadata.label) {
        throw new Error(`[` + "cartographer:mode-registry" + `] provider '${provider.metadata.id}' requires a label`);
    }
    if (!provider.metadata.summary) {
        throw new Error(`[` + "cartographer:mode-registry" + `] provider '${provider.metadata.id}' requires a summary`);
    }
    if (!provider.metadata.source) {
        throw new Error(
            `[` + "cartographer:mode-registry" + `] provider '${provider.metadata.id}' requires a source identifier`,
        );
    }

    return {
        provider: {
            ...provider,
            metadata: cloneMetadata(provider.metadata),
        },
        metadata: cloneMetadata(provider.metadata),
    } satisfies ProviderEntry;
};

const createLazyModeWrapper = (entry: ProviderEntry): CartographerMode => {
    const { metadata, provider } = entry;
    let cached: CartographerMode | null = null;
    let loading: Promise<CartographerMode> | null = null;

    const load = async (): Promise<CartographerMode> => {
        if (cached) return cached;
        if (!loading) {
            loading = provider
                .load()
                .then((mode) => {
                    if (!mode) {
                        throw new Error(
                            `[cartographer:mode-registry] provider '${metadata.id}' returned an invalid mode instance`,
                        );
                    }
                    if (mode.id && mode.id !== metadata.id) {
                        console.warn(
                            `[cartographer:mode-registry] mode id '${mode.id}' does not match provider id '${metadata.id}'`,
                        );
                    }
                    cached = mode;
                    return mode;
                })
                .catch((error) => {
                    console.error(
                        `[cartographer:mode-registry] failed to load mode '${metadata.id}' from '${metadata.source}'`,
                        error,
                    );
                    loading = null;
                    throw error;
                });
        }
        return loading;
    };

    type ModeMethodKey = {
        [K in keyof CartographerMode]: CartographerMode[K] extends (...args: any[]) => any ? K : never;
    }[keyof CartographerMode];

    type ModeMethod<K extends ModeMethodKey> = Extract<CartographerMode[K], (...args: any[]) => any>;

    const invoke = async <K extends ModeMethodKey>(
        key: K,
        ...args: Parameters<ModeMethod<K>>
    ): Promise<Awaited<ReturnType<ModeMethod<K>>>> => {
        const mode = await load();
        const method = mode[key] as ModeMethod<K>;
        return await method.apply(mode, args);
    };

    const invokeIfLoaded = async <K extends ModeMethodKey>(
        key: K,
        ...args: Parameters<ModeMethod<K>>
    ): Promise<Awaited<ReturnType<ModeMethod<K>>> | undefined> => {
        if (!cached && !loading) {
            await load();
        }
        const mode = cached;
        if (!mode) return undefined;
        const method = mode[key];
        if (typeof method !== "function") {
            return undefined;
        }
        return await (method as ModeMethod<K>).apply(mode, args);
    };

    return {
        id: metadata.id,
        label: metadata.label,
        async onEnter(ctx: CartographerModeLifecycleContext) {
            return await invoke("onEnter", ctx);
        },
        async onExit(ctx) {
            await invokeIfLoaded("onExit", ctx);
        },
        async onFileChange(file, handles, ctx) {
            return await invoke("onFileChange", file, handles, ctx);
        },
        async onHexClick(coord, event, ctx) {
            return await invokeIfLoaded("onHexClick", coord, event, ctx);
        },
        async onSave(mode, file, ctx) {
            return await invokeIfLoaded("onSave", mode, file, ctx);
        },
    } satisfies CartographerMode;
};

const createRegisteredProvider = (provider: CartographerModeProvider): RegisteredProvider => {
    const entry = normalizeProvider(provider);
    return {
        ...entry,
        mode: createLazyModeWrapper(entry),
    } satisfies RegisteredProvider;
};

const toRegistryEntry = (provider: RegisteredProvider): CartographerModeRegistryEntry => ({
    metadata: provider.metadata,
    mode: provider.mode,
});

const notifyListeners = (event: CartographerModeRegistryEvent): void => {
    const snapshot = Array.from(listeners);
    for (const listener of snapshot) {
        try {
            listener(event);
        } catch (error) {
            console.error("[cartographer:mode-registry] listener failed", error);
        }
    }
};

const orderValue = (metadata: CartographerModeMetadata): number => {
    if (metadata.order === undefined || Number.isNaN(metadata.order)) return Number.POSITIVE_INFINITY;
    return metadata.order;
};

const getSortedProviders = (): RegisteredProvider[] => {
    return Array.from(providers.values()).sort((a, b) => {
        const orderDiff = orderValue(a.metadata) - orderValue(b.metadata);
        if (orderDiff !== 0) return orderDiff;
        return a.metadata.label.localeCompare(b.metadata.label, undefined, { sensitivity: "base" });
    });
};

const getRegistryEntries = (): readonly CartographerModeRegistryEntry[] => {
    return getSortedProviders().map(toRegistryEntry);
};

export const registerCartographerModeProvider = (
    provider: CartographerModeProvider,
): (() => void) => {
    const entry = createRegisteredProvider(provider);
    const existing = providers.get(entry.metadata.id);
    if (existing) {
        throw new Error(
            `[cartographer:mode-registry] provider with id '${entry.metadata.id}' is already registered by '${existing.metadata.source}'`,
        );
    }
    providers.set(entry.metadata.id, entry);

    const entries = getRegistryEntries();
    const index = entries.findIndex((candidate) => candidate.metadata.id === entry.metadata.id);
    if (index >= 0) {
        notifyListeners({
            type: "registered",
            entry: entries[index]!,
            index,
            entries,
        });
    }

    return () => {
        const current = providers.get(entry.metadata.id);
        if (current === entry) {
            providers.delete(entry.metadata.id);
            const remaining = getRegistryEntries();
            notifyListeners({
                type: "deregistered",
                id: entry.metadata.id,
                entries: remaining,
            });
        }
    };
};

export const unregisterCartographerModeProvider = (id: string): boolean => {
    const existed = providers.delete(id);
    if (existed) {
        const remaining = getRegistryEntries();
        notifyListeners({ type: "deregistered", id, entries: remaining });
    }
    return existed;
};

export const getCartographerModeMetadataSnapshot = (): readonly CartographerModeMetadata[] => {
    return getSortedProviders().map((entry) => entry.metadata);
};

export const createCartographerModesSnapshot = (): CartographerMode[] => {
    return getSortedProviders().map((entry) => entry.mode);
};

export const clearCartographerModeRegistry = (): void => {
    if (providers.size === 0) {
        return;
    }
    providers.clear();
    notifyListeners({ type: "reset", entries: [] });
};

export const subscribeToCartographerModeRegistry = (
    listener: CartographerModeRegistryListener,
): (() => void) => {
    listeners.add(listener);
    listener({ type: "initial", entries: getRegistryEntries() });
    return () => {
        listeners.delete(listener);
    };
};
