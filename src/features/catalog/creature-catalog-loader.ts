import compressedCatalog from "catalog:srd-5.1-gzip";
import { CreatureCatalog, SRD_5_1_NOTICE } from "./creature-catalog";

export type CreatureCatalogDecoder = (payload: string) => Promise<unknown>;

function requiredCapability(name: string, value: unknown): void {
  if (typeof value !== "function")
    throw new Error(`Monsterkatalog nicht verfügbar: ${name} wird von diesem Obsidian-Host nicht unterstützt.`);
}

export async function decodeCompressedCreatureCatalog(payload: string): Promise<unknown> {
  requiredCapability("atob", globalThis.atob);
  requiredCapability("DecompressionStream", globalThis.DecompressionStream);
  requiredCapability("TextDecoder", globalThis.TextDecoder);
  requiredCapability("Response", globalThis.Response);
  requiredCapability("Blob", globalThis.Blob);
  try {
    const binary = globalThis.atob(payload);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const inflated = await new Response(stream).arrayBuffer();
    return JSON.parse(new TextDecoder().decode(inflated));
  } catch (error) {
    throw new Error(`Monsterkatalog konnte nicht geladen werden: ${String(error)}`);
  }
}

export class CreatureCatalogLoader {
  readonly notice = SRD_5_1_NOTICE;
  private catalog?: CreatureCatalog;
  private loading?: Promise<CreatureCatalog>;

  constructor(
    private readonly decoder: CreatureCatalogDecoder = decodeCompressedCreatureCatalog,
    private readonly payload: string = compressedCatalog,
  ) {}

  load(): Promise<CreatureCatalog> {
    if (this.catalog) return Promise.resolve(this.catalog);
    if (this.loading) return this.loading;
    const pending = this.decoder(this.payload).then((value) => new CreatureCatalog(value));
    this.loading = pending;
    void pending.then(
      (catalog) => {
        this.catalog = catalog;
        if (this.loading === pending) this.loading = undefined;
      },
      () => {
        if (this.loading === pending) this.loading = undefined;
      },
    );
    return pending;
  }
}
