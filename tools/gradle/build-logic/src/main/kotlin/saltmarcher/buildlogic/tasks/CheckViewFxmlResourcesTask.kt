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
                validatePlacement(path.toFile(), expectedRoot.toFile(), path.startsWith(expectedRoot), relative, violations)
                validateContent(file, relative, violations)
            }

        if (violations.isNotEmpty()) {
            throw GradleException(
                "View FXML resources must live under resources/view/tabs/<entry>/, " +
                    "resources/view/topbar/<entry>/, resources/view/state/<entry>/, " +
                    "resources/view/details/<entry>/, or resources/view/views/ and must not contain inline scripts.\n" +
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
            violations.add("$relative -> expected resources/view/{tabs,topbar,state,details}/<entry>/*.fxml or resources/view/views/*.fxml")
            return
        }
        val rootRelative = expectedRoot.toPath().normalize().relativize(path)
        if (!hasAllowedViewResourceRoot(rootRelative.map { it.toString() })) {
            violations.add("$relative -> expected resources/view/{tabs,topbar,state,details}/<entry>/*.fxml or resources/view/views/*.fxml")
        }
        if (!Files.isDirectory(path.parent)) {
            violations.add("$relative -> parent directory is not a readable passive-view resource directory")
        }
    }

    private fun validateContent(file: File, relative: String, violations: MutableList<String>) {
        val text = file.readText()
        if (text.contains("<fx:script") || text.contains("<script")) {
            violations.add("$relative -> inline FXML scripts are forbidden")
        }
        val controllerMatch = FX_CONTROLLER_PATTERN.find(text) ?: return
        val controller = controllerMatch.groupValues[1]
        val allowedPrefixes = listOf(
            "src.view.tabs.",
            "src.view.topbar.",
            "src.view.state.",
            "src.view.details.",
            "src.view.views."
        )
        if (allowedPrefixes.none(controller::startsWith)) {
            violations.add("$relative -> fx:controller must start with one of ${allowedPrefixes.joinToString()}")
            return
        }
        validateControllerName(controller, relative, violations)
    }

    private fun validateControllerName(controller: String, relative: String, violations: MutableList<String>) {
        val controllerSegments = controller.split('.')
        if (controllerSegments.size < 4 || controllerSegments[0] != "src" || controllerSegments[1] != "view") {
            violations.add("$relative -> fx:controller must point to a concrete src.view passive View class")
            return
        }
        val area = controllerSegments[2]
        val simpleName = controllerSegments.last().substringBefore('$')
        val validController = when (area) {
            "views" -> simpleName.endsWith("View") && !simpleName.endsWith("ViewModel") && controllerSegments.size == 4
            "tabs" -> controllerSegments.size == 5 &&
                listOf("ControlsView", "MainView", "StateView").any(simpleName::endsWith)
            "topbar" -> controllerSegments.size == 5 && simpleName.endsWith("TopBarView")
            "state" -> controllerSegments.size == 5 && simpleName.endsWith("StateView")
            "details" -> controllerSegments.size == 5 && simpleName.endsWith("DetailsView")
            else -> false
        }
        if (!validController) {
            violations.add(
                "$relative -> fx:controller must match its passive view area: " +
                    "tabs use *ControlsView/*MainView/*StateView, topbar uses *TopBarView, " +
                    "state uses *StateView, details uses *DetailsView, reusable views use *View"
            )
        }
    }

    private companion object {
        private val CONTRIBUTION_RESOURCE_AREAS = setOf("tabs", "topbar", "state", "details")
        private val FX_CONTROLLER_PATTERN = Regex("fx:controller\\s*=\\s*\"([^\"]+)\"")

        private fun hasAllowedViewResourceRoot(segments: List<String>): Boolean {
            if (segments.size < 2) {
                return false
            }
            if (segments.first() == "views") {
                return segments.size == 2
            }
            return segments.first() in CONTRIBUTION_RESOURCE_AREAS && segments.size == 3
        }
    }
}
