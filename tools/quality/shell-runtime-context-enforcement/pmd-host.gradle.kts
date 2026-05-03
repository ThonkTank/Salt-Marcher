import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: projectDir.parentFile.parentFile.parentFile.parentFile

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.srcDir(repoRootDir.resolve("tools/quality/shell-runtime-context-enforcement/pmd/src/main/java"))
}
