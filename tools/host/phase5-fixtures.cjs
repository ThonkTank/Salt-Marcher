const DEFAULT_PCK = "/home/aaron/Downloads/Dungeondraft-1.2.0.1-Linux64/Dungeondraft.pck";
const DEFAULT_COLOR_PACK = "/home/aaron/.cache/dungeon-native-qa/audit-20261004/objekte-bearbeitung/native-dd028/assets/own-object-color.dungeondraft_pack";
const PCK_SHA256 = "f5c34fad6ef77acffba0e38a65fcb091d079df65da178cbee021944f43040d60";
const COLOR_PACK_SHA256 = "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088";

/** Proprietary fixtures may move; their exact bytes identify the comparison. */
module.exports = ({ fs, crypto, assert }) => {
  const pckPath = process.env.DUNGEON_PHASE5_PCK || DEFAULT_PCK;
  const colorPackPath = process.env.DUNGEON_PHASE5_COLOR_PACK || DEFAULT_COLOR_PACK;
  const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
  const verifyPck = () => {
    assert.equal(hash(fs.readFileSync(pckPath)), PCK_SHA256,
      `PCK fixture hash mismatch: ${pckPath}`);
    return pckPath;
  };
  const verifyColorPack = () => {
    const bytes = fs.readFileSync(colorPackPath);
    assert.equal(hash(bytes), COLOR_PACK_SHA256,
      `Color pack fixture hash mismatch: ${colorPackPath}`);
    return bytes;
  };
  return { pckPath, colorPackPath, verifyPck, verifyColorPack,
    pckSha256: PCK_SHA256, colorPackSha256: COLOR_PACK_SHA256 };
};
