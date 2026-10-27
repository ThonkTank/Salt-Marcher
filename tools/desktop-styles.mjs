import { build } from 'esbuild';

/** The build and source-level layout tests consume the same local CSS entry. */
export function buildDesktopStyles({ outfile = '.build/desktop/ui/app.css', write = true } = {}) {
  return build(desktopStyleOptions({ outfile, write }));
}

export function desktopStyleOptions({ outfile = '.build/desktop/ui/app.css', write = true } = {}) {
  return {
    entryPoints: ['src/app/workspace/app.css'],
    outfile,
    bundle: true,
    write,
    metafile: true,
    logLevel: 'silent',
  };
}
