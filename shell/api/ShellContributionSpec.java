package shell.api;

/**
 * Passive registration metadata for one shell contribution.
 */
public sealed interface ShellContributionSpec permits ShellTabSpec, ShellTopBarSpec, ShellRuntimeStateSpec {
    ContributionKey key();
}
