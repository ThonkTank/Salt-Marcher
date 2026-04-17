package bootstrap;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.jar.JarEntry;
import java.util.jar.JarInputStream;
import java.nio.file.Files;
import java.nio.file.Path;

final class JarClassEntrySource {

    List<String> listRootClassEntries(URL resource) throws IOException {
        JarResourceLocation location = JarResourceLocation.from(resource);
        try (JarInputStream input = location.openInput()) {
            return readRootClassEntries(input, location.prefix());
        }
    }

    private List<String> readRootClassEntries(JarInputStream input, String prefix) throws IOException {
        List<String> names = new ArrayList<>();
        JarEntry entry = input.getNextJarEntry();
        while (entry != null) {
            String entryName = entry.getName();
            if (!entry.isDirectory() && entryName.startsWith(prefix) && entryName.endsWith(".class") && !entryName.contains("$")) {
                names.add(entryName.substring(prefix.length()));
            }
            entry = input.getNextJarEntry();
        }
        Collections.sort(names);
        return names;
    }

    private record JarResourceLocation(Path jarPath, String prefix) {

        private static JarResourceLocation from(URL resource) {
            String spec = resource.toExternalForm();
            int separatorIndex = spec.indexOf("!/");
            String jarUri = spec.substring("jar:".length(), separatorIndex);
            String entryName = spec.substring(separatorIndex + 2);
            String prefix = entryName.endsWith("/") ? entryName : entryName + "/";
            return new JarResourceLocation(Path.of(URI.create(jarUri)), prefix);
        }

        private JarInputStream openInput() throws IOException {
            InputStream inputStream = Files.newInputStream(jarPath);
            return new JarInputStream(inputStream);
        }
    }
}
