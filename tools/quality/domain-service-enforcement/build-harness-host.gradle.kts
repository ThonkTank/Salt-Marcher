import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.the

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.srcDir("../../quality/domain-service-enforcement/build-harness/src/main/java")
}

tasks.register<JavaExec>("domainServiceEnforcementDocumentationCheck") {
    group = "verification"
    description = "Run only the Domain Service enforcement documentation-coverage rules."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Documentation enforcement diagnostics must be produced by the current invocation.") { true }
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "saltmarcher.architecture.documentation.domainservice.DomainServiceEnforcementDocumentationCheckMain"
    args = listOf(projectDir.parentFile.parentFile.parentFile.absolutePath)
}
