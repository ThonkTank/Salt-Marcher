const fs = require("node:fs");
const path = require("node:path");

const catalogues = ["verwaltung", "bau", "material", "objekte"];

function loadGroups(root = path.resolve(__dirname, "..")) {
  return catalogues.flatMap((area) => {
    const file = path.join(root, "tools/groups", `${area}.json`);
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(parsed.groups)) throw new Error(`${file}: groups must be an array`);
    return parsed.groups;
  });
}

module.exports = { loadGroups };
