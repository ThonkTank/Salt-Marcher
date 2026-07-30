export function isE2eRuntime(): boolean {
  return (
    process.env['SALT_MARCHER_E2E'] === 'true' ||
    process.argv.includes('--salt-marcher-e2e-runtime')
  )
}
