const DEFAULT_PCK = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
const DEFAULT_QA_PACK = "/home/aaron/.cache/dungeon-native-qa/parity-phase3-implementation-20261007/native-package/runs/20261007-025609-1253642/assets/qa-wall-pack.dungeondraft_pack";
const PCK_SHA256 = "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60";
const QA_PACK_SHA256 = "eaad533f4da8880bf8c0339d9d6ae66dd3d8e1c1d60917288ab0a91242d51ad9";

/** Local proprietary fixtures may move; content hashes remain the test identity. */
module.exports = ({ fs, crypto, assert }) => {
  const pckPath = process.env.DUNGEON_PHASE3_PCK || DEFAULT_PCK;
  const packPath = process.env.DUNGEON_PHASE3_QAWALL_PACK || DEFAULT_QA_PACK;
  const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
  const verifyPck = () => {
    assert.equal(hash(fs.readFileSync(pckPath)), PCK_SHA256);
    return pckPath;
  };
  const verifyPack = () => {
    const bytes = fs.readFileSync(packPath);
    assert.equal(hash(bytes), QA_PACK_SHA256);
    return bytes;
  };
  const load = async (page, { qaWall = true, ifMissing = false } = {}) => {
    verifyPck();
    const packBytes = qaWall ? verifyPack() : null;
    const pack = packBytes?.toString("base64") ?? null;
    await page.evaluate(async ({ pckPath, pack, ifMissing }) => {
      const plugin = app.plugins.getPlugin("dungeon-editor");
      await plugin.useNativeAssetArchive(pckPath);
      if (pack && (!ifMissing || !plugin.listAssets(["QAWall01"], true)
        .some(asset => asset.kind === "wall" && asset.name === "QA Wall"))) {
        const bytes = Uint8Array.from(atob(pack), char => char.charCodeAt(0));
        await plugin.assets.add([new Blob([bytes])]);
        await plugin.reloadAssets();
      }
    }, { pckPath, pack, ifMissing });
    return packBytes;
  };
  return { pckPath, packPath, hash, verifyPck, verifyPack, load,
    pckSha256: PCK_SHA256, packSha256: QA_PACK_SHA256 };
};
