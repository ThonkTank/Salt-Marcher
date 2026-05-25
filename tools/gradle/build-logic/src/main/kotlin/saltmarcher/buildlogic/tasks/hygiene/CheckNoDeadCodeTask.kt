package saltmarcher.buildlogic.tasks.hygiene

import java.io.BufferedInputStream
import java.io.DataInputStream
import java.io.File
import java.net.URLClassLoader
import java.nio.file.Files
import java.nio.file.Path
import javax.inject.Inject
import javax.xml.XMLConstants
import javax.xml.stream.XMLInputFactory
import javax.xml.stream.XMLStreamConstants
import org.gradle.api.Action
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException
import org.gradle.process.ExecOperations
import org.gradle.process.JavaExecSpec

@CacheableTask
abstract class CheckNoDeadCodeTask @Inject constructor(
    private val execOperations: ExecOperations
) : DefaultTask() {

    @get:Classpath
    abstract val toolClasspath: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val compiledClassesDirectory: DirectoryProperty

    @get:Classpath
    abstract val runtimeClasspath: ConfigurableFileCollection

    @get:Optional
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val javaHomeJmodsDirectory: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val resourceRoots: ConfigurableFileCollection

    @get:Optional
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val keepRulesFiles: ConfigurableFileCollection

    @get:Input
    abstract val mainClassName: Property<String>

    @get:Input
    abstract val preloaderClassName: Property<String>

    @get:OutputDirectory
    abstract val workingDirectory: DirectoryProperty

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun check() {
        val compiledRoot = compiledClassesDirectory.get().asFile
        val classEntries = loadClassEntries(compiledRoot)
        val workDir = workingDirectory.get().asFile.toPath()
        val generatedKeepRulesFile = workDir.resolve("generated-keep-rules.pro")
        val explicitKeepRulesFile = workDir.resolve("explicit-keep-rules.pro")
        val configFile = workDir.resolve("proguard-deadcode.pro")
        val usageFile = workDir.resolve("usage.txt")
        val outputJar = workDir.resolve("deadcode-out.jar")

        resetDirectory(workDir)
        Files.createDirectories(workDir)
        writeGeneratedKeepRules(generatedKeepRulesFile, classEntries)
        writeValidatedExplicitKeepRules(explicitKeepRulesFile)
        writeProguardConfig(
            configFile = configFile,
            usageFile = usageFile,
            outputJar = outputJar,
            generatedKeepRulesFile = generatedKeepRulesFile,
            explicitKeepRulesFile = explicitKeepRulesFile
        )
        Files.deleteIfExists(successMarker.get().asFile.toPath())

        execOperations.javaexec(object : Action<JavaExecSpec> {
            override fun execute(spec: JavaExecSpec) {
                spec.classpath = toolClasspath
                spec.mainClass.set("proguard.ProGuard")
                spec.args("@${configFile}")
            }
        })

        val findings = parseFindings(classEntries, usageFile)
        writeReport(findings)
        if (findings.hasFailures()) {
            throw VerificationException(
                "Dead code remains in production sources. See ${reportFile.get().asFile.invariantPath()}."
            )
        }
        Files.writeString(successMarker.get().asFile.toPath(), "passed\n")
    }

    private fun writeGeneratedKeepRules(outputFile: Path, classEntries: List<ClassEntry>) {
        val resourceRootDirs = resourceRoots.files.filter(File::isDirectory).sortedBy(File::invariantPath)
        val fxmlRoots = loadFxmlRoots(resourceRootDirs)
        val serviceLoaderRoots = loadServiceLoaderRoots(resourceRootDirs)
        val (shellContributionRoots, serviceContributionRoots) = inspectContributionTypes { inspector ->
            loadShellContributionRoots(classEntries, inspector) to
                    loadServiceContributionRoots(classEntries, inspector)
        }
        val explicitKeepFiles = keepRulesFiles.files.filter(File::isFile).sortedBy(File::invariantPath)
        val lines = buildList {
            add("# Generated structural dead-code roots.")
            add("-keep class ${validatedBinaryName(mainClassName.get(), "main class")} {")
            add("    public <init>();")
            add("    public static void main(java.lang.String[]);")
            add("    public void init();")
            add("    public void start(javafx.stage.Stage);")
            add("    public void stop();")
            add("}")
            add("-keep class ${validatedBinaryName(preloaderClassName.get(), "preloader class")} {")
            add("    public <init>();")
            add("    public void init();")
            add("    public void start(javafx.stage.Stage);")
            add("    public void stop();")
            add("    public void handleApplicationNotification(javafx.application.Preloader\$PreloaderNotification);")
            add("    public void handleStateChangeNotification(javafx.application.Preloader\$StateChangeNotification);")
            add("}")
            shellContributionRoots.forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("    public shell.api.ShellContributionSpec registrationSpec();")
                add("    public shell.api.ShellBinding bind(shell.api.ShellRuntimeContext);")
                add("}")
            }
            serviceContributionRoots.forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("    public void register(shell.api.ServiceRegistry\$Builder);")
                add("}")
            }
            fxmlRoots.forEach { root ->
                add("-keep class ${root.binaryName} {")
                add("    public <init>();")
                add("    *** initialize(...);")
                root.methods.sorted().forEach { methodName ->
                    add("    *** $methodName(...);")
                }
                root.fields.sorted().forEach { fieldName ->
                    add("    *** $fieldName;")
                }
                add("}")
            }
            serviceLoaderRoots.sorted().forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("}")
            }
            if (explicitKeepFiles.isNotEmpty()) {
                add("# Repo-owned fallback keep rules are included from the main config.")
            }
        }
        Files.writeString(outputFile, lines.joinToString(separator = "\n", postfix = "\n"))
    }

    private fun writeProguardConfig(
        configFile: Path,
        usageFile: Path,
        outputJar: Path,
        generatedKeepRulesFile: Path,
        explicitKeepRulesFile: Path
    ) {
        val runtimeJars = runtimeClasspath.files
            .asSequence()
            .filter(File::isFile)
            .sortedBy(File::invariantPath)
            .toList()
        val jmods = javaHomeJmodsDirectory.orNull?.asFile?.listFiles()
            ?.filter { file -> file.isFile && file.extension == "jmod" }
            ?.sortedBy(File::invariantPath)
            .orEmpty()

        val lines = buildList {
            add("-injars ${compiledClassesDirectory.get().asFile.invariantPath()}")
            add("-outjars ${outputJar.toFile().invariantPath()}")
            add("-printusage ${usageFile.toFile().invariantPath()}")
            add("-dontobfuscate")
            add("-dontoptimize")
            add("-dontpreverify")
            add("-dontnote")
            add("-dontwarn **")
            add("-ignorewarnings")
            add("-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod")
            jmods.forEach { file ->
                add("-libraryjars ${file.invariantPath()}")
            }
            runtimeJars.forEach { file ->
                add("-libraryjars ${file.invariantPath()}")
            }
            add("-include ${generatedKeepRulesFile.toFile().invariantPath()}")
            add("-include ${explicitKeepRulesFile.toFile().invariantPath()}")
        }
        Files.writeString(configFile, lines.joinToString(separator = "\n", postfix = "\n"))
    }

    private fun writeValidatedExplicitKeepRules(outputFile: Path) {
        val keepFiles = keepRulesFiles.files.filter(File::isFile).sortedBy(File::invariantPath)
        val lines = keepFiles.flatMap { keepFile -> validatedExplicitKeepRuleLines(keepFile) }
        Files.writeString(outputFile, lines.joinToString(separator = "\n", postfix = "\n"))
    }

    private fun validatedExplicitKeepRuleLines(keepFile: File): List<String> {
        var keepBlockDepth = 0
        return keepFile.readLines().mapIndexedNotNull { index, rawLine ->
            val line = rawLine.trim()
            if (line.isBlank() || line.startsWith("#")) {
                return@mapIndexedNotNull rawLine
            }
            if (keepBlockDepth > 0) {
                require(!line.startsWith("-")) {
                    "Invalid dead-code keep rule in ${keepFile.invariantPath()}:${index + 1}. " +
                        "Nested ProGuard options are not allowed inside keep blocks."
                }
                rejectCatchAllKeepRule(line, keepFile, index)
                keepBlockDepth += line.count { character -> character == '{' }
                keepBlockDepth -= line.count { character -> character == '}' }
                require(keepBlockDepth >= 0) {
                    "Invalid dead-code keep rule in ${keepFile.invariantPath()}:${index + 1}. " +
                        "Keep block closes before it opens."
                }
                return@mapIndexedNotNull rawLine
            }
            require(line.startsWith("-keep")) {
                "Invalid dead-code keep rule in ${keepFile.invariantPath()}:${index + 1}. " +
                    "Only ProGuard keep directives are allowed."
            }
            require(AllowedExplicitKeepRuleOptions.any { option -> line.startsWith(option) }) {
                "Invalid dead-code keep rule in ${keepFile.invariantPath()}:${index + 1}. " +
                    "Only approved keep directives are allowed."
            }
            rejectCatchAllKeepRule(line, keepFile, index)
            keepBlockDepth += line.count { character -> character == '{' }
            keepBlockDepth -= line.count { character -> character == '}' }
            require(keepBlockDepth >= 0) {
                "Invalid dead-code keep rule in ${keepFile.invariantPath()}:${index + 1}. " +
                    "Keep block closes before it opens."
            }
            rawLine
        }.also {
            require(keepBlockDepth == 0) {
                "Invalid dead-code keep rules in ${keepFile.invariantPath()}: keep block is not closed."
            }
        }
    }

    private fun rejectCatchAllKeepRule(line: String, keepFile: File, index: Int) {
        require(!CatchAllKeepTargetPattern.containsMatchIn(line) && !CatchAllKeepMemberPattern.containsMatchIn(line)) {
            "Invalid dead-code keep rule in ${keepFile.invariantPath()}:${index + 1}. " +
                "Catch-all keep rules are not allowed."
        }
    }

    private fun parseFindings(classEntries: List<ClassEntry>, usageFile: Path): DeadCodeFindings {
        val classesByBinaryName = classEntries.associateBy(ClassEntry::binaryName)
        val deadTypes = mutableListOf<DeadType>()
        val deadConstructors = mutableListOf<DeadMember>()
        val deadMethods = mutableListOf<DeadMember>()
        val deadFields = mutableListOf<DeadMember>()

        var currentOwner: String? = null
        if (Files.isRegularFile(usageFile)) {
            Files.readAllLines(usageFile).forEach { rawLine ->
                val line = rawLine.trim()
                if (line.isBlank()) {
                    return@forEach
                }
                val ownerHeader = line.removeSuffix(":").takeIf {
                    !rawLine.first().isWhitespace() && line.endsWith(":")
                }
                if (ownerHeader != null) {
                    currentOwner = ownerHeader
                    return@forEach
                }
                if (!rawLine.first().isWhitespace() && ':' !in line) {
                    currentOwner = null
                    val entry = classesByBinaryName[line] ?: return@forEach
                    deadTypes += DeadType(
                        sourceRelativePath = entry.sourceRelativePath,
                        name = entry.binaryName,
                        declarationKind = entry.declarationKind,
                        nestingKind = entry.nestingKind
                    )
                    return@forEach
                }
                val owner = currentOwner ?: line.substringBefore(':').trim()
                val memberSource = if (currentOwner == null && ':' in line) {
                    line.substringAfter(':')
                } else {
                    line
                }
                val member = normalizeProguardMember(memberSource)
                if (member.isBlank()) {
                    return@forEach
                }
                val entry = classesByBinaryName[owner] ?: return@forEach
                if (isCompilerGeneratedMember(entry, member) || isStructurallyIntentionalMember(entry, member)) {
                    return@forEach
                }
                if ('(' in member) {
                    if (isConstructorMember(owner, member)) {
                        if (!isStructurallyIntentionalConstructor(entry, member)) {
                            deadConstructors += DeadMember(entry.sourceRelativePath, "$owner#$member")
                        }
                    } else if (!member.startsWith("static {}") && !isObjectProtocolOverride(member)) {
                        deadMethods += DeadMember(entry.sourceRelativePath, "$owner#$member")
                    }
                } else if (!isStructurallyIntentionalField(entry, member)) {
                    deadFields += DeadMember(entry.sourceRelativePath, "$owner#$member")
                }
            }
        }

        val deadTypeNames = deadTypes.map(DeadType::name).toSet()
        val deadFiles = classEntries
            .groupBy(ClassEntry::sourceRelativePath)
            .values
            .filter { sourceEntries -> sourceEntries.all { entry -> entry.binaryName in deadTypeNames } }
            .map { sourceEntries -> sourceEntries.first().sourceRelativePath }
            .distinct()
            .sorted()

        return DeadCodeFindings(
            deadFiles = deadFiles,
            deadTypes = deadTypes.sortedWith(compareBy(DeadType::sourceRelativePath, DeadType::name)),
            deadConstructors = deadConstructors.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name)),
            deadMethods = deadMethods.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name)),
            deadFields = deadFields.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name))
        )
    }

    private fun normalizeProguardMember(rawMember: String): String {
        val trimmed = rawMember.trim()
        val secondColon = trimmed.indexOf(':', startIndex = trimmed.indexOf(':') + 1)
        return if (trimmed.firstOrNull()?.isDigit() == true && secondColon >= 0) {
            trimmed.substring(secondColon + 1).trim()
        } else {
            trimmed
        }
    }

    private fun isConstructorMember(owner: String, member: String): Boolean {
        return parseReportedConstructor(owner, member) != null
    }

    private fun isStructurallyIntentionalConstructor(entry: ClassEntry, member: String): Boolean {
        return entry.utilityNamespace && isPrivateNoArgConstructor(entry.binaryName, member)
    }

    private fun isStructurallyIntentionalMember(entry: ClassEntry, member: String): Boolean {
        val method = parseReportedMethod(member) ?: return false
        return isPublishedModelReadbackContract(entry, method)
                || isShellRuntimeContextGateway(entry, method)
                || isLibraryCallbackImplementation(entry, method)
    }

    private fun isStructurallyIntentionalField(entry: ClassEntry, member: String): Boolean {
        return parseReportedField(member)?.let(entry.compileTimeConstantFields::contains) == true
    }

    private fun isPublishedModelReadbackContract(entry: ClassEntry, method: ReportedMethodSignature): Boolean {
        if (!entry.isTopLevelClass
            || !entry.binaryName.substringAfterLast('.').endsWith("Model")
            || !entry.packageName.startsWith("src.domain.")
            || !entry.packageName.endsWith(".published")
        ) {
            return false
        }
        return when (method.name) {
            "current" -> method.parameterTypes.isEmpty() && method.returnType != "void"
            "subscribe" -> method.returnType == "java.lang.Runnable"
                    && method.parameterTypes == listOf("java.util.function.Consumer")
            else -> false
        }
    }

    private fun isShellRuntimeContextGateway(entry: ClassEntry, method: ReportedMethodSignature): Boolean {
        return entry.binaryName == "shell.api.ShellRuntimeContext"
                && method == ReportedMethodSignature(
                    returnType = "java.lang.Object",
                    name = "session",
                    parameterTypes = listOf("java.lang.Class", "java.util.function.Supplier")
                )
    }

    private fun isLibraryCallbackImplementation(entry: ClassEntry, method: ReportedMethodSignature): Boolean {
        return "java.util.Comparator" in entry.implementedInterfaces
                && method.name == "compare"
                && method.returnType == "int"
                && method.parameterTypes.size == 2
    }

    private fun isCompilerGeneratedMember(entry: ClassEntry, member: String): Boolean {
        return when (entry.declarationKind) {
            DeclarationKind.RECORD -> isGeneratedRecordMember(entry, member)
            DeclarationKind.ENUM -> isGeneratedEnumMember(entry.binaryName, member)
            else -> isGeneratedMethodMember(entry.generatedMethods, member)
        } || isGeneratedFieldMember(entry, member)
    }

    private fun isGeneratedRecordMember(entry: ClassEntry, member: String): Boolean {
        return isGeneratedMethodMember(entry.generatedMethods, member)
                || parseReportedConstructor(entry.binaryName, member)?.let(entry.generatedRecordConstructors::contains) == true
    }

    private fun isGeneratedEnumMember(owner: String, member: String): Boolean {
        val method = parseReportedMethod(member) ?: return false
        return method == ReportedMethodSignature("${owner}[]", "values", emptyList())
                || method == ReportedMethodSignature(owner, "valueOf", listOf("java.lang.String"))
    }

    private fun isGeneratedMethodMember(generatedMethods: Set<ReportedMethodSignature>, member: String): Boolean {
        return parseReportedMethod(member)?.let(generatedMethods::contains) == true
    }

    private fun isGeneratedFieldMember(entry: ClassEntry, member: String): Boolean {
        return parseReportedField(member)?.let(entry.generatedFields::contains) == true
    }

    private fun writeReport(findings: DeadCodeFindings) {
        val reportPath = reportFile.get().asFile.toPath()
        Files.createDirectories(reportPath.parent)
        Files.writeString(reportPath, findings.render())
    }

    private fun loadClassEntries(compiledRoot: File): List<ClassEntry> {
        if (!compiledRoot.isDirectory) {
            return emptyList()
        }
        val rootPath = compiledRoot.toPath()
        return compiledRoot.walkTopDown()
            .filter { file -> file.isFile && file.extension == "class" }
            .sortedBy(File::invariantPath)
            .mapNotNull { classFile ->
                val relativePath = rootPath.relativize(classFile.toPath()).invariantPath()
                val internalName = relativePath.removeSuffix(".class")
                loadClassEntry(classFile.toPath(), internalName)
            }
            .toList()
    }

    private fun loadClassEntry(classFile: Path, internalName: String): ClassEntry? {
        val metadata = loadClassMetadata(classFile, internalName)
        if (!metadata.shouldReport) {
            return null
        }
        val binaryName = internalName.replace('/', '.')
        val topLevelBinaryName = internalName.substringBefore('$').replace('/', '.')
        return ClassEntry(
            binaryName = binaryName,
            topLevelBinaryName = topLevelBinaryName,
            packageName = binaryName.substringBeforeLast('.', missingDelimiterValue = ""),
            sourceRelativePath = loadSourceRelativePath(internalName, metadata.sourceFileName),
            declarationKind = metadata.declarationKind,
            nestingKind = metadata.nestingKind,
            implementedInterfaces = metadata.implementedInterfaces,
            generatedMethods = generatedMethods(metadata),
            generatedRecordConstructors = generatedRecordConstructors(metadata),
            generatedFields = generatedFields(metadata),
            compileTimeConstantFields = compileTimeConstantFields(metadata),
            utilityNamespace = isUtilityNamespace(metadata)
        )
    }

    private fun generatedMethods(metadata: ClassMetadata): Set<ReportedMethodSignature> {
        return buildSet {
            metadata.methods
                .filter(MethodMetadata::isCompilerGenerated)
                .forEach { method -> add(method.toReportedSignature() ?: return@forEach) }
            if (metadata.declarationKind != DeclarationKind.RECORD) {
                return@buildSet
            }
            metadata.methods
                .filter(::isGeneratedRecordObjectMethod)
                .forEach { method -> add(method.toReportedSignature() ?: return@forEach) }
            metadata.recordComponents.forEach { component ->
                val accessor = metadata.methods.firstOrNull { method ->
                    isGeneratedRecordAccessor(method, component)
                }
                if (accessor != null) {
                    add(ReportedMethodSignature(component.javaType, component.name, emptyList()))
                }
            }
        }
    }

    private fun generatedRecordConstructors(metadata: ClassMetadata): Set<ReportedConstructorSignature> {
        if (metadata.declarationKind != DeclarationKind.RECORD) {
            return emptySet()
        }
        val canonicalConstructor = metadata.methods.firstOrNull { method ->
            isCanonicalRecordConstructor(method, metadata.recordComponents)
        }
        return if (canonicalConstructor == null) {
            emptySet()
        } else {
            setOf(ReportedConstructorSignature(metadata.recordComponents.map(RecordComponentMetadata::javaType)))
        }
    }

    private fun generatedFields(metadata: ClassMetadata): Set<ReportedFieldSignature> {
        return buildSet {
            metadata.fields
                .filter(FieldMetadata::isCompilerGenerated)
                .forEach { field -> add(field.toReportedSignature()) }
            if (metadata.declarationKind != DeclarationKind.RECORD) {
                return@buildSet
            }
            metadata.recordComponents.forEach { component ->
                val field = metadata.fields.firstOrNull { candidate ->
                    candidate.name == component.name
                            && candidate.descriptor == component.descriptor
                            && candidate.isPrivateFinal
                }
                if (field != null) {
                    add(ReportedFieldSignature(component.javaType, component.name))
                }
            }
        }
    }

    private fun compileTimeConstantFields(metadata: ClassMetadata): Set<ReportedFieldSignature> {
        return metadata.fields
            .asSequence()
            .filter(FieldMetadata::isCompileTimeConstant)
            .map(FieldMetadata::toReportedSignature)
            .toSet()
    }

    private fun isGeneratedRecordObjectMethod(method: MethodMetadata): Boolean {
        return when (method.name to method.descriptor) {
            "toString" to "()Ljava/lang/String;" -> method.codeBytes.contentEquals(
                byteArrayOf(0x2a, 0xba.toByte(), 0, 0, 0, 0, 0xb0.toByte()),
                maskIndexes = setOf(2, 3)
            )
            "hashCode" to "()I" -> method.codeBytes.contentEquals(
                byteArrayOf(0x2a, 0xba.toByte(), 0, 0, 0, 0, 0xac.toByte()),
                maskIndexes = setOf(2, 3)
            )
            "equals" to "(Ljava/lang/Object;)Z" -> method.codeBytes.contentEquals(
                byteArrayOf(0x2a, 0x2b, 0xba.toByte(), 0, 0, 0, 0, 0xac.toByte()),
                maskIndexes = setOf(3, 4)
            )
            else -> false
        }
    }

    private fun isGeneratedRecordAccessor(
        method: MethodMetadata,
        component: RecordComponentMetadata
    ): Boolean {
        return method.name == component.name
                && method.descriptor == "()${component.descriptor}"
    }

    private fun isCanonicalRecordConstructor(
        method: MethodMetadata,
        components: List<RecordComponentMetadata>
    ): Boolean {
        return method.name == "<init>" && method.descriptor == components.constructorDescriptor()
    }

    private fun isUtilityNamespace(metadata: ClassMetadata): Boolean {
        return metadata.declarationKind == DeclarationKind.CLASS
                && metadata.fields.none { field -> !field.isStatic && !field.isCompilerGenerated }
                && metadata.methods.none { method -> !method.isConstructor && !method.isStatic && !method.isCompilerGenerated }
    }

    private fun loadFxmlRoots(resourceRoots: List<File>): List<FxmlRoot> {
        val xmlFactory = XMLInputFactory.newFactory().apply {
            setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false)
            setProperty(XMLInputFactory.SUPPORT_DTD, false)
            setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "")
            setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "")
        }
        return resourceRoots
            .asSequence()
            .flatMap { root ->
                root.walkTopDown()
                    .asSequence()
                    .filter { file -> file.isFile && file.extension == "fxml" }
                    .sortedBy(File::invariantPath)
                    .mapNotNull { file ->
                        val methods = linkedSetOf<String>()
                        val fields = linkedSetOf<String>()
                        var controllerBinaryName: String? = null
                        file.inputStream().use { input ->
                            val reader = xmlFactory.createXMLStreamReader(input)
                            while (reader.hasNext()) {
                                if (reader.next() != XMLStreamConstants.START_ELEMENT) {
                                    continue
                                }
                                for (index in 0 until reader.attributeCount) {
                                    val value = reader.getAttributeValue(index) ?: continue
                                    val localName = reader.getAttributeLocalName(index)
                                    if (reader.getAttributePrefix(index) == "fx" && localName == "controller") {
                                        controllerBinaryName = validatedBinaryName(value, "${file.invariantPath()} fx:controller")
                                    }
                                    if (value.startsWith("#")) {
                                        methods += validatedJavaIdentifier(
                                            value.removePrefix("#"),
                                            "${file.invariantPath()} event handler"
                                        )
                                    }
                                    if (reader.getAttributePrefix(index) == "fx" && localName == "id") {
                                        fields += validatedJavaIdentifier(value, "${file.invariantPath()} fx:id")
                                    }
                                }
                            }
                            reader.close()
                        }
                        controllerBinaryName?.let { binaryName ->
                            FxmlRoot(
                                binaryName = binaryName,
                                methods = methods,
                                fields = fields
                            )
                        }
                    }
            }
            .groupBy(FxmlRoot::binaryName)
            .values
            .map { roots ->
                FxmlRoot(
                    binaryName = roots.first().binaryName,
                    methods = roots.asSequence().flatMap { root -> root.methods.asSequence() }.toSortedSet(),
                    fields = roots.asSequence().flatMap { root -> root.fields.asSequence() }.toSortedSet()
                )
            }
            .sortedBy(FxmlRoot::binaryName)
            .toList()
    }

    private fun loadServiceLoaderRoots(resourceRoots: List<File>): Set<String> {
        return resourceRoots
            .asSequence()
            .map { root -> root.resolve("META-INF/services") }
            .filter(File::isDirectory)
            .flatMap { servicesDir ->
                servicesDir.walkTopDown()
                    .asSequence()
                    .filter(File::isFile)
                    .sortedBy(File::invariantPath)
                    .flatMap { file ->
                        file.readLines()
                            .asSequence()
                            .map(String::trim)
                            .filter { line -> line.isNotEmpty() && !line.startsWith("#") }
                            .map { line -> validatedBinaryName(line, "${file.invariantPath()} service provider") }
                    }
            }
            .toSortedSet()
    }

    private fun validatedBinaryName(value: String, context: String): String {
        require(JavaBinaryNamePattern.matches(value)) {
            "Invalid Java binary name in $context: '$value'."
        }
        return value
    }

    private fun validatedJavaIdentifier(value: String, context: String): String {
        require(JavaIdentifierPattern.matches(value)) {
            "Invalid Java identifier in $context: '$value'."
        }
        return value
    }

    private fun loadShellContributionRoots(
        classEntries: List<ClassEntry>,
        inspector: ContributionTypeInspector
    ): List<String> {
        return classEntries
            .asSequence()
            .filter(ClassEntry::isTopLevelClass)
            .filter { entry -> isShellContributionRoot(entry, inspector) }
            .map(ClassEntry::binaryName)
            .distinct()
            .sorted()
            .toList()
    }

    private fun loadServiceContributionRoots(
        classEntries: List<ClassEntry>,
        inspector: ContributionTypeInspector
    ): List<String> {
        return classEntries
            .asSequence()
            .filter(ClassEntry::isTopLevelClass)
            .filter { entry -> isServiceContributionRoot(entry, inspector) }
            .map(ClassEntry::binaryName)
            .distinct()
            .sorted()
            .toList()
    }

    private fun isShellContributionRoot(entry: ClassEntry, inspector: ContributionTypeInspector): Boolean {
        return isContributionRoot(entry, inspector, "src.view.leftbartabs", "Contribution", ContributionKind.SHELL)
                || isContributionRoot(entry, inspector, "src.view.statetabs", "Contribution", ContributionKind.SHELL)
                || isContributionRoot(entry, inspector, "src.view.dropdowns", "Contribution", ContributionKind.SHELL)
    }

    private fun isServiceContributionRoot(entry: ClassEntry, inspector: ContributionTypeInspector): Boolean =
        isContributionRoot(entry, inspector, "src.data", "ServiceContribution", ContributionKind.SERVICE)
                || isContributionRoot(entry, inspector, "src.domain", "ServiceContribution", ContributionKind.SERVICE)

    private fun isContributionRoot(
        entry: ClassEntry,
        inspector: ContributionTypeInspector,
        rootPackage: String,
        classSuffix: String,
        contributionKind: ContributionKind
    ): Boolean {
        val featureName = rootFeatureSegment(entry, rootPackage) ?: return false
        if (featureName.isBlank()) {
            return false
        }
        if (!entry.binaryName.substringAfterLast('.').endsWith(classSuffix)) {
            return false
        }
        return when (contributionKind) {
            ContributionKind.SHELL -> inspector.isConcreteShellContribution(entry.binaryName)
            ContributionKind.SERVICE -> inspector.isConcreteServiceContribution(entry.binaryName)
        }
    }

    private fun rootFeatureSegment(entry: ClassEntry, rootPackage: String): String? {
        val prefix = "$rootPackage."
        if (!entry.packageName.startsWith(prefix)) {
            return null
        }
        val remainder = entry.packageName.removePrefix(prefix)
        if (remainder.isBlank() || '.' in remainder) {
            return null
        }
        return remainder
    }

    private fun loadSourceRelativePath(internalName: String, sourceFileName: String?): String {
        val packagePath = internalName.substringBeforeLast('/', missingDelimiterValue = "")
        val effectiveSourceFileName = sourceFileName
            ?: "${internalName.substringBefore('$').substringAfterLast('/')}.java"
        return if (packagePath.isBlank()) {
            effectiveSourceFileName
        } else {
            "$packagePath/$effectiveSourceFileName"
        }
    }

    private fun loadClassMetadata(classFile: Path, internalName: String): ClassMetadata {
        return try {
            DataInputStream(BufferedInputStream(Files.newInputStream(classFile))).use { input ->
                val magic = input.readInt()
                if (magic != 0xCAFEBABE.toInt()) {
                    throw IllegalStateException("Unexpected classfile header in ${classFile.invariantPath()}.")
                }
                input.readUnsignedShort()
                input.readUnsignedShort()
                val constantPool = readConstantPool(input)
                val accessFlags = input.readUnsignedShort()
                val thisClassIndex = input.readUnsignedShort()
                input.readUnsignedShort()
                val implementedInterfaces = buildList {
                    repeat(input.readUnsignedShort()) {
                        constantPool.className(input.readUnsignedShort())
                            ?.replace('/', '.')
                            ?.let(::add)
                    }
                }
                val fields = readFields(input, constantPool)
                val methods = readMethods(input, constantPool)

                val thisInternalName = constantPool.className(thisClassIndex)
                    ?: throw IllegalStateException("Missing class name for ${classFile.invariantPath()}.")
                var sourceFileName: String? = null
                var innerSimpleName: String? = null
                var hasEnclosingMethod = false
                var hasRecordAttribute = false
                var recordComponents = emptyList<RecordComponentMetadata>()

                repeat(input.readUnsignedShort()) {
                    val attributeName = constantPool.utf8(input.readUnsignedShort())
                    val attributeLength = input.readInt().toLong() and 0xffffffffL
                    when (attributeName) {
                        "SourceFile" -> {
                            if (attributeLength == 2L) {
                                sourceFileName = constantPool.utf8(input.readUnsignedShort())
                            } else {
                                input.skipNBytes(attributeLength)
                            }
                        }
                        "InnerClasses" -> {
                            var bytesRemaining = attributeLength
                            val entryCount = input.readUnsignedShort()
                            bytesRemaining -= 2
                            repeat(entryCount) {
                                val innerClassIndex = input.readUnsignedShort()
                                input.readUnsignedShort()
                                val innerNameIndex = input.readUnsignedShort()
                                input.readUnsignedShort()
                                bytesRemaining -= 8
                                if (constantPool.className(innerClassIndex) == thisInternalName) {
                                    innerSimpleName = constantPool.utf8OrNull(innerNameIndex)
                                }
                            }
                            if (bytesRemaining > 0L) {
                                input.skipNBytes(bytesRemaining)
                            }
                        }
                        "EnclosingMethod" -> {
                            hasEnclosingMethod = true
                            input.skipNBytes(attributeLength)
                        }
                        "Record" -> {
                            hasRecordAttribute = true
                            recordComponents = readRecordComponents(input, constantPool, attributeLength)
                        }
                        else -> input.skipNBytes(attributeLength)
                    }
                }

                ClassMetadata(
                    sourceFileName = sourceFileName,
                    declarationKind = declarationKind(accessFlags, hasRecordAttribute),
                    nestingKind = nestingKind(internalName, hasEnclosingMethod),
                    implementedInterfaces = implementedInterfaces,
                    recordComponents = recordComponents,
                    fields = fields,
                    methods = methods,
                    shouldReport = shouldReportClass(
                        internalName = internalName,
                        accessFlags = accessFlags,
                        hasEnclosingMethod = hasEnclosingMethod,
                        innerSimpleName = innerSimpleName
                    )
                )
            }
        } catch (exception: Exception) {
            throw IllegalStateException("Could not read class metadata from ${classFile.invariantPath()}.", exception)
        }
    }

    private fun shouldReportClass(
        internalName: String,
        accessFlags: Int,
        hasEnclosingMethod: Boolean,
        innerSimpleName: String?
    ): Boolean {
        val topLevelSimpleName = internalName.substringBefore('$').substringAfterLast('/')
        if (topLevelSimpleName.isBlank() || topLevelSimpleName == "package-info" || topLevelSimpleName == "module-info") {
            return false
        }
        if ("$$" in internalName) {
            return false
        }
        if (accessFlags and ACC_SYNTHETIC != 0) {
            return false
        }
        if (hasEnclosingMethod && innerSimpleName == null) {
            return false
        }
        return true
    }

    private fun declarationKind(accessFlags: Int, hasRecordAttribute: Boolean): DeclarationKind {
        return when {
            accessFlags and ACC_ANNOTATION != 0 -> DeclarationKind.ANNOTATION
            accessFlags and ACC_INTERFACE != 0 -> DeclarationKind.INTERFACE
            accessFlags and ACC_ENUM != 0 -> DeclarationKind.ENUM
            hasRecordAttribute -> DeclarationKind.RECORD
            accessFlags and ACC_ABSTRACT != 0 -> DeclarationKind.ABSTRACT_CLASS
            else -> DeclarationKind.CLASS
        }
    }

    private fun nestingKind(internalName: String, hasEnclosingMethod: Boolean): NestingKind {
        return when {
            '$' !in internalName -> NestingKind.TOP_LEVEL
            hasEnclosingMethod -> NestingKind.LOCAL
            else -> NestingKind.NESTED
        }
    }

    private fun <T> inspectContributionTypes(block: (ContributionTypeInspector) -> T): T {
        val urls = buildList {
            add(compiledClassesDirectory.get().asFile.toURI().toURL())
            runtimeClasspath.files
                .filter(File::exists)
                .sortedBy(File::invariantPath)
                .forEach { file -> add(file.toURI().toURL()) }
        }
        URLClassLoader(urls.toTypedArray(), ClassLoader.getPlatformClassLoader()).use { classLoader ->
            return block(ContributionTypeInspector(classLoader))
        }
    }

    private fun readConstantPool(input: DataInputStream): ConstantPool {
        val constantPoolCount = input.readUnsignedShort()
        val utf8Entries = arrayOfNulls<String>(constantPoolCount)
        val classNameIndexes = IntArray(constantPoolCount)
        var index = 1
        while (index < constantPoolCount) {
            when (val tag = input.readUnsignedByte()) {
                1 -> utf8Entries[index] = input.readUTF()
                3, 4 -> input.skipNBytes(4)
                5, 6 -> {
                    input.skipNBytes(8)
                    index += 1
                }
                7 -> classNameIndexes[index] = input.readUnsignedShort()
                8, 16, 19, 20 -> input.skipNBytes(2)
                9, 10, 11, 12, 17, 18 -> input.skipNBytes(4)
                15 -> input.skipNBytes(3)
                else -> throw IllegalStateException("Unsupported classfile constant-pool tag $tag.")
            }
            index += 1
        }
        return ConstantPool(
            utf8Entries = utf8Entries,
            classNameIndexes = classNameIndexes
        )
    }

    private fun readMethods(input: DataInputStream, constantPool: ConstantPool): List<MethodMetadata> {
        return buildList {
            repeat(input.readUnsignedShort()) {
                val accessFlags = input.readUnsignedShort()
                val name = constantPool.utf8(input.readUnsignedShort()).orEmpty()
                val descriptor = constantPool.utf8(input.readUnsignedShort()).orEmpty()
                var codeBytes = ByteArray(0)
                repeat(input.readUnsignedShort()) {
                    val attributeName = constantPool.utf8(input.readUnsignedShort())
                    val attributeLength = input.readInt().toLong() and 0xffffffffL
                    if (attributeName == "Code") {
                        codeBytes = readCodeBytes(input)
                    } else {
                        input.skipNBytes(attributeLength)
                    }
                }
                add(
                    MethodMetadata(
                        accessFlags = accessFlags,
                        name = name,
                        descriptor = descriptor,
                        codeBytes = codeBytes
                    )
                )
            }
        }
    }

    private fun readCodeBytes(input: DataInputStream): ByteArray {
        input.readUnsignedShort()
        input.readUnsignedShort()
        val codeBytes = ByteArray(input.readInt())
        input.readFully(codeBytes)
        repeat(input.readUnsignedShort()) {
            input.skipNBytes(8)
        }
        repeat(input.readUnsignedShort()) {
            input.readUnsignedShort()
            val attributeLength = input.readInt().toLong() and 0xffffffffL
            input.skipNBytes(attributeLength)
        }
        return codeBytes
    }

    private fun readRecordComponents(
        input: DataInputStream,
        constantPool: ConstantPool,
        attributeLength: Long
    ): List<RecordComponentMetadata> {
        var bytesRemaining = attributeLength
        val componentCount = input.readUnsignedShort()
        bytesRemaining -= 2
        return buildList {
            repeat(componentCount) {
                val name = constantPool.utf8(input.readUnsignedShort()).orEmpty()
                val descriptor = constantPool.utf8(input.readUnsignedShort()).orEmpty()
                val attributesCount = input.readUnsignedShort()
                bytesRemaining -= 6
                repeat(attributesCount) {
                    input.readUnsignedShort()
                    val componentAttributeLength = input.readInt().toLong() and 0xffffffffL
                    input.skipNBytes(componentAttributeLength)
                    bytesRemaining -= 6 + componentAttributeLength
                }
                add(RecordComponentMetadata(name, descriptor, javaType(descriptor)))
            }
            if (bytesRemaining > 0L) {
                input.skipNBytes(bytesRemaining)
            }
        }
    }

    private fun readFields(input: DataInputStream, constantPool: ConstantPool): List<FieldMetadata> {
        return buildList {
            repeat(input.readUnsignedShort()) {
                val accessFlags = input.readUnsignedShort()
                val name = constantPool.utf8(input.readUnsignedShort()).orEmpty()
                val descriptor = constantPool.utf8(input.readUnsignedShort()).orEmpty()
                var hasConstantValue = false
                repeat(input.readUnsignedShort()) {
                    val attributeName = constantPool.utf8(input.readUnsignedShort())
                    val attributeLength = input.readInt().toLong() and 0xffffffffL
                    if (attributeName == "ConstantValue" && attributeLength == 2L) {
                        hasConstantValue = true
                    }
                    input.skipNBytes(attributeLength)
                }
                add(FieldMetadata(accessFlags, name, descriptor, hasConstantValue))
            }
        }
    }

    private fun skipMembers(input: DataInputStream) {
        repeat(input.readUnsignedShort()) {
            input.readUnsignedShort()
            input.readUnsignedShort()
            input.readUnsignedShort()
            repeat(input.readUnsignedShort()) {
                input.readUnsignedShort()
                input.skipNBytes(input.readInt().toLong() and 0xffffffffL)
            }
        }
    }

    private fun resetDirectory(directory: Path) {
        if (!Files.exists(directory)) {
            return
        }
        Files.walk(directory)
            .sorted(Comparator.reverseOrder())
            .forEach(Files::deleteIfExists)
    }
}

private data class ClassEntry(
    val binaryName: String,
    val topLevelBinaryName: String,
    val packageName: String,
    val sourceRelativePath: String,
    val declarationKind: DeclarationKind,
    val nestingKind: NestingKind,
    val implementedInterfaces: List<String>,
    val generatedMethods: Set<ReportedMethodSignature>,
    val generatedRecordConstructors: Set<ReportedConstructorSignature>,
    val generatedFields: Set<ReportedFieldSignature>,
    val compileTimeConstantFields: Set<ReportedFieldSignature>,
    val utilityNamespace: Boolean
) {
    val isTopLevelClass: Boolean
        get() = binaryName == topLevelBinaryName
}

private data class ClassMetadata(
    val sourceFileName: String?,
    val declarationKind: DeclarationKind,
    val nestingKind: NestingKind,
    val implementedInterfaces: List<String>,
    val recordComponents: List<RecordComponentMetadata>,
    val fields: List<FieldMetadata>,
    val methods: List<MethodMetadata>,
    val shouldReport: Boolean
)

private data class MethodMetadata(
    val accessFlags: Int,
    val name: String,
    val descriptor: String,
    val codeBytes: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        return other is MethodMetadata
                && accessFlags == other.accessFlags
                && name == other.name
                && descriptor == other.descriptor
                && codeBytes.contentEquals(other.codeBytes)
    }

    override fun hashCode(): Int {
        var result = accessFlags
        result = 31 * result + name.hashCode()
        result = 31 * result + descriptor.hashCode()
        result = 31 * result + codeBytes.contentHashCode()
        return result
    }

    val isConstructor: Boolean
        get() = name == "<init>"

    val isStatic: Boolean
        get() = accessFlags and ACC_STATIC != 0

    val isCompilerGenerated: Boolean
        get() = accessFlags and (ACC_SYNTHETIC or ACC_BRIDGE) != 0
}

private data class RecordComponentMetadata(
    val name: String,
    val descriptor: String,
    val javaType: String
)

private data class FieldMetadata(
    val accessFlags: Int,
    val name: String,
    val descriptor: String,
    val hasConstantValue: Boolean
) {
    val isStatic: Boolean
        get() = accessFlags and ACC_STATIC != 0

    val isFinal: Boolean
        get() = accessFlags and ACC_FINAL != 0

    val isPrivateFinal: Boolean
        get() = (accessFlags and (ACC_PRIVATE or ACC_FINAL)) == (ACC_PRIVATE or ACC_FINAL)

    val isCompileTimeConstant: Boolean
        get() = isStatic && isFinal && hasConstantValue && descriptor in ConstantValueDescriptors

    val isCompilerGenerated: Boolean
        get() = accessFlags and ACC_SYNTHETIC != 0
}

private data class ReportedMethodSignature(
    val returnType: String,
    val name: String,
    val parameterTypes: List<String>
)

private data class ReportedConstructorSignature(
    val parameterTypes: List<String>
)

private data class ReportedFieldSignature(
    val type: String,
    val name: String
)

private data class FxmlRoot(
    val binaryName: String,
    val methods: Set<String>,
    val fields: Set<String>
)

private data class DeadType(
    val sourceRelativePath: String,
    val name: String,
    val declarationKind: DeclarationKind,
    val nestingKind: NestingKind
)

private data class DeadMember(
    val sourceRelativePath: String,
    val name: String
)

private data class DeadCodeFindings(
    val deadFiles: List<String>,
    val deadTypes: List<DeadType>,
    val deadConstructors: List<DeadMember>,
    val deadMethods: List<DeadMember>,
    val deadFields: List<DeadMember>
) {
    fun hasFailures(): Boolean =
        deadFiles.isNotEmpty()
                || deadTypes.isNotEmpty()
                || deadConstructors.isNotEmpty()
                || deadMethods.isNotEmpty()
                || deadFields.isNotEmpty()

    fun render(): String = buildString {
        appendLine("# Dead Code Report")
        appendLine()
        appendLine("Files: ${deadFiles.size}")
        appendLine("Types: ${deadTypes.size}")
        appendLine("Constructors: ${deadConstructors.size}")
        appendLine("Methods: ${deadMethods.size}")
        appendLine("Fields: ${deadFields.size}")
        appendLine()
        appendSection("Dead Files", deadFiles)
        appendSection("Dead Types", deadTypes.map { deadType ->
            "${deadType.sourceRelativePath} :: ${deadType.declarationLabel} ${deadType.name}"
        })
        appendSection("Dead Constructors", deadConstructors.map { "${it.sourceRelativePath} :: ${it.name}" })
        appendSection("Dead Methods", deadMethods.map { "${it.sourceRelativePath} :: ${it.name}" })
        appendSection("Dead Fields", deadFields.map { "${it.sourceRelativePath} :: ${it.name}" })
    }

    private fun StringBuilder.appendSection(title: String, items: List<String>) {
        appendLine("## $title")
        if (items.isEmpty()) {
            appendLine("none")
        } else {
            items.forEach { item -> appendLine(item) }
        }
        appendLine()
    }
}

private val DeadType.declarationLabel: String
    get() {
        val baseLabel = declarationKind.label
        return when (nestingKind) {
            NestingKind.TOP_LEVEL -> baseLabel
            NestingKind.NESTED -> "nested $baseLabel"
            NestingKind.LOCAL -> "local $baseLabel"
        }
    }

private enum class DeclarationKind(val label: String) {
    CLASS("class"),
    ABSTRACT_CLASS("abstract class"),
    INTERFACE("interface"),
    ANNOTATION("annotation"),
    ENUM("enum"),
    RECORD("record")
}

private enum class NestingKind {
    TOP_LEVEL,
    NESTED,
    LOCAL
}

private enum class ContributionKind {
    SHELL,
    SERVICE
}

private data class ConstantPool(
    private val utf8Entries: Array<String?>,
    private val classNameIndexes: IntArray
) {
    fun utf8(index: Int): String? = utf8Entries.getOrNull(index)

    fun utf8OrNull(index: Int): String? =
        utf8(index)?.takeIf(String::isNotBlank)

    fun className(index: Int): String? {
        if (index <= 0 || index >= classNameIndexes.size) {
            return null
        }
        val nameIndex = classNameIndexes[index]
        return if (nameIndex <= 0) {
            null
        } else {
            utf8(nameIndex)
        }
    }

}

private class ContributionTypeInspector(
    private val classLoader: URLClassLoader
) {
    fun isConcreteShellContribution(binaryName: String): Boolean =
        isConcreteContribution(binaryName, shellContributionType)

    fun isConcreteServiceContribution(binaryName: String): Boolean =
        isConcreteContribution(binaryName, serviceContributionType)

    private val shellContributionType: Class<*>? = loadContractType("shell.api.ShellContribution")
    private val serviceContributionType: Class<*>? = loadContractType("shell.api.ServiceContribution")

    private fun loadContractType(contractTypeName: String): Class<*>? {
        return try {
            Class.forName(contractTypeName, false, classLoader)
        } catch (_: ReflectiveOperationException) {
            null
        } catch (_: LinkageError) {
            null
        }
    }

    private fun isConcreteContribution(binaryName: String, contractType: Class<*>?): Boolean {
        if (contractType == null) {
            return false
        }
        return try {
            val rawType = Class.forName(binaryName, false, classLoader)
            contractType.isAssignableFrom(rawType)
                    && !rawType.isInterface
                    && !java.lang.reflect.Modifier.isAbstract(rawType.modifiers)
                    && runCatching { rawType.getConstructor() }.isSuccess
        } catch (_: ReflectiveOperationException) {
            false
        } catch (_: LinkageError) {
            false
        }
    }
}

private const val ACC_PRIVATE = 0x0002
private const val ACC_STATIC = 0x0008
private const val ACC_FINAL = 0x0010
private const val ACC_BRIDGE = 0x0040
private const val ACC_ABSTRACT = 0x0400
private const val ACC_INTERFACE = 0x0200
private const val ACC_ANNOTATION = 0x2000
private const val ACC_ENUM = 0x4000
private const val ACC_SYNTHETIC = 0x1000
private val ConstantValueDescriptors = setOf("B", "C", "D", "F", "I", "J", "S", "Z", "Ljava/lang/String;")
private val AllowedExplicitKeepRuleOptions = listOf(
    "-keep ",
    "-keep,",
    "-keepclassmembers ",
    "-keepclassmembers,",
    "-keepclasseswithmembers ",
    "-keepclasseswithmembers,",
    "-keepnames ",
    "-keepnames,",
    "-keepclassmembernames ",
    "-keepclassmembernames,",
    "-keepclasseswithmembernames ",
    "-keepclasseswithmembernames,"
)
private val CatchAllKeepTargetPattern = Regex("\\b(?:class|interface|enum|@interface)\\s+\\*\\*?(?:\\s|\\{|$)")
private val CatchAllKeepMemberPattern = Regex("^(?:public |protected |private )?(?:static )?\\*\\s*;")
private val JavaIdentifierPattern = Regex("[A-Za-z_$][A-Za-z0-9_$]*")
private val JavaBinaryNamePattern = Regex("[A-Za-z_$][A-Za-z0-9_$]*(?:[.$][A-Za-z_$][A-Za-z0-9_$]*)*")
private val ReportedMethodModifiers = setOf(
    "public",
    "protected",
    "private",
    "static",
    "final",
    "synchronized",
    "bridge",
    "synthetic",
    "native",
    "abstract",
    "strictfp"
)
private val ReportedFieldModifiers = ReportedMethodModifiers + setOf("transient", "volatile")

private fun parseReportedMethod(member: String): ReportedMethodSignature? {
    val parametersStart = member.indexOf('(')
    val parametersEnd = member.lastIndexOf(')')
    if (parametersStart < 0 || parametersEnd < parametersStart) {
        return null
    }
    val prefixTokens = member.substring(0, parametersStart).trim().split(Regex("\\s+"))
    if (prefixTokens.size < 2) {
        return null
    }
    val methodName = prefixTokens.last()
    val returnType = prefixTokens
        .dropLast(1)
        .lastOrNull { token -> token !in ReportedMethodModifiers }
        ?: return null
    val parameterTypes = member.substring(parametersStart + 1, parametersEnd)
        .parameterTypes()
    return ReportedMethodSignature(returnType, methodName, parameterTypes)
}

private fun parseReportedConstructor(owner: String, member: String): ReportedConstructorSignature? {
    val parametersStart = member.indexOf('(')
    val parametersEnd = member.lastIndexOf(')')
    if (parametersStart < 0 || parametersEnd < parametersStart) {
        return null
    }
    val constructorName = member.substring(0, parametersStart).trim().substringAfterLast(' ')
    val ownerNames = setOf(owner.substringAfterLast('.'), owner.substringAfterLast('$'))
    if (constructorName !in ownerNames) {
        return null
    }
    return ReportedConstructorSignature(member.substring(parametersStart + 1, parametersEnd).parameterTypes())
}

private fun isPrivateNoArgConstructor(owner: String, member: String): Boolean {
    val constructor = parseReportedConstructor(owner, member) ?: return false
    return constructor.parameterTypes.isEmpty() && member.substringBefore('(').trim().split(Regex("\\s+")).contains("private")
}

private fun isObjectProtocolOverride(member: String): Boolean {
    return when (parseReportedMethod(member)) {
        ReportedMethodSignature("boolean", "equals", listOf("java.lang.Object")),
        ReportedMethodSignature("int", "hashCode", emptyList()),
        ReportedMethodSignature("java.lang.String", "toString", emptyList()) -> true
        else -> false
    }
}

private fun parseReportedField(member: String): ReportedFieldSignature? {
    val tokens = member.trim().split(Regex("\\s+"))
    if (tokens.size < 2 || '(' in member) {
        return null
    }
    val fieldName = tokens.last()
    val fieldType = tokens
        .dropLast(1)
        .lastOrNull { token -> token !in ReportedFieldModifiers }
        ?: return null
    return ReportedFieldSignature(fieldType, fieldName)
}

private fun MethodMetadata.toReportedSignature(): ReportedMethodSignature? {
    val descriptor = methodDescriptor(descriptor) ?: return null
    return ReportedMethodSignature(descriptor.returnType, name, descriptor.parameterTypes)
}

private fun FieldMetadata.toReportedSignature(): ReportedFieldSignature =
    ReportedFieldSignature(javaType(descriptor), name)

private fun String.parameterTypes(): List<String> {
    return trim()
        .takeIf(String::isNotBlank)
        ?.split(',')
        ?.map(String::trim)
        .orEmpty()
}

private fun List<RecordComponentMetadata>.constructorDescriptor(): String {
    return joinToString(prefix = "(", postfix = ")V", separator = "") { component -> component.descriptor }
}

private fun ByteArray.contentEquals(expected: ByteArray, maskIndexes: Set<Int>): Boolean {
    if (size != expected.size) {
        return false
    }
    return indices.all { index -> index in maskIndexes || this[index] == expected[index] }
}

private data class ParsedMethodDescriptor(
    val parameterTypes: List<String>,
    val returnType: String
)

private fun methodDescriptor(descriptor: String): ParsedMethodDescriptor? {
    if (!descriptor.startsWith('(')) {
        return null
    }
    val parameterTypes = mutableListOf<String>()
    var index = 1
    while (index < descriptor.length && descriptor[index] != ')') {
        val parsed = parseJavaType(descriptor, index) ?: return null
        parameterTypes += parsed.first
        index = parsed.second
    }
    if (index >= descriptor.length || descriptor[index] != ')') {
        return null
    }
    val returnType = parseJavaType(descriptor, index + 1)?.first ?: return null
    return ParsedMethodDescriptor(parameterTypes, returnType)
}

private fun javaType(descriptor: String): String {
    return parseJavaType(descriptor, 0)?.first.orEmpty()
}

private fun parseJavaType(descriptor: String, startIndex: Int): Pair<String, Int>? {
    var index = startIndex
    var arrayDepth = 0
    while (index < descriptor.length && descriptor[index] == '[') {
        arrayDepth += 1
        index += 1
    }
    if (index >= descriptor.length) {
        return null
    }
    val baseType = when (descriptor[index]) {
        'B' -> "byte" to index + 1
        'C' -> "char" to index + 1
        'D' -> "double" to index + 1
        'F' -> "float" to index + 1
        'I' -> "int" to index + 1
        'J' -> "long" to index + 1
        'S' -> "short" to index + 1
        'Z' -> "boolean" to index + 1
        'V' -> "void" to index + 1
        'L' -> {
            val endIndex = descriptor.indexOf(';', startIndex = index)
            if (endIndex < 0) {
                return null
            }
            descriptor.substring(index + 1, endIndex).replace('/', '.') to endIndex + 1
        }
        else -> return null
    }
    return baseType.first + "[]".repeat(arrayDepth) to baseType.second
}

private fun Path.invariantPath(): String = toString().replace(File.separatorChar, '/')

private fun File.invariantPath(): String = path.replace(File.separatorChar, '/')
