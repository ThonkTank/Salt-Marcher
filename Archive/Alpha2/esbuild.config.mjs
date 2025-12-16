import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Parse arguments
const args = process.argv.slice(2);
const prod = args.includes('production');
const pluginArg = args.find(a => a.startsWith('--plugin='));
const plugin = pluginArg ? pluginArg.split('=')[1] : 'legacy';

// Plugin configurations
const PLUGINS = {
    // Legacy: Original salt-marcher plugin (for backwards compatibility)
    legacy: {
        entryPoint: 'src/main.ts',
        outDir: '/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher',
        manifestPath: 'manifest.json',
    },
    // Core: SaltMarcherCore plugin
    core: {
        entryPoint: 'SaltMarcherCore/main.ts',
        outDir: '/home/aaron/ObsVaults/DnD/.obsidian/plugins/salt-marcher-core',
        manifestPath: 'SaltMarcherCore/manifest.json',
    },
};

const config = PLUGINS[plugin];
if (!config) {
    console.error(`Unknown plugin: ${plugin}`);
    console.error(`Available plugins: ${Object.keys(PLUGINS).join(', ')}`);
    process.exit(1);
}

console.log(`Building plugin: ${plugin}`);
console.log(`Entry: ${config.entryPoint}`);
console.log(`Output: ${config.outDir}`);

// Ensure output directory exists
if (!existsSync(config.outDir)) {
    mkdirSync(config.outDir, { recursive: true });
}

const context = await esbuild.context({
    entryPoints: [config.entryPoint],
    bundle: true,
    external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
    format: 'cjs',
    target: 'es2022',
    logLevel: 'info',
    sourcemap: prod ? false : 'inline',
    treeShaking: true,
    outfile: join(config.outDir, 'main.js'),
});

if (prod) {
    await context.rebuild();
    // Copy manifest
    copyFileSync(config.manifestPath, join(config.outDir, 'manifest.json'));
    console.log('Build complete. Output:', config.outDir);
    process.exit(0);
} else {
    // Watch mode
    await context.watch();
    // Copy manifest
    copyFileSync(config.manifestPath, join(config.outDir, 'manifest.json'));
    console.log('Watching for changes...');
}
