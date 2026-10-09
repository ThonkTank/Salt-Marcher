import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

export function assertCatalogPayloadLimits(inventory, limits) {
  if (inventory.gzipBytes > limits.gzipBytes)
    throw new Error(`SRD-5.1-Gzip-Payload ${inventory.gzipBytes} > ${limits.gzipBytes} Bytes.`);
  if (inventory.base64Characters > limits.base64Characters)
    throw new Error(`SRD-5.1-Base64-Payload ${inventory.base64Characters} > ${limits.base64Characters} Zeichen.`);
}

export function catalogMainJsGrowth(mainBytes, identity) {
  return mainBytes - identity.baseline.mainBytes;
}

export function catalogPayloadMainJsBytes(metafile, outputPath = "main.js") {
  const outputs = Object.entries(metafile?.outputs ?? {}).filter(
    ([path]) => path === outputPath || path.endsWith(`/${outputPath}`),
  );
  if (outputs.length !== 1)
    throw new Error(`Buildinventar enthält nicht genau ein ${outputPath}.`);
  const contribution = outputs[0][1]?.inputs?.["catalog-asset:srd-5.1-gzip"]?.bytesInOutput;
  if (!Number.isSafeInteger(contribution) || contribution < 1)
    throw new Error("Buildinventar enthält keinen emittierten SRD-5.1-Katalogpayload.");
  return contribution;
}

export function assertCatalogMainJsBudget(catalogBytes, identity) {
  if (!Number.isSafeInteger(catalogBytes) || catalogBytes < 1)
    throw new Error("Ungültiger main.js-Kataloganteil.");
  if (catalogBytes > identity.limits.mainJsGrowthBytes)
    throw new Error(
      `main.js-Kataloganteil ${catalogBytes} > ${identity.limits.mainJsGrowthBytes} Bytes.`,
    );
  return catalogBytes;
}

export async function prepareCatalogBuildAsset(identityPath = "src/features/catalog/catalog-asset.json") {
  const identity = JSON.parse(await readFile(identityPath, "utf8"));
  const bytes = await readFile(identity.source);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== identity.artifactSha256)
    throw new Error(`SRD-5.1-Quellhash abweichend: ${sha256}`);
  const gzip = gzipSync(bytes, { level: 9 });
  const base64 = gzip.toString("base64");
  assertCatalogPayloadLimits({ gzipBytes: gzip.byteLength, base64Characters: base64.length }, identity.limits);
  return {
    identity,
    payload: base64,
    inventory: {
      source: identity.source,
      sha256,
      sourceBytes: bytes.byteLength,
      gzipBytes: gzip.byteLength,
      base64Characters: base64.length,
    },
  };
}
