module.exports = {
  packagerConfig: {
    name: "Atlas P0",
    executableName: "saltmarcher-atlas-p0",
    asar: true,
    ignore: [
      /^\/(src|src-tauri|tests|scripts|artifacts|docs|\.git|\.github)(\/|$)/,
      /^\/(dist|out)(\/|$)/,
      /\.(md|ts|tsbuildinfo)$/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          name: "saltmarcher-atlas-p0",
          productName: "Atlas P0",
          description: "Atlas terrain feasibility study",
          homepage: "https://github.com/ThonkTank/Salt-Marcher",
          license: "UNLICENSED",
        },
      },
    },
    { name: "@electron-forge/maker-zip", platforms: ["linux"] },
  ],
};
