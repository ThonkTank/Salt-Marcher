package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.work.DisableCachingByDefault
import java.io.File
import java.nio.file.Files
import java.nio.file.Path

@DisableCachingByDefault(because = "Verification task with no stable outputs.")
abstract class CheckViewFxmlResourcesTask : DefaultTask() {

    @get:Internal
    abstract val projectRoot: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val fxmlFiles: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val resourcesRoot: DirectoryProperty

    @TaskAction
    fun checkFxmlResources() {
        val projectRootPath = projectRoot.get().asFile.toPath().normalize()
        val resourcesRootPath = resourcesRoot.get().asFile.toPath().normalize()
        val expectedRoot = resourcesRootPath.resolve("view").normalize()
        val violations = mutableListOf<String>()

        fxmlFiles.files.asSequence()
            .filter(File::isFile)
            .filter { file -> file.extension == "fxml" }
            .forEach { file ->
                val path = file.toPath().normalize()
                val relative = projectRootPath.relativize(path).toString().replace('\\', '/')
                val viewResourceSegments = if (path.startsWith(expectedRoot)) {
                    expectedRoot.relativize(path).pathSegments()
                } else {
                    emptyList()
                }
                validatePlacement(path.toFile(), expectedRoot.toFile(), path.startsWith(expectedRoot), relative, violations)
                validateContent(file, relative, viewResourceSegments, violations)
            }

        if (violations.isNotEmpty()) {
            throw GradleException(
                "View FXML resources must live under resources/view/{leftbartabs,statetabs,dropdowns}/<entry>/ " +
                    "or resources/view/slotcontent/<slot>/<entry>/ and must not contain inline scripts.\n" +
                    "Violations:\n" + violations.sorted().joinToString(separator = "\n") { " - $it" }
            )
        }
    }

    private fun validatePlacement(
        file: File,
        expectedRoot: File,
        underExpectedRoot: Boolean,
        relative: String,
        violations: MutableList<String>
    ) {
        val path = file.toPath().normalize()
        if (!underExpectedRoot || path.parent == null || path.parent.fileName == null) {
            violations.add("$relative -> expected resources/view/{leftbartabs,statetabs,dropdowns}/<entry>/*.fxml or resources/view/slotcontent/<slot>/<entry>/*.fxml")
            return
        }
        val rootRelative = expectedRoot.toPath().normalize().relativize(path)
        if (!hasAllowedViewResourceRoot(rootRelative.map { it.toString() })) {
            violations.add("$relative -> expected resources/view/{leftbartabs,statetabs,dropdowns}/<entry>/*.fxml or resources/view/slotcontent/<slot>/<entry>/*.fxml")
        }
        if (!Files.isDirectory(path.parent)) {
            violations.add("$relative -> parent directory is not a readable passive-view resource directory")
        }
    }

    private fun validateContent(
        file: File,
        relative: String,
        viewResourceSegments: List<String>,
        violations: MutableList<String>
    ) {
        val text = file.readText()
        if (text.contains("<fx:script") || text.contains("<script")) {
            violations.add("$relative -> inline FXML scripts are forbidden")
        }
        val controllerMatch = FX_CONTROLLER_PATTERN.find(text) ?: return
        val controller = controllerMatch.groupValues[1]
        val allowedPrefixes = listOf(
            "src.view.leftbartabs.",
            "src.view.statetabs.",
            "src.view.dropdowns.",
            "src.view.slotcontent."
        )
        if (allowedPrefixes.none(controller::startsWith)) {
            violations.add("$relative -> fx:controller must start with one of ${allowedPrefixes.joinToString()}")
            return
        }
        validateControllerName(controller, relative, viewResourceSegments, violations)
    }

    private fun validateControllerName(
        controller: String,
        relative: String,
        viewResourceSegments: List<String>,
        violations: MutableList<String>
    ) {
        val controllerSegments = controller.split('.')
        if (controllerSegments.size < 4 || controllerSegments[0] != "src" || controllerSegments[1] != "view") {
            violations.add("$relative -> fx:controller must point to a concrete src.view passive View class")
            return
        }
        val area = controllerSegments[2]
        val simpleName = controllerSegments.last().substringBefore('$')
        val validController = when (area) {
            "slotcontent" -> controllerSegments.size == 6 &&
                simpleName.endsWith("View") && !simpleName.endsWith("ViewModel")
            "leftbartabs" -> controllerSegments.size == 5 &&
                listOf("ControlsView", "MainView", "StateView").any(simpleName::endsWith)
            "dropdowns" -> controllerSegments.size == 5 && simpleName.endsWith("TopBarView")
            "statetabs" -> controllerSegments.size == 5 && simpleName.endsWith("StateView")
            else -> false
        }
        if (!validController) {
            violations.add(
                "$relative -> fx:controller must match its passive view area: " +
                    "leftbartabs use *ControlsView/*MainView/*StateView, dropdowns use *TopBarView, " +
                    "statetabs use *StateView, slotcontent uses *View"
            )
        }
        validateControllerPathAlignment(controllerSegments, simpleName, viewResourceSegments, relative, violations)
    }

    private fun validateControllerPathAlignment(
        controllerSegments: List<String>,
        simpleName: String,
        viewResourceSegments: List<String>,
        relative: String,
        violations: MutableList<String>
    ) {
        if (!hasAllowedViewResourceRoot(viewResourceSegments)) {
            return
        }
        val fileBaseName = viewResourceSegments.last().removeSuffix(".fxml")
        if (simpleName != fileBaseName) {
            violations.add(
                "$relative -> fx:controller simple class '$simpleName' must match FXML file basename '$fileBaseName'"
            )
        }

        val expectedPackageSegments = if (viewResourceSegments.first() == "slotcontent") {
            listOf("src", "view", "slotcontent", viewResourceSegments[1], viewResourceSegments[2])
        } else {
            listOf("src", "view", viewResourceSegments[0], viewResourceSegments[1])
        }
        if (controllerSegments.dropLast(1) != expectedPackageSegments) {
            violations.add(
                "$relative -> fx:controller package must match resource path: " +
                    "${expectedPackageSegments.joinToString(".")}.$fileBaseName"
            )
        }
    }

    private companion object {
        private val ACTIVE_RESOURCE_AREAS = setOf("leftbartabs", "statetabs", "dropdowns")
        private val SLOTCONTENT_RESOURCE_AREAS = setOf("controls", "main", "state", "details", "topbar")
        private val FX_CONTROLLER_PATTERN = Regex("fx:controller\\s*=\\s*\"([^\"]+)\"")

        private fun hasAllowedViewResourceRoot(segments: List<String>): Boolean {
            if (segments.size < 2) {
                return false
            }
            if (segments.first() == "slotcontent") {
                return segments.size == 4 && segments[1] in SLOTCONTENT_RESOURCE_AREAS
            }
            return segments.first() in ACTIVE_RESOURCE_AREAS && segments.size == 3
        }

        private fun Path.pathSegments(): List<String> = map { it.toString() }
    }
}
