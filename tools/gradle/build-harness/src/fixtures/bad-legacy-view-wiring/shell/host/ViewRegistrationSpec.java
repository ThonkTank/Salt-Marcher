package shell.host;

public record ViewRegistrationSpec(
        ViewKey key,
        NavigationGroupSpec navigationGroup,
        int viewOrder,
        boolean defaultLanding
) {
}
