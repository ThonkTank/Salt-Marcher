package shell.host;

import java.util.Arrays;
import javafx.scene.transform.Affine;
import org.w3c.dom.Element;

record ShellNavigationSvgViewBox(double minX, double minY, double width, double height, double iconSize) {

    static ShellNavigationSvgViewBox from(Element root, double iconSize) {
        String value = root.getAttribute("viewBox");
        if (value == null || value.isBlank()) {
            return new ShellNavigationSvgViewBox(0.0, 0.0, iconSize, iconSize, iconSize);
        }
        double[] values = Arrays.stream(value.trim().split("[,\\s]+"))
                .filter(part -> !part.isBlank())
                .mapToDouble(Double::parseDouble)
                .toArray();
        if (values.length != 4 || values[2] <= 0.0 || values[3] <= 0.0) {
            throw new IllegalArgumentException("Unsupported SVG viewBox: " + value);
        }
        return new ShellNavigationSvgViewBox(values[0], values[1], values[2], values[3], iconSize);
    }

    Affine toIconTransform() {
        double scale = iconSize / Math.max(width, height);
        double offsetX = (iconSize - width * scale) / 2.0;
        double offsetY = (iconSize - height * scale) / 2.0;
        return new Affine(scale, 0.0, offsetX - minX * scale, 0.0, scale, offsetY - minY * scale);
    }
}
