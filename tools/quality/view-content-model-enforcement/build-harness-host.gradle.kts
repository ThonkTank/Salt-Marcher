import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.srcDir("../../quality/view-content-model-enforcement/build-harness/src/main/java")
}

tasks.register<JavaExec>("viewContentModelTopologyCheck") {
    description = "Run only the ViewContentModel build-harness topology rules."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.view.contentmodel.ViewContentModelTopologyCheckMain"
    args = listOf(projectDir.parentFile.parentFile.parentFile.absolutePath)
}
