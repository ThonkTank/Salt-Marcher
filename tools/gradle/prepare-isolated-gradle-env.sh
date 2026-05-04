saltmarcher_is_nonblank() {
    [ -n "${1:-}" ]
}

saltmarcher_first_nonblank() {
    for candidate in "$@"; do
        if saltmarcher_is_nonblank "$candidate"; then
            printf '%s' "$candidate"
            return 0
        fi
    done
    return 1
}

saltmarcher_sanitized_segment() {
    raw_value=$1
    sanitized_value=$(
        printf '%s' "$raw_value" |
            LC_ALL=C tr -cs 'A-Za-z0-9._-' '-' |
            cut -c1-48 |
            sed 's/^[._-]*//; s/[._-]*$//'
    )
    [ -n "$sanitized_value" ] || sanitized_value=agent
    checksum_value=$(printf '%s' "$raw_value" | cksum | awk '{print $1}')
    printf '%s-%s' "$sanitized_value" "$checksum_value"
}

saltmarcher_copy_tree() {
    source_path=$1
    target_path=$2

    rm -rf "$target_path"
    mkdir -p "$(dirname "$target_path")"
    cp -R "$source_path" "$target_path"
    rm -rf \
        "$target_path/build" \
        "$target_path/.gradle" \
        "$target_path/.kotlin"
    find "$target_path" \
        \( -name build -o -name .gradle -o -name .kotlin \) \
        -type d -prune -exec rm -rf {} +
}

saltmarcher_require_local_socket_support() {
    if [ "${SALTMARCHER_SKIP_SOCKET_PREFLIGHT:-}" = "true" ]; then
        return 0
    fi
    if ! command -v python3 >/dev/null 2>&1; then
        return 0
    fi

    if python3 - <<'PY' 2>/dev/null
import socket
import sys

for address in ("0.0.0.0", "127.0.0.1"):
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind((address, 0))
    except OSError:
        sys.exit(1)
    finally:
        if sock is not None:
            sock.close()
PY
    then
        return 0
    fi

    cat >&2 <<'EOF'
SaltMarcher Gradle runtime preflight failed before Gradle startup.
This environment cannot open the local IPv4 sockets Gradle needs for its file-lock coordination services.
The build would otherwise fail later with an internal startup error such as:
  Could not determine a usable wildcard IP for this machine.
Run outside the restricted sandbox or set SALTMARCHER_SKIP_SOCKET_PREFLIGHT=true only if you intentionally want to try the raw Gradle startup anyway.
EOF
    return 78
}

saltmarcher_seed_wrapper_distribution() {
    seed_gradle_home=$1
    isolated_gradle_home=$2
    wrapper_properties_file=$APP_HOME/gradle/wrapper/gradle-wrapper.properties

    [ -f "$wrapper_properties_file" ] || return 0
    [ "$seed_gradle_home" != "$isolated_gradle_home" ] || return 0

    distribution_url=$(
        sed -n 's/^distributionUrl=//p' "$wrapper_properties_file" |
            sed 's#\\:#:#g'
    )
    [ -n "$distribution_url" ] || return 0

    distribution_name=$(basename "$distribution_url" .zip)
    source_wrapper_dir=$seed_gradle_home/wrapper/dists/$distribution_name
    target_wrapper_dir=$isolated_gradle_home/wrapper/dists/$distribution_name
    temp_wrapper_dir=$target_wrapper_dir.tmp.$$

    [ -d "$source_wrapper_dir" ] || return 0
    [ -d "$target_wrapper_dir" ] && return 0

    rm -rf "$temp_wrapper_dir"
    mkdir -p "$(dirname "$target_wrapper_dir")"
    cp -R "$source_wrapper_dir" "$temp_wrapper_dir"
    find "$temp_wrapper_dir" -name '*.lck' -type f -delete
    rm -rf "$target_wrapper_dir"
    mv "$temp_wrapper_dir" "$target_wrapper_dir"
}

saltmarcher_seed_read_only_dependency_cache() {
    seed_gradle_home=$1
    read_only_dependency_cache_root=$2
    source_modules_dir=$seed_gradle_home/caches/modules-2
    target_modules_dir=$read_only_dependency_cache_root/modules-2
    temp_modules_dir=$target_modules_dir.tmp.$$

    [ -d "$source_modules_dir" ] || return 0
    [ -d "$target_modules_dir" ] && return 0

    rm -rf "$temp_modules_dir"
    mkdir -p "$read_only_dependency_cache_root"
    cp -R "$source_modules_dir" "$temp_modules_dir"
    find "$temp_modules_dir" \( -name '*.lock' -o -name 'gc.properties' \) -type f -delete
    rm -rf "$target_modules_dir"
    mv "$temp_modules_dir" "$target_modules_dir"
}

saltmarcher_seed_generated_gradle_api_jars() {
    seed_gradle_home=$1
    isolated_gradle_home=$2

    for source_generated_dir in "$seed_gradle_home"/caches/*/generated-gradle-jars; do
        [ -d "$source_generated_dir" ] || continue
        relative_generated_dir=${source_generated_dir#"$seed_gradle_home"/}
        target_generated_dir=$isolated_gradle_home/$relative_generated_dir
        temp_generated_dir=$target_generated_dir.tmp.$$

        [ -d "$target_generated_dir" ] && continue

        rm -rf "$temp_generated_dir"
        mkdir -p "$(dirname "$target_generated_dir")"
        cp -R "$source_generated_dir" "$temp_generated_dir"
        find "$temp_generated_dir" \( -name '*.lock' -o -name 'gc.properties' \) -type f -delete
        rm -rf "$target_generated_dir"
        mv "$temp_generated_dir" "$target_generated_dir"
    done
}

saltmarcher_property_value() {
    property_file=$1
    property_name=$2
    sed -n "s/^$property_name=//p" "$property_file" | head -n 1
}

saltmarcher_configuration_cache_flag_state() {
    configuration_cache_state=unset
    for arg in "$@"; do
        case "$arg" in
          --configuration-cache)
            configuration_cache_state=true
            ;;
          --no-configuration-cache)
            configuration_cache_state=false
            ;;
        esac
    done
    printf '%s' "$configuration_cache_state"
}

saltmarcher_csv_contains_exact() {
    csv_value=$1
    expected_value=$2

    old_ifs=$IFS
    IFS=','
    set -f
    set -- $csv_value
    set +f
    IFS=$old_ifs
    for candidate do
        trimmed_candidate=$(printf '%s' "$candidate" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
        [ "$trimmed_candidate" = "$expected_value" ] && return 0
    done
    return 1
}

saltmarcher_bundle_descriptor_metadata_for_task() {
    requested_task_name=${1##*:}
    match_count=0
    matched_bundle_id=
    matched_root_plugin_id=
    matched_jqassistant_scan_task_name=
    matched_jqassistant_analyze_task_name=

    if [ -f "${saltmarcher_enforcement_bundle_catalog:-}" ]; then
        bundle_ids=$(saltmarcher_property_value "$saltmarcher_enforcement_bundle_catalog" bundleIdsInOrder)
        old_ifs=$IFS
        IFS=','
        set -f
        set -- $bundle_ids
        set +f
        IFS=$old_ifs
        for bundle_id do
            task_names=$(saltmarcher_property_value "$saltmarcher_enforcement_bundle_catalog" "bundle.$bundle_id.taskNames")
            if ! saltmarcher_csv_contains_exact "$task_names" "$requested_task_name"; then
                continue
            fi
            match_count=$((match_count + 1))
            matched_bundle_id=$bundle_id
            matched_root_plugin_id=$(saltmarcher_property_value "$saltmarcher_enforcement_bundle_catalog" "bundle.$bundle_id.rootPluginId")
            matched_jqassistant_scan_task_name=$(saltmarcher_property_value "$saltmarcher_enforcement_bundle_catalog" "bundle.$bundle_id.jqassistant.scanTaskName")
            matched_jqassistant_analyze_task_name=$(saltmarcher_property_value "$saltmarcher_enforcement_bundle_catalog" "bundle.$bundle_id.jqassistant.analyzeTaskName")
        done
    else
        for descriptor_file in $(find "$APP_HOME/tools/quality" -name bundle.properties -type f -print); do
            descriptor_owned=$(saltmarcher_property_value "$descriptor_file" descriptorOwned)
            [ "$descriptor_owned" = true ] || continue

            task_names=$(saltmarcher_property_value "$descriptor_file" taskNames)
            if ! saltmarcher_csv_contains_exact "$task_names" "$requested_task_name"; then
                continue
            fi
            match_count=$((match_count + 1))
            matched_bundle_id=$(saltmarcher_property_value "$descriptor_file" bundleId)
            matched_root_plugin_id=$(saltmarcher_property_value "$descriptor_file" rootPluginId)
            matched_jqassistant_scan_task_name=$(saltmarcher_property_value "$descriptor_file" jqassistant.scanTaskName)
            matched_jqassistant_analyze_task_name=$(saltmarcher_property_value "$descriptor_file" jqassistant.analyzeTaskName)
        done
    fi

    [ "$match_count" -eq 1 ] || return 1
    printf '%s|%s|%s|%s\n' \
        "$matched_bundle_id" \
        "$matched_root_plugin_id" \
        "$matched_jqassistant_scan_task_name" \
        "$matched_jqassistant_analyze_task_name"
}

saltmarcher_safe_configuration_cache_surface() {
    non_option_task_count=0
    help_task_count=0
    task_selector_count=0
    requested_surface_tasks=
    skip_next=false
    pending_selector=

    for arg in "$@"; do
        if [ "$skip_next" = true ]; then
            case "$pending_selector" in
              --task)
                task_selector_count=$((task_selector_count + 1))
                ;;
            esac
            skip_next=false
            pending_selector=
            continue
        fi

        case "$arg" in
          --task)
            skip_next=true
            pending_selector=--task
            ;;
          --task=*)
            task_selector_count=$((task_selector_count + 1))
            ;;
          --*=*|-P*|-D*|-I*|-c*|-b*|-g*|-p*)
            ;;
          -*)
            ;;
          *)
            normalized_task_name=${arg##*:}
            non_option_task_count=$((non_option_task_count + 1))
            if [ "$normalized_task_name" = help ]; then
                help_task_count=$((help_task_count + 1))
            else
                if [ -n "$requested_surface_tasks" ]; then
                    requested_surface_tasks=$requested_surface_tasks"
$normalized_task_name"
                else
                    requested_surface_tasks=$normalized_task_name
                fi
            fi
            ;;
        esac
    done

    if [ "$non_option_task_count" -eq 1 ] && [ "$help_task_count" -eq 1 ] && [ "$task_selector_count" -eq 1 ]; then
        return 0
    fi

    [ "$task_selector_count" -eq 0 ] || return 1
    [ -n "$requested_surface_tasks" ] || return 1

    while IFS= read -r requested_task_name; do
        [ -n "$requested_task_name" ] || continue
        if [ "$requested_task_name" = checkDocumentationEnforcement ]; then
            continue
        fi

        case "$requested_task_name" in
          check*Enforcement)
            bundle_descriptor_metadata=$(saltmarcher_bundle_descriptor_metadata_for_task "$requested_task_name") || return 1
            bundle_root_plugin_id=$(printf '%s' "$bundle_descriptor_metadata" | cut -d '|' -f 2)
            bundle_jqassistant_scan_task_name=$(printf '%s' "$bundle_descriptor_metadata" | cut -d '|' -f 3)
            bundle_jqassistant_analyze_task_name=$(printf '%s' "$bundle_descriptor_metadata" | cut -d '|' -f 4)
            [ -z "$bundle_root_plugin_id" ] || return 1
            [ -z "$bundle_jqassistant_scan_task_name$bundle_jqassistant_analyze_task_name" ] || return 1
            ;;
          *)
            return 1
            ;;
        esac
    done <<EOF
$requested_surface_tasks
EOF

    return 0
}

saltmarcher_should_auto_configuration_cache() {
    configuration_cache_state=$(saltmarcher_configuration_cache_flag_state "$@")
    [ "$configuration_cache_state" = unset ] || return 1
    saltmarcher_safe_configuration_cache_surface "$@"
}

saltmarcher_configuration_cache_enabled() {
    configuration_cache_state=$(saltmarcher_configuration_cache_flag_state "$@")
    case "$configuration_cache_state" in
      true)
        return 0
        ;;
      false)
        return 1
        ;;
      *)
        saltmarcher_should_auto_configuration_cache "$@"
        ;;
    esac
}

saltmarcher_requested_work_signature() {
    saltmarcher_skip_next=false
    saltmarcher_pending_selector=

    {
        for arg do
            if [ "$saltmarcher_skip_next" = true ]; then
                case "$saltmarcher_pending_selector" in
                  -x|--exclude-task)
                    printf 'exclude:%s\n' "$arg"
                    ;;
                  --task)
                    printf 'task-help:%s\n' "$arg"
                    ;;
                esac
                saltmarcher_skip_next=false
                saltmarcher_pending_selector=
                continue
            fi

            case "$arg" in
              -x|--exclude-task|--task)
                saltmarcher_skip_next=true
                saltmarcher_pending_selector=$arg
                ;;
              --*=*|-P*|-D*|-I*|-c*|-b*|-g*|-p*)
                ;;
              -*)
                ;;
              *)
                printf 'task:%s\n' "$arg"
                ;;
            esac
        done
    } | LC_ALL=C sort -u | paste -sd ',' -
}

saltmarcher_compute_tooling_snapshot_key() {
    (
        cd "$APP_HOME" || exit 1
        find \
            gradlew \
            gradle.properties \
            settings.gradle.kts \
            tools/gradle/prepare-isolated-gradle-env.sh \
            tools/gradle/saltmarcher-isolation.init.gradle.kts \
            tools/gradle/build-logic-settings \
            tools/gradle/build-logic \
            tools/gradle/build-harness \
            tools/quality/rules/quality-rules \
            tools/quality/incubator/quality-rules-errorprone \
            \( -path '*/build/*' -o -path '*/.gradle/*' -o -path '*/.kotlin/*' \) -prune -o \
            -type f -print |
            LC_ALL=C sort |
            while IFS= read -r relative_path; do
                cksum "$relative_path"
            done |
            cksum |
            awk '{print $1}'
    )
}

saltmarcher_compute_descriptor_snapshot_key() {
    (
        cd "$APP_HOME" || exit 1
        find \
            tools/quality \
            \( -path '*/build/*' -o -path '*/.gradle/*' -o -path '*/.kotlin/*' \) -prune -o \
            -type f -name bundle.properties -print |
            LC_ALL=C sort |
            while IFS= read -r relative_path; do
                cksum "$relative_path"
            done |
            cksum |
            awk '{print $1}'
    )
}

saltmarcher_canonical_existing_path() {
    existing_path=$1

    if [ -d "$existing_path" ]; then
        (
            cd "$existing_path" 2>/dev/null && pwd -P
        )
        return
    fi

    existing_dir=$(dirname "$existing_path")
    existing_base=$(basename "$existing_path")
    (
        cd "$existing_dir" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$existing_base"
    )
}

saltmarcher_resolve_descriptor_path() {
    descriptor_file=$1
    raw_path=$2
    trimmed_path=$(printf '%s' "$raw_path" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')

    if [ -z "$trimmed_path" ]; then
        printf '%s' ""
        return 0
    fi

    descriptor_dir=$(dirname "$descriptor_file")
    stripped_legacy_prefix=$(printf '%s' "$trimmed_path" | sed 's#^\.\./\.\./##')

    candidate_paths=
    if [ "${trimmed_path#/}" != "$trimmed_path" ]; then
        candidate_paths=$trimmed_path
    fi
    candidate_paths=$candidate_paths"
$APP_HOME/$trimmed_path
$descriptor_dir/$trimmed_path"
    case "$trimmed_path" in
      ../../*)
        candidate_paths=$candidate_paths"
$APP_HOME/tools/$stripped_legacy_prefix
$APP_HOME/tools/quality/$stripped_legacy_prefix"
        ;;
    esac

    while IFS= read -r candidate_path; do
        [ -n "$candidate_path" ] || continue
        if [ -e "$candidate_path" ]; then
            saltmarcher_canonical_existing_path "$candidate_path"
            return 0
        fi
    done <<EOF
$candidate_paths
EOF

    cat >&2 <<EOF
Could not resolve descriptor path '$trimmed_path' from $descriptor_file.
Tried:
$(printf '%s\n' "$candidate_paths" | sed '/^$/d')
EOF
    return 1
}

saltmarcher_normalize_catalog_value() {
    descriptor_file=$1
    descriptor_key=$2
    descriptor_value=$3

    case "$descriptor_key" in
      buildHarnessSourceDir|errorProneSourceDir|errorProneServiceFile|pmdSourceDir|jqassistant.config|jqassistant.rulesDir|pmd.ruleset)
        saltmarcher_resolve_descriptor_path "$descriptor_file" "$descriptor_value"
        ;;
      archunit.sourceDirs)
        normalized_values=
        old_ifs=$IFS
        IFS=','
        set -f
        set -- $descriptor_value
        set +f
        IFS=$old_ifs
        for raw_item do
            trimmed_item=$(printf '%s' "$raw_item" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
            [ -n "$trimmed_item" ] || continue
            normalized_item=$(saltmarcher_resolve_descriptor_path "$descriptor_file" "$trimmed_item") || return 1
            if [ -n "$normalized_values" ]; then
                normalized_values=$normalized_values,$normalized_item
            else
                normalized_values=$normalized_item
            fi
        done
        printf '%s' "$normalized_values"
        ;;
      *)
        printf '%s' "$descriptor_value"
        ;;
    esac
}

saltmarcher_write_bundle_catalog() {
    catalog_file=$1
    temp_catalog_file=$catalog_file.tmp.$$
    temp_descriptor_index=$catalog_file.descriptors.tmp.$$
    temp_sorted_descriptor_index=$catalog_file.descriptors.sorted.tmp.$$

    rm -f "$temp_catalog_file" "$temp_descriptor_index" "$temp_sorted_descriptor_index"
    mkdir -p "$(dirname "$catalog_file")"

    find "$APP_HOME/tools/quality" -name bundle.properties -type f | while IFS= read -r descriptor_file; do
        descriptor_owned=$(saltmarcher_property_value "$descriptor_file" descriptorOwned)
        [ "$descriptor_owned" = true ] || continue

        bundle_id=$(saltmarcher_property_value "$descriptor_file" bundleId)
        order=$(saltmarcher_property_value "$descriptor_file" order)
        [ -n "$bundle_id" ] || continue
        [ -n "$order" ] || continue
        printf '%s|%s|%s\n' "$order" "$bundle_id" "$descriptor_file" >> "$temp_descriptor_index"
    done

    sort -t '|' -k1,1n -k2,2 "$temp_descriptor_index" > "$temp_sorted_descriptor_index"

    bundle_ids_in_order=$(cut -d '|' -f2 "$temp_sorted_descriptor_index" | paste -sd ',' -)
    {
        while IFS='|' read -r order bundle_id descriptor_file; do
            task_names=$(saltmarcher_property_value "$descriptor_file" taskNames)

            normalized_descriptor_file=$(saltmarcher_canonical_existing_path "$descriptor_file") || exit 1
            printf 'bundle.%s.descriptorFile=%s\n' "$bundle_id" "$normalized_descriptor_file"
            printf 'bundle.%s.order=%s\n' "$bundle_id" "$order"
            printf 'bundle.%s.taskNames=%s\n' "$bundle_id" "$task_names"
            while IFS= read -r descriptor_line; do
                case "$descriptor_line" in
                  ''|\#*)
                    continue
                    ;;
                esac
                descriptor_key=${descriptor_line%%=*}
                descriptor_value=${descriptor_line#*=}
                case "$descriptor_key" in
                  descriptorOwned|bundleId|order|taskNames)
                    continue
                    ;;
                esac
                normalized_descriptor_value=$(
                    saltmarcher_normalize_catalog_value "$descriptor_file" "$descriptor_key" "$descriptor_value"
                ) || exit 1
                printf 'bundle.%s.%s=%s\n' "$bundle_id" "$descriptor_key" "$normalized_descriptor_value"
            done < "$descriptor_file"
        done < "$temp_sorted_descriptor_index"
        printf 'bundleIdsInOrder=%s\n' "$bundle_ids_in_order"
    } > "$temp_catalog_file"

    mv "$temp_catalog_file" "$catalog_file"
    rm -f "$temp_descriptor_index" "$temp_sorted_descriptor_index"
}

saltmarcher_locate_java_cmd() {
    if [ -n "${JAVA_HOME:-}" ]; then
        if [ -x "$JAVA_HOME/jre/sh/java" ]; then
            printf '%s\n' "$JAVA_HOME/jre/sh/java"
            return 0
        fi
        if [ -x "$JAVA_HOME/bin/java" ]; then
            printf '%s\n' "$JAVA_HOME/bin/java"
            return 0
        fi
        cat >&2 <<EOF
ERROR: JAVA_HOME is set to an invalid directory: $JAVA_HOME
EOF
        return 1
    fi

    if command -v java >/dev/null 2>&1; then
        command -v java
        return 0
    fi

    cat >&2 <<'EOF'
ERROR: JAVA_HOME is not set and no 'java' command could be found in PATH.
EOF
    return 1
}

saltmarcher_publish_tooling_build() {
    build_dir=$1
    repository_dir=$2
    plugin_version=$3
    bootstrap_segment=$4
    java_cmd=$5

    bootstrap_path_segment=$(saltmarcher_sanitized_segment "$build_dir")
    bootstrap_project_cache_dir=$saltmarcher_run_root/tooling-plugin-bootstrap/project-cache/$bootstrap_path_segment
    bootstrap_build_root=$saltmarcher_run_root/tooling-plugin-bootstrap/build/$bootstrap_path_segment
    bootstrap_runtime_root=$saltmarcher_run_root/tooling-plugin-bootstrap/runtime/$bootstrap_path_segment
    bootstrap_kotlin_dir=$saltmarcher_run_root/tooling-plugin-bootstrap/kotlin/$bootstrap_path_segment
    bootstrap_invocation_id=$bootstrap_segment-$bootstrap_path_segment
    mkdir -p \
        "$bootstrap_project_cache_dir" \
        "$bootstrap_build_root" \
        "$bootstrap_runtime_root" \
        "$bootstrap_kotlin_dir"

    (
        cd "$build_dir" || exit 1
        SALTMARCHER_TOOLING_PLUGIN_BOOTSTRAP=true \
        SALTMARCHER_REPO_ROOT=$APP_HOME \
        SALTMARCHER_GRADLE_INVOCATION_ID=$bootstrap_invocation_id \
        SALTMARCHER_GRADLE_ISOLATED_BUILD_ROOT=$bootstrap_build_root \
        SALTMARCHER_GRADLE_ISOLATED_RUNTIME_ROOT=$bootstrap_runtime_root \
        SALTMARCHER_TOOLING_PLUGIN_REPO=$repository_dir \
        SALTMARCHER_TOOLING_PLUGIN_VERSION=$plugin_version \
        GRADLE_USER_HOME=$saltmarcher_isolated_gradle_home \
        "$java_cmd" \
            "-Dorg.gradle.appname=gradlew" \
            "-Dkotlin.project.persistent.dir=$bootstrap_kotlin_dir" \
            "-Dsaltmarcher.toolingPluginRepo=$repository_dir" \
            "-Dsaltmarcher.toolingPluginVersion=$plugin_version" \
            -classpath "$APP_HOME/gradle/wrapper/gradle-wrapper.jar" \
            org.gradle.wrapper.GradleWrapperMain \
            --no-daemon \
            --console=plain \
            -I "$APP_HOME/tools/gradle/saltmarcher-isolation.init.gradle.kts" \
            --project-cache-dir "$bootstrap_project_cache_dir" \
            -Porg.gradle.java.installations.auto-detect=false \
            publishAllPublicationsToSaltmarcherToolingRepository
    ) || {
        cat >&2 <<EOF
Failed to publish tooling plugins from $build_dir into $repository_dir.
EOF
        return 1
    }

    find "$build_dir" -maxdepth 1 -name .kotlin -type d -prune -exec rm -rf {} +
}

saltmarcher_materialize_tooling_plugin_repo() {
    repo_root=$1
    repo_dir=$2
    plugin_version=$3
    temp_repo_root=$repo_root.tmp.$$
    temp_repo_dir=$temp_repo_root/maven
    bootstrap_segment=$4

    [ -d "$repo_dir" ] && return 0

    rm -rf "$temp_repo_root"
    mkdir -p "$temp_repo_dir"

    java_cmd=$(saltmarcher_locate_java_cmd) || return 1
    saltmarcher_publish_tooling_build \
        "$APP_HOME/tools/gradle/build-logic-settings" \
        "$temp_repo_dir" \
        "$plugin_version" \
        "$bootstrap_segment" \
        "$java_cmd" || {
            rm -rf "$temp_repo_root"
            return 1
        }
    saltmarcher_publish_tooling_build \
        "$APP_HOME/tools/gradle/build-logic" \
        "$temp_repo_dir" \
        "$plugin_version" \
        "$bootstrap_segment" \
        "$java_cmd" || {
            rm -rf "$temp_repo_root"
            return 1
        }

    if mv -T "$temp_repo_root" "$repo_root" 2>/dev/null; then
        return 0
    fi

    rm -rf "$temp_repo_root"
}

saltmarcher_materialize_composite_snapshot() {
    snapshot_root=$1
    temp_snapshot_root=$snapshot_root.tmp.$$

    [ -d "$snapshot_root" ] && return 0

    rm -rf "$temp_snapshot_root"
    mkdir -p \
        "$temp_snapshot_root/tools/gradle" \
        "$temp_snapshot_root/tools/quality/rules" \
        "$temp_snapshot_root/tools/quality/incubator"
    saltmarcher_copy_tree \
        "$APP_HOME/tools/gradle/build-harness" \
        "$temp_snapshot_root/tools/gradle/build-harness"
    saltmarcher_copy_tree \
        "$APP_HOME/tools/quality/rules/quality-rules" \
        "$temp_snapshot_root/tools/quality/rules/quality-rules"
    saltmarcher_copy_tree \
        "$APP_HOME/tools/quality/incubator/quality-rules-errorprone" \
        "$temp_snapshot_root/tools/quality/incubator/quality-rules-errorprone"

    if mv -T "$temp_snapshot_root" "$snapshot_root" 2>/dev/null; then
        return 0
    fi

    rm -rf "$temp_snapshot_root"
}

saltmarcher_materialize_bundle_catalog_snapshot() {
    catalog_root=$1
    catalog_file=$2
    temp_catalog_root=$catalog_root.tmp.$$
    temp_catalog_file=$temp_catalog_root/$(basename "$catalog_file")

    [ -f "$catalog_file" ] && return 0

    rm -rf "$temp_catalog_root"
    mkdir -p "$temp_catalog_root"
    saltmarcher_write_bundle_catalog "$temp_catalog_file"

    if mv -T "$temp_catalog_root" "$catalog_root" 2>/dev/null; then
        return 0
    fi

    rm -rf "$temp_catalog_root"
}

saltmarcher_write_run_metadata() {
    run_meta_dir=$1
    run_stage=$2

    mkdir -p "$run_meta_dir"
    {
        printf 'rawIsolationId=%s\n' "$saltmarcher_raw_isolation_id"
        printf 'isolationSegment=%s\n' "$saltmarcher_isolation_segment"
        printf 'stage=%s\n' "$run_stage"
        printf 'createdAt=%s\n' "$(date -Iseconds)"
    } > "$run_meta_dir/run.properties"
}

saltmarcher_actor_id=$(
    saltmarcher_first_nonblank \
        "${SALTMARCHER_GRADLE_STAGE:-}" \
        "${SALTMARCHER_GRADLE_ISOLATION_ID:-}" \
        "${CODEX_THREAD_ID:-}" \
        local
) || saltmarcher_actor_id=local
saltmarcher_stage=$(
    saltmarcher_first_nonblank \
        "${SALTMARCHER_GRADLE_STAGE:-}" \
        default
) || saltmarcher_stage=default
saltmarcher_invocation_timestamp=$(date +%Y%m%dT%H%M%S%N 2>/dev/null || date +%Y%m%dT%H%M%S)
saltmarcher_raw_isolation_id=$(
    saltmarcher_first_nonblank \
        "${SALTMARCHER_GRADLE_INVOCATION_ID:-}" \
        "${saltmarcher_actor_id}-${saltmarcher_invocation_timestamp}-pid$$-ppid${PPID:-0}"
) || saltmarcher_raw_isolation_id="${saltmarcher_actor_id}-${saltmarcher_invocation_timestamp}-pid$$"
saltmarcher_isolation_segment=$(saltmarcher_sanitized_segment "$saltmarcher_raw_isolation_id")
saltmarcher_seed_gradle_home=${GRADLE_USER_HOME:-$HOME/.gradle}
saltmarcher_tooling_snapshot_key=$(saltmarcher_compute_tooling_snapshot_key)
saltmarcher_tooling_snapshot_segment=$(saltmarcher_sanitized_segment "tooling-$saltmarcher_tooling_snapshot_key")
saltmarcher_descriptor_snapshot_key=$(saltmarcher_compute_descriptor_snapshot_key)
saltmarcher_descriptor_snapshot_segment=$(saltmarcher_sanitized_segment "descriptor-$saltmarcher_descriptor_snapshot_key")
saltmarcher_requested_work_signature_value=$(saltmarcher_requested_work_signature "$@")
[ -n "$saltmarcher_requested_work_signature_value" ] || saltmarcher_requested_work_signature_value=no-requested-work
saltmarcher_requested_work_segment=$(saltmarcher_sanitized_segment "$saltmarcher_requested_work_signature_value")
saltmarcher_run_root=$APP_HOME/.gradle/isolated-runs/$saltmarcher_isolation_segment
saltmarcher_run_meta_dir=$saltmarcher_run_root/meta
saltmarcher_composite_root=$APP_HOME/.gradle/composite-snapshots/$saltmarcher_tooling_snapshot_segment
saltmarcher_tooling_plugin_repo_root=$APP_HOME/.gradle/tooling-plugin-repos/$saltmarcher_tooling_snapshot_segment
saltmarcher_tooling_plugin_repo=$saltmarcher_tooling_plugin_repo_root/maven
saltmarcher_tooling_plugin_version=$saltmarcher_tooling_snapshot_segment
saltmarcher_enforcement_bundle_catalog_root=$APP_HOME/.gradle/enforcement-bundle-catalog-snapshots/$saltmarcher_descriptor_snapshot_segment
saltmarcher_enforcement_bundle_catalog=$saltmarcher_enforcement_bundle_catalog_root/enforcement-bundle-catalog.properties
saltmarcher_shared_state_root=$APP_HOME/.gradle/shared-configuration-state/$saltmarcher_stage-$saltmarcher_requested_work_segment-$saltmarcher_tooling_snapshot_segment
saltmarcher_configuration_cache_warmup_locks_root=$APP_HOME/.gradle/configuration-cache-warmup-locks
saltmarcher_configuration_cache_warmup_lock_dir=$saltmarcher_configuration_cache_warmup_locks_root/$saltmarcher_stage-$saltmarcher_requested_work_segment-$saltmarcher_tooling_snapshot_segment
saltmarcher_configuration_cache_ready_marker=$saltmarcher_shared_state_root/configuration-cache-ready.marker
saltmarcher_auto_configuration_cache=false
if saltmarcher_should_auto_configuration_cache "$@"; then
    saltmarcher_auto_configuration_cache=true
fi
saltmarcher_configuration_cache_active=false
if saltmarcher_configuration_cache_enabled "$@"; then
    saltmarcher_configuration_cache_active=true
fi
if [ "$saltmarcher_configuration_cache_active" = true ]; then
    saltmarcher_exported_invocation_id=$saltmarcher_stage-$saltmarcher_tooling_snapshot_segment
    saltmarcher_exported_isolation_segment=$(saltmarcher_sanitized_segment "$saltmarcher_exported_invocation_id")
    saltmarcher_isolated_gradle_home=$saltmarcher_shared_state_root/gradle-user-home
    saltmarcher_isolated_runtime_root=$saltmarcher_shared_state_root/project-cache
    saltmarcher_isolated_build_root=$saltmarcher_shared_state_root/build
else
    saltmarcher_exported_invocation_id=$saltmarcher_raw_isolation_id
    saltmarcher_exported_isolation_segment=$saltmarcher_isolation_segment
    saltmarcher_isolated_gradle_home=$saltmarcher_run_root/gradle-user-home
    saltmarcher_isolated_runtime_root=$saltmarcher_run_root/project-cache
    saltmarcher_isolated_build_root=$saltmarcher_run_root/build
fi
saltmarcher_root_project_cache_dir=$saltmarcher_isolated_runtime_root/root
saltmarcher_read_only_dependency_cache_root=$APP_HOME/.gradle/read-only-dependency-cache
saltmarcher_latest_output_root=$APP_HOME/build/latest-output
saltmarcher_latest_reports_root=$APP_HOME/build/latest-reports
saltmarcher_retained_failures_root=$APP_HOME/build/retained-gradle-failures

saltmarcher_require_local_socket_support || return $?

mkdir -p \
    "$saltmarcher_isolated_gradle_home" \
    "$saltmarcher_isolated_runtime_root" \
    "$saltmarcher_isolated_build_root"
saltmarcher_seed_wrapper_distribution "$saltmarcher_seed_gradle_home" "$saltmarcher_isolated_gradle_home"
saltmarcher_seed_generated_gradle_api_jars "$saltmarcher_seed_gradle_home" "$saltmarcher_isolated_gradle_home"
if ! saltmarcher_is_nonblank "${GRADLE_RO_DEP_CACHE:-}"; then
    saltmarcher_seed_read_only_dependency_cache \
        "$saltmarcher_seed_gradle_home" \
        "$saltmarcher_read_only_dependency_cache_root"
fi
saltmarcher_materialize_composite_snapshot "$saltmarcher_composite_root"
saltmarcher_materialize_tooling_plugin_repo \
    "$saltmarcher_tooling_plugin_repo_root" \
    "$saltmarcher_tooling_plugin_repo" \
    "$saltmarcher_tooling_plugin_version" \
    "$saltmarcher_isolation_segment"
saltmarcher_materialize_bundle_catalog_snapshot \
    "$saltmarcher_enforcement_bundle_catalog_root" \
    "$saltmarcher_enforcement_bundle_catalog"
saltmarcher_write_run_metadata "$saltmarcher_run_meta_dir" "$saltmarcher_stage"

export GRADLE_USER_HOME=$saltmarcher_isolated_gradle_home
export SALTMARCHER_GRADLE_STAGE=$saltmarcher_stage
export SALTMARCHER_GRADLE_INVOCATION_ID=$saltmarcher_exported_invocation_id
export SALTMARCHER_INCLUDED_BUILD_ROOT=$saltmarcher_composite_root
export SALTMARCHER_TOOLING_PLUGIN_REPO=$saltmarcher_tooling_plugin_repo
export SALTMARCHER_TOOLING_PLUGIN_VERSION=$saltmarcher_tooling_plugin_version
export SALTMARCHER_REPO_ROOT=$APP_HOME
export SALTMARCHER_GRADLE_ISOLATION_SEGMENT=$saltmarcher_exported_isolation_segment
export SALTMARCHER_GRADLE_RUN_ROOT=$saltmarcher_run_root
export SALTMARCHER_GRADLE_RUN_META_DIR=$saltmarcher_run_meta_dir
export SALTMARCHER_GRADLE_ISOLATED_USER_HOME=$saltmarcher_isolated_gradle_home
export SALTMARCHER_GRADLE_ISOLATED_RUNTIME_ROOT=$saltmarcher_isolated_runtime_root
export SALTMARCHER_GRADLE_ROOT_PROJECT_CACHE_DIR=$saltmarcher_root_project_cache_dir
export SALTMARCHER_GRADLE_ISOLATED_BUILD_ROOT=$saltmarcher_isolated_build_root
export SALTMARCHER_GRADLE_LATEST_OUTPUT_ROOT=$saltmarcher_latest_output_root
export SALTMARCHER_GRADLE_LATEST_REPORTS_ROOT=$saltmarcher_latest_reports_root
export SALTMARCHER_GRADLE_RETAINED_FAILURES_ROOT=$saltmarcher_retained_failures_root
export SALTMARCHER_ENFORCEMENT_BUNDLE_CATALOG=$saltmarcher_enforcement_bundle_catalog
export SALTMARCHER_GRADLE_AUTO_CONFIGURATION_CACHE=$saltmarcher_auto_configuration_cache
export SALTMARCHER_GRADLE_CONFIGURATION_CACHE_ACTIVE=$saltmarcher_configuration_cache_active
export SALTMARCHER_GRADLE_CONFIGURATION_CACHE_READY_MARKER=$saltmarcher_configuration_cache_ready_marker
export SALTMARCHER_GRADLE_CONFIGURATION_CACHE_WARMUP_LOCK_DIR=$saltmarcher_configuration_cache_warmup_lock_dir
if ! saltmarcher_is_nonblank "${GRADLE_RO_DEP_CACHE:-}" \
    && [ -d "$saltmarcher_read_only_dependency_cache_root/modules-2" ]; then
    export GRADLE_RO_DEP_CACHE=$saltmarcher_read_only_dependency_cache_root
fi
