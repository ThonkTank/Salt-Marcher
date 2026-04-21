package shell.api;

/**
 * Classpath resource for a shell-rendered navigation graphic.
 */
public record NavigationGraphicResource(String path) {

    public NavigationGraphicResource {
        if (path == null || path.isBlank()) {
            throw new IllegalArgumentException("path must not be blank");
        }
        if (!path.startsWith("/")) {
            throw new IllegalArgumentException("path must be an absolute classpath resource");
        }
    }

    public static NavigationGraphicResource of(String path) {
        return new NavigationGraphicResource(path);
    }
}
