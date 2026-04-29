import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.srcDir("../../quality/documentation-enforcement/build-harness/src/main/java")
}

tasks.register<JavaExec>("documentationEnforcementCheck") {
    group = "verification"
    description = "Run only the focused Markdown-backed architecture and enforcement documentation checks."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Documentation enforcement diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.documentation.DocumentationEnforcementCheckMain"
    args = listOf(projectDir.parentFile.parentFile.parentFile.absolutePath)
}
