package saltmarcher.buildlogic.tasks

import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import javax.xml.XMLConstants
import javax.xml.stream.XMLInputFactory
import javax.xml.stream.XMLStreamConstants
import javax.xml.stream.XMLStreamException
import javax.xml.stream.XMLStreamReader
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException

private val activeViewResourceAreas = setOf("leftbartabs", "statetabs", "dropdowns")
private val slotcontentViewResourceAreas = setOf("controls", "main", "state", "details", "topbar", "primitives")
private val scriptProcessingInstructionPattern = Regex("""<\?\s*(language|compile)\b""", RegexOption.IGNORE_CASE)
private const val fxmlNamespace = "http://javafx.com/fxml"

@CacheableTask
abstract class CheckViewFxmlResourcesTask : DefaultTask() {

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val verificationInputs: ConfigurableFileCollection

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun verify() {
        val normalizedProjectRoot = projectRoot.get().asFile.toPath().normalize().toAbsolutePath()
        val expectedRoot = normalizedProjectRoot.resolve("resources").resolve("view").normalize()
        val violations = verificationInputs.files.asSequence()
            .filter { file -> file.isFile && file.extension == "fxml" }
            .map(File::toPath)
            .map(Path::toAbsolutePath)
            .map(Path::normalize)
            .sortedBy { path -> normalizedProjectRoot.relativize(path).invariantPath() }
            .flatMap { path -> validateFxml(path, normalizedProjectRoot, expectedRoot).asSequence() }
            .toList()

        if (violations.isNotEmpty()) {
            throw VerificationException(
                "View FXML resources must live under resources/view/{leftbartabs,statetabs,dropdowns}/<entry>/ " +
                    "or resources/view/slotcontent/<slot>/<entry>/ and must not contain inline scripts.\n" +
                    "Violations:\n - ${violations.joinToString("\n - ")}"
            )
        }

        val markerFile = successMarker.get().asFile
        markerFile.parentFile.mkdirs()
        markerFile.writeText("passed\n")
    }

    private fun validateFxml(
        file: Path,
        projectRoot: Path,
        expectedRoot: Path
    ): List<String> {
        val relativePath = projectRoot.relativize(file).invariantPath()
        val viewResourceSegments = if (file.startsWith(expectedRoot)) {
            pathSegments(expectedRoot.relativize(file))
        } else {
            emptyList()
        }
        val violations = mutableListOf<String>()

        validatePlacement(file, expectedRoot, relativePath, violations)
        validateContent(file, relativePath, viewResourceSegments, violations)
        return violations
    }

    private fun validatePlacement(
        file: Path,
        expectedRoot: Path,
        relativePath: String,
        violations: MutableList<String>
    ) {
        if (!file.startsWith(expectedRoot) || file.parent == null || file.parent.fileName == null) {
            violations += "$relativePath -> expected resources/view/{leftbartabs,statetabs,dropdowns}/<entry>/*.fxml or " +
                "resources/view/slotcontent/<slot>/<entry>/*.fxml"
            return
        }
        val rootRelative = pathSegments(expectedRoot.relativize(file))
        if (!hasAllowedViewResourceRoot(rootRelative)) {
            violations += "$relativePath -> expected resources/view/{leftbartabs,statetabs,dropdowns}/<entry>/*.fxml or " +
                "resources/view/slotcontent/<slot>/<entry>/*.fxml"
        }
        if (!Files.isDirectory(file.parent)) {
            violations += "$relativePath -> parent directory is not a readable passive-view resource directory"
        }
    }

    private fun validateContent(
        file: Path,
        relativePath: String,
        viewResourceSegments: List<String>,
        violations: MutableList<String>
    ) {
        val text = try {
            Files.readString(file)
        } catch (exception: IOException) {
            violations += "$relativePath -> unable to read FXML: ${exception.message}"
            return
        }
        if (scriptProcessingInstructionPattern.containsMatchIn(text)) {
            violations += "$relativePath -> script-related FXML processing instructions are forbidden"
        }
        val metadata = parseFxmlMetadata(file, relativePath, violations) ?: return
        if (metadata.inlineScriptElementPresent) {
            violations += "$relativePath -> inline FXML script elements are forbidden"
        }
        if (metadata.scriptEventHandlerPresent) {
            violations += "$relativePath -> script-based FXML event handler attributes are forbidden"
        }
        if (metadata.nestedFxControllerPresent) {
            violations += "$relativePath -> fx:controller is allowed only on the root element"
        }
        val rootController = metadata.rootController ?: return
        val allowedPrefixes = listOf(
            "src.view.leftbartabs.",
            "src.view.statetabs.",
            "src.view.dropdowns.",
            "src.view.slotcontent."
        )
        if (allowedPrefixes.none(rootController::startsWith)) {
            violations += "$relativePath -> fx:controller must start with one of ${allowedPrefixes.joinToString(", ")}"
            return
        }
        validateControllerName(rootController, relativePath, viewResourceSegments, violations)
    }

    private fun validateControllerName(
        controller: String,
        relativePath: String,
        viewResourceSegments: List<String>,
        violations: MutableList<String>
    ) {
        val controllerSegments = controller.split('.')
        if (controllerSegments.size < 4 || controllerSegments[0] != "src" || controllerSegments[1] != "view") {
            violations += "$relativePath -> fx:controller must point to a concrete src.view passive View class"
            return
        }
        val area = controllerSegments[2]
        val simpleName = controllerSegments.last().substringBefore('$')
        val validController = when (area) {
            "slotcontent" -> controllerSegments.size == 6 &&
                simpleName.endsWith("View") &&
                !simpleName.endsWith("ViewModel")
            "leftbartabs" -> controllerSegments.size == 5 &&
                (simpleName.endsWith("ControlsView") || simpleName.endsWith("MainView") || simpleName.endsWith("StateView"))
            "dropdowns" -> controllerSegments.size == 5 && simpleName.endsWith("TopBarView")
            "statetabs" -> controllerSegments.size == 5 && simpleName.endsWith("StateView")
            else -> false
        }
        if (!validController) {
            violations += "$relativePath -> fx:controller must match its passive view area: leftbartabs use " +
                "*ControlsView/*MainView/*StateView, dropdowns use *TopBarView, statetabs use *StateView, " +
                "slotcontent uses *View"
        }
        validateControllerPathAlignment(controllerSegments, simpleName, viewResourceSegments, relativePath, violations)
    }

    private fun validateControllerPathAlignment(
        controllerSegments: List<String>,
        simpleName: String,
        viewResourceSegments: List<String>,
        relativePath: String,
        violations: MutableList<String>
    ) {
        if (!hasAllowedViewResourceRoot(viewResourceSegments)) {
            return
        }
        val fileBaseName = viewResourceSegments.last().removeSuffix(".fxml")
        if (simpleName != fileBaseName) {
            violations += "$relativePath -> fx:controller simple class '$simpleName' must match FXML file basename '$fileBaseName'"
        }

        val expectedPackageSegments = if (viewResourceSegments.first() == "slotcontent") {
            listOf("src", "view", "slotcontent", viewResourceSegments[1], viewResourceSegments[2])
        } else {
            listOf("src", "view", viewResourceSegments[0], viewResourceSegments[1])
        }
        if (controllerSegments.dropLast(1) != expectedPackageSegments) {
            violations += "$relativePath -> fx:controller package must match resource path: " +
                "${expectedPackageSegments.joinToString(".")}.$fileBaseName"
        }
    }

    private fun parseFxmlMetadata(
        file: Path,
        relativePath: String,
        violations: MutableList<String>
    ): FxmlMetadata? {
        val inputFactory = XMLInputFactory.newFactory().apply {
            setProperty(XMLInputFactory.SUPPORT_DTD, false)
            setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false)
        }
        return try {
            Files.newInputStream(file).use { input ->
                val reader = inputFactory.createXMLStreamReader(input)
                readFxmlMetadata(reader)
            }
        } catch (exception: XMLStreamException) {
            violations += "$relativePath -> invalid FXML/XML: ${exception.message ?: "parse failure"}"
            null
        } catch (exception: IOException) {
            violations += "$relativePath -> invalid FXML/XML: ${exception.message ?: "parse failure"}"
            null
        }
    }

    private fun readFxmlMetadata(reader: XMLStreamReader): FxmlMetadata {
        var rootSeen = false
        var rootController: String? = null
        var nestedFxControllerPresent = false
        var inlineScriptElementPresent = false
        var scriptEventHandlerPresent = false
        while (reader.hasNext()) {
            if (reader.next() == XMLStreamConstants.START_ELEMENT) {
                val namespaceUri = reader.namespaceURI ?: ""
                val localName = reader.localName
                if (!rootSeen) {
                    rootSeen = true
                    rootController = reader.getAttributeValue(fxmlNamespace, "controller")
                } else if (reader.getAttributeValue(fxmlNamespace, "controller") != null) {
                    nestedFxControllerPresent = true
                }
                if (localName == "script" && (namespaceUri.isBlank() || namespaceUri == fxmlNamespace)) {
                    inlineScriptElementPresent = true
                }
                if (hasScriptEventHandler(reader)) {
                    scriptEventHandlerPresent = true
                }
            }
        }
        return FxmlMetadata(
            rootController = rootController,
            nestedFxControllerPresent = nestedFxControllerPresent,
            inlineScriptElementPresent = inlineScriptElementPresent,
            scriptEventHandlerPresent = scriptEventHandlerPresent
        )
    }

    private fun hasScriptEventHandler(reader: XMLStreamReader): Boolean {
        for (index in 0 until reader.attributeCount) {
            val attributeNamespace = reader.getAttributeNamespace(index) ?: ""
            if (attributeNamespace == XMLConstants.XMLNS_ATTRIBUTE_NS_URI) {
                continue
            }
            val attributeLocalName = reader.getAttributeLocalName(index)
            if (!attributeLocalName.startsWith("on")) {
                continue
            }
            val value = reader.getAttributeValue(index)?.trim().orEmpty()
            if (value.isNotEmpty() && !value.startsWith("#") && !value.startsWith("$")) {
                return true
            }
        }
        return false
    }

    private fun hasAllowedViewResourceRoot(segments: List<String>): Boolean {
        if (segments.size < 2) {
            return false
        }
        if (segments[0] == "slotcontent") {
            return segments.size == 4 && slotcontentViewResourceAreas.contains(segments[1])
        }
        return activeViewResourceAreas.contains(segments[0]) && segments.size == 3
    }

    private fun pathSegments(path: Path): List<String> = path.map(Path::toString)

    private fun Path.invariantPath(): String = toString().replace('\\', '/')

    private data class FxmlMetadata(
        val rootController: String?,
        val nestedFxControllerPresent: Boolean,
        val inlineScriptElementPresent: Boolean,
        val scriptEventHandlerPresent: Boolean
    )
}
