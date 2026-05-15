package saltmarcher.buildlogic.verification

import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction

abstract class ResetProductionHandoffMarkersTask : DefaultTask() {
    @get:Internal
    abstract val compileIntegrityMarker: RegularFileProperty

    @get:Internal
    abstract val structureMarker: RegularFileProperty

    @TaskAction
    fun resetMarkers() {
        compileIntegrityMarker.asFile.get().delete()
        structureMarker.asFile.get().delete()
    }
}

abstract class WriteProductionHandoffMarkerTask : DefaultTask() {
    @get:OutputFile
    abstract val markerFile: RegularFileProperty

    @TaskAction
    fun writeMarker() {
        val marker = markerFile.asFile.get()
        marker.parentFile.mkdirs()
        marker.writeText("ok\n")
    }
}

abstract class RequireProductionHandoffMarkerTask : DefaultTask() {
    @get:InputFile
    abstract val markerFile: RegularFileProperty

    @TaskAction
    fun requireMarker() {
        val marker = markerFile.asFile.get()
        require(marker.isFile) {
            "Production handoff marker '${marker}' is missing."
        }
    }
}
