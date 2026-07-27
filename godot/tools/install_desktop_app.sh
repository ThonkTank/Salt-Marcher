#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing to install a dirty worktree; commit the verified Godot state first." >&2
  exit 1
fi

commit_hash="$(git rev-parse HEAD)"
data_home="${XDG_DATA_HOME:-${HOME}/.local/share}"
install_root="${SALTMARCHER_GODOT_INSTALL_ROOT:-${data_home}/saltmarcher-godot}"
version_root="${install_root}/versions/${commit_hash}"
applications_root="${data_home}/applications"
desktop_file="${applications_root}/saltmarcher-godot.desktop"

mkdir -p "${install_root}/versions" "$applications_root"
if [[ ! -d "$version_root" ]]; then
  staging_root="$(mktemp -d "${install_root}/versions/.install-${commit_hash}.XXXXXX")"
  cleanup() {
    rm -rf "$staging_root"
  }
  trap cleanup EXIT
  archive_path="${staging_root}/project.tar"
  git archive --format=tar --output="$archive_path" HEAD \
    project.godot godot resources/icons/salt-marcher.png
  mkdir -p "${staging_root}/project"
  tar -xf "$archive_path" -C "${staging_root}/project"
  rm -f "$archive_path"
  printf '%s\n' "$commit_hash" > "${staging_root}/COMMIT"
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    'set -euo pipefail' \
    'version_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"' \
    'exec godot --path "${version_root}/project" "$@"' \
    > "${staging_root}/launch.sh"
  chmod +x "${staging_root}/launch.sh"
  mv "$staging_root" "$version_root"
  trap - EXIT
fi

ln -sfn "$version_root" "${install_root}/current"
desktop_exec="${install_root}/current/launch.sh"
desktop_icon="${install_root}/current/project/resources/icons/salt-marcher.png"
printf '%s\n' \
  '[Desktop Entry]' \
  'Type=Application' \
  'Version=1.0' \
  'Name=SaltMarcher (Godot development)' \
  'Comment=Local-first tabletop Campaign tool' \
  "Exec=\"${desktop_exec}\"" \
  "Icon=${desktop_icon}" \
  'Terminal=false' \
  'Categories=Utility;' \
  'StartupNotify=true' \
  > "$desktop_file"
chmod +x "$desktop_file"

if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate "$desktop_file"
fi

installed_hash="$(<"${install_root}/current/COMMIT")"
if [[ "$installed_hash" != "$commit_hash" ]]; then
  echo "Installed commit readback mismatch." >&2
  exit 1
fi

echo "Installed SaltMarcher Godot commit ${installed_hash}"
echo "Launcher: ${desktop_exec}"
echo "Desktop entry: ${desktop_file}"
