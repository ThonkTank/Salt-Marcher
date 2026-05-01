import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.srcDir("../../quality/domain-layer-enforcement/build-harness/src/main/java")
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?: projectDir.parentFile.parentFile.parentFile.absolutePath

tasks.register<JavaExec>("domainLayerTopologyCheck") {
    group = "verification"
    description = "Run only the Domain Layer build-harness topology rules."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.domain.layer.DomainLayerTopologyCheckMain"
    args = listOf(repoRootDir)
}

tasks.register<JavaExec>("domainLayerDocumentationEnforcementCheck") {
    group = "verification"
    description = "Run only the Domain Layer enforcement-documentation coverage checks."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Documentation enforcement diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.domain.layer.DomainLayerDocumentationEnforcementCheckMain"
    args = listOf(repoRootDir)
}
