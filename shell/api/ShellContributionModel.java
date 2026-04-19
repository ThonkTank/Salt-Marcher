package shell.api;

/**
 * Shell-registered tab, state-tab, or top-bar model.
 */
public interface ShellContributionModel {

    ShellContributionSpec registrationSpec();

    ShellBinding bind(ShellRuntimeContext runtimeContext);
}
