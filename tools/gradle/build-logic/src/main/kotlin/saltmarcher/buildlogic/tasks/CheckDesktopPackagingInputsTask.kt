package saltmarcher.buildlogic.tasks

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.TaskAction
import org.gradle.work.DisableCachingByDefault

@DisableCachingByDefault(because = "Verification task with no stable outputs.")
abstract class CheckDesktopPackagingInputsTask : DefaultTask() {

    @get:Internal
    abstract val mainClassSourceFile: RegularFileProperty

    @get:Internal
    abstract val preloaderClassSourceFile: RegularFileProperty

    @get:Internal
    abstract val desktopIconSourceFile: RegularFileProperty

    @get:Internal
    abstract val stylesheetFile: RegularFileProperty

    @get:Input
    abstract val mainClassName: Property<String>

    @get:Input
    abstract val preloaderClassName: Property<String>

    @get:Input
    abstract val desktopIconSourceRelativePath: Property<String>

    @get:Input
    abstract val desktopEntryIconRelativePath: Property<String>

    @get:Input
    abstract val windowIconRelativePath: Property<String>

    @get:Input
    abstract val stylesheetRelativePath: Property<String>

    @get:Input
    abstract val launcherName: Property<String>

    @get:Input
    abstract val startupWmClass: Property<String>

    @TaskAction
    fun checkPackagingInputs() {
        val violations = mutableListOf<String>()

        if (!mainClassSourceFile.get().asFile.isFile) {
            violations.add("Desktop packaging main class not found: ${mainClassName.get()}")
        }
        if (!preloaderClassSourceFile.get().asFile.isFile) {
            violations.add("Desktop packaging preloader class not found: ${preloaderClassName.get()}")
        }

        val iconSource = desktopIconSourceFile.get().asFile
        if (!iconSource.isFile) {
            violations.add("Desktop icon source is missing: ${iconSource.toPath().toAbsolutePath()}")
        }

        if (!desktopEntryIconRelativePath.get().endsWith(".svg")) {
            violations.add("Desktop entry icon must point at an SVG file but was '${desktopEntryIconRelativePath.get()}'.")
        }
        if (!windowIconRelativePath.get().endsWith(".png")) {
            violations.add("Window icon must point at a PNG file but was '${windowIconRelativePath.get()}'.")
        }

        val stylesheet = stylesheetFile.get().asFile
        if (!stylesheet.isFile) {
            violations.add("Desktop stylesheet is missing: ${stylesheet.toPath().toAbsolutePath()}")
        }

        val launcher = launcherName.get()
        if (!launcher.matches(Regex("[a-z0-9-]+"))) {
            violations.add("Launcher name must match [a-z0-9-]+ but was '$launcher'.")
        }
        if (startupWmClass.get().isBlank()) {
            violations.add("Desktop StartupWMClass must not be blank.")
        }

        if (violations.isNotEmpty()) {
            val details = violations.joinToString(separator = "\n") { " - $it" }
            throw GradleException(
                "Desktop packaging input check failed with ${violations.size} violation(s):\n$details"
            )
        }
    }
}
