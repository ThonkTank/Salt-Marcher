package shell.host;

/**
 * Feature-owned root entrypoint for shell registration.
 */
public interface ShellViewContribution {

    /**
     * Returns passive shell metadata for this contribution.
     */
    ShellContributionSpec registrationSpec();

    /**
     * Builds the feature-owned screen using the single supported shell wiring contract.
     */
    ShellScreen createScreen(ShellRuntimeContext runtimeContext);
}
