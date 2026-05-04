package saltmarcher.buildlogic.tasks

import java.nio.file.Files
import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException

@CacheableTask
abstract class CheckDesktopPackagingInputsTask : DefaultTask() {

    @get:Optional
    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val mainClassSourceFile: RegularFileProperty

    @get:Optional
    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val preloaderClassSourceFile: RegularFileProperty

    @get:Optional
    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val desktopIconSourceFile: RegularFileProperty

    @get:Optional
    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
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

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun checkPackagingInputs() {
        val violations = mutableListOf<String>()

        if (mainClassSourceFile.orNull?.asFile?.isFile != true) {
            violations.add("Desktop packaging main class not found: ${mainClassName.get()}")
        }
        if (preloaderClassSourceFile.orNull?.asFile?.isFile != true) {
            violations.add("Desktop packaging preloader class not found: ${preloaderClassName.get()}")
        }

        val iconSource = desktopIconSourceFile.orNull?.asFile
        if (iconSource == null || !iconSource.isFile) {
            violations.add(
                "Desktop icon source is missing: ${iconSource?.toPath()?.toAbsolutePath() ?: desktopIconSourceRelativePath.get()}"
            )
        }

        if (!desktopEntryIconRelativePath.get().endsWith(".svg")) {
            violations.add("Desktop entry icon must point at an SVG file but was '${desktopEntryIconRelativePath.get()}'.")
        }
        if (!windowIconRelativePath.get().endsWith(".png")) {
            violations.add("Window icon must point at a PNG file but was '${windowIconRelativePath.get()}'.")
        }

        val stylesheet = stylesheetFile.orNull?.asFile
        if (stylesheet == null || !stylesheet.isFile) {
            violations.add(
                "Desktop stylesheet is missing: ${stylesheet?.toPath()?.toAbsolutePath() ?: stylesheetRelativePath.get()}"
            )
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
            throw VerificationException(
                "Desktop packaging input check failed with ${violations.size} violation(s):\n$details"
            )
        }

        val markerPath = successMarker.get().asFile.toPath()
        Files.createDirectories(markerPath.parent)
        Files.writeString(markerPath, "passed\n")
    }
}
