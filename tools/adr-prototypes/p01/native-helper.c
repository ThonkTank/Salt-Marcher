#define _GNU_SOURCE
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <linux/fs.h>
#include <linux/openat2.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>

#define MAX_DATA (16U * 1024U * 1024U)
#define MAX_PATH_BYTES 1024U

static int rootfd = -1;
static struct stat root_identity;
static unsigned long counter = 0;
static char fault_phase[64] = "";

static int open_relative(int directory, const char *name, int flags, mode_t mode) {
  struct open_how how = {
    .flags = (uint64_t)(flags | O_NOFOLLOW | O_CLOEXEC),
    .mode = mode,
    .resolve = RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS | RESOLVE_NO_MAGICLINKS,
  };
  return (int)syscall(SYS_openat2, directory, name, &how, sizeof(how));
}

static int root_unchanged(void) {
  struct stat current;
  return fstat(rootfd, &current) == 0 && current.st_dev == root_identity.st_dev &&
    current.st_ino == root_identity.st_ino && S_ISDIR(current.st_mode);
}

static int safe_path(const char *path) {
  if (!path || !*path || strlen(path) >= MAX_PATH_BYTES || path[0] == '/' ||
      strchr(path, '\\') || strstr(path, "//")) return 0;
  const char *part = path;
  while (*part) {
    const char *slash = strchr(part, '/');
    size_t length = slash ? (size_t)(slash - part) : strlen(part);
    if (!length || (length == 1 && part[0] == '.') ||
        (length == 2 && part[0] == '.' && part[1] == '.')) return 0;
    if (!slash) break;
    part = slash + 1;
  }
  return 1;
}

static int open_parent(const char *path, char *base, size_t base_size) {
  if (!safe_path(path)) { errno = EINVAL; return -1; }
  const char *slash = strrchr(path, '/');
  const char *name = slash ? slash + 1 : path;
  if (!*name || strlen(name) >= base_size || !strncmp(name, ".h02-", 5)) {
    errno = EINVAL; return -1;
  }
  strcpy(base, name);
  if (!slash) return dup(rootfd);
  size_t length = (size_t)(slash - path);
  char parent[MAX_PATH_BYTES];
  memcpy(parent, path, length);
  parent[length] = 0;
  return open_relative(rootfd, parent, O_RDONLY | O_DIRECTORY, 0);
}

static int regular_identity(int fd, struct stat *identity) {
  if (fstat(fd, identity) != 0 || !S_ISREG(identity->st_mode) || identity->st_nlink != 1) {
    errno = EMLINK;
    return 0;
  }
  return 1;
}

static int same_identity(const struct stat *left, const struct stat *right) {
  return left->st_dev == right->st_dev && left->st_ino == right->st_ino &&
    left->st_mode == right->st_mode && left->st_nlink == right->st_nlink;
}

static int hex_value(char value) {
  if (value >= '0' && value <= '9') return value - '0';
  if (value >= 'a' && value <= 'f') return value - 'a' + 10;
  if (value >= 'A' && value <= 'F') return value - 'A' + 10;
  return -1;
}

static unsigned char *decode_hex(const char *text, size_t maximum, size_t *size) {
  if (!text || !strcmp(text, "-")) { *size = 0; return NULL; }
  size_t length = strlen(text);
  if ((length & 1U) || length / 2U > maximum) { errno = EINVAL; return (void *)-1; }
  unsigned char *result = malloc(length / 2U + 1U);
  if (!result) return (void *)-1;
  for (size_t index = 0; index < length; index += 2U) {
    int high = hex_value(text[index]), low = hex_value(text[index + 1U]);
    if (high < 0 || low < 0) { free(result); errno = EINVAL; return (void *)-1; }
    result[index / 2U] = (unsigned char)((high << 4) | low);
  }
  result[length / 2U] = 0;
  *size = length / 2U;
  return result;
}

static void print_hex(const unsigned char *value, size_t size) {
  static const char alphabet[] = "0123456789abcdef";
  for (size_t index = 0; index < size; index++) {
    putchar(alphabet[value[index] >> 4]);
    putchar(alphabet[value[index] & 15]);
  }
}

static int read_fd(int fd, unsigned char **value, size_t *size, struct stat *identity) {
  if (!regular_identity(fd, identity) || identity->st_size < 0 ||
      (uint64_t)identity->st_size > MAX_DATA) { errno = EFBIG; return -1; }
  *size = (size_t)identity->st_size;
  *value = malloc(*size + 1U);
  if (!*value) return -1;
  size_t offset = 0;
  while (offset < *size) {
    ssize_t count = read(fd, *value + offset, *size - offset);
    if (count <= 0) { free(*value); *value = NULL; return -1; }
    offset += (size_t)count;
  }
  (*value)[*size] = 0;
  return 0;
}

static int write_all(int fd, const unsigned char *value, size_t size) {
  size_t offset = 0;
  while (offset < size) {
    ssize_t count = write(fd, value + offset, size - offset);
    if (count <= 0) return -1;
    offset += (size_t)count;
  }
  return 0;
}

static void fail(const char *code) {
  printf("ERR %s %d\n", code, errno);
  fflush(stdout);
}

static void checkpoint(const char *phase) {
  if (strcmp(fault_phase, phase)) return;
  printf("CHECKPOINT %s\n", phase);
  fflush(stdout);
  _exit(90);
}

static void do_read(const char *path_hex) {
  size_t path_size = 0;
  unsigned char *path = decode_hex(path_hex, MAX_PATH_BYTES - 1U, &path_size);
  if (path == (void *)-1 || !path || !root_unchanged()) { free(path); fail("input"); return; }
  path[path_size] = 0;
  int fd = open_relative(rootfd, (char *)path, O_RDONLY, 0);
  if (fd < 0 && errno == ENOENT) { printf("OK READ -\n"); fflush(stdout); free(path); return; }
  unsigned char *value = NULL;
  size_t size = 0;
  struct stat identity;
  if (fd < 0 || read_fd(fd, &value, &size, &identity) != 0) {
    if (fd >= 0) close(fd);
    free(path); free(value); fail("read"); return;
  }
  close(fd);
  printf("OK READ ");
  print_hex(value, size);
  printf("\n");
  fflush(stdout);
  free(path); free(value);
}

static int verify_named_identity(int directory, const char *name, const struct stat *expected) {
  int fd = open_relative(directory, name, O_RDONLY, 0);
  struct stat actual;
  int valid = fd >= 0 && regular_identity(fd, &actual) && same_identity(&actual, expected);
  if (fd >= 0) close(fd);
  if (!valid) errno = ESTALE;
  return valid;
}

static void do_cas(const char *path_hex, const char *before_hex, const char *after_hex) {
  size_t path_size = 0, before_size = 0, after_size = 0;
  unsigned char *path = decode_hex(path_hex, MAX_PATH_BYTES - 1U, &path_size);
  unsigned char *before = decode_hex(before_hex, MAX_DATA, &before_size);
  unsigned char *after = decode_hex(after_hex, MAX_DATA, &after_size);
  int before_null = before_hex && !strcmp(before_hex, "-");
  int after_null = after_hex && !strcmp(after_hex, "-");
  if (path == (void *)-1 || before == (void *)-1 || after == (void *)-1 || !path ||
      !root_unchanged()) { free(path); free(before); free(after); fail("input"); return; }
  path[path_size] = 0;
  char base[256], temp[96];
  int parent = open_parent((char *)path, base, sizeof(base));
  if (parent < 0) { free(path); free(before); free(after); fail("parent"); return; }
  int current_fd = open_relative(parent, base, O_RDONLY, 0);
  unsigned char *current = NULL;
  size_t current_size = 0;
  struct stat current_identity;
  int current_exists = current_fd >= 0;
  if (current_exists && read_fd(current_fd, &current, &current_size, &current_identity) != 0) {
    close(current_fd); close(parent); free(path); free(before); free(after); free(current);
    fail("identity"); return;
  }
  if (current_fd >= 0) close(current_fd);
  if ((before_null && current_exists) || (!before_null && (!current_exists ||
      current_size != before_size || memcmp(current, before, before_size)))) {
    errno = EBUSY; close(parent); free(path); free(before); free(after); free(current);
    fail("conflict"); return;
  }
  if (after_null) {
    if (!current_exists) {
      printf("OK CAS\n"); fflush(stdout);
    } else {
      snprintf(temp, sizeof(temp), ".h02-%ld-%lu.delete", (long)getpid(), ++counter);
      if (syscall(SYS_renameat2, parent, base, parent, temp, RENAME_NOREPLACE) != 0 ||
          !verify_named_identity(parent, temp, &current_identity)) {
        fail("delete-capture");
      } else {
        checkpoint("after-capture");
        if (fsync(parent) != 0) fail("directory-sync");
        else {
          checkpoint("after-directory-sync");
          if (unlinkat(parent, temp, 0) != 0 || fsync(parent) != 0) fail("delete-cleanup");
          else { printf("OK CAS\n"); fflush(stdout); }
        }
      }
    }
    close(parent); free(path); free(before); free(after); free(current); return;
  }
  snprintf(temp, sizeof(temp), ".h02-%ld-%lu.tmp", (long)getpid(), ++counter);
  int temp_fd = open_relative(parent, temp, O_WRONLY | O_CREAT | O_EXCL, 0600);
  struct stat temp_identity;
  if (temp_fd < 0 || write_all(temp_fd, after, after_size) != 0 || fdatasync(temp_fd) != 0 ||
      !regular_identity(temp_fd, &temp_identity)) {
    if (temp_fd >= 0) close(temp_fd);
    unlinkat(parent, temp, 0);
    close(parent); free(path); free(before); free(after); free(current); fail("temp-sync"); return;
  }
  close(temp_fd);
  checkpoint("after-temp-sync");
  int published = 0;
  if (!current_exists) {
    if (syscall(SYS_renameat2, parent, temp, parent, base, RENAME_NOREPLACE) == 0 &&
        verify_named_identity(parent, base, &temp_identity)) published = 1;
  } else if (verify_named_identity(parent, base, &current_identity) &&
      syscall(SYS_renameat2, parent, temp, parent, base, RENAME_EXCHANGE) == 0) {
    if (verify_named_identity(parent, base, &temp_identity) &&
        verify_named_identity(parent, temp, &current_identity)) published = 1;
    else {
      syscall(SYS_renameat2, parent, temp, parent, base, RENAME_EXCHANGE);
      errno = ESTALE;
    }
  }
  if (!published) {
    unlinkat(parent, temp, 0);
    close(parent); free(path); free(before); free(after); free(current); fail("publish"); return;
  }
  checkpoint("after-publish");
  if (fsync(parent) != 0) fail("directory-sync");
  else {
    checkpoint("after-directory-sync");
    if (current_exists && unlinkat(parent, temp, 0) != 0) fail("old-cleanup");
    else if (fsync(parent) != 0) fail("cleanup-sync");
    else { printf("OK CAS\n"); fflush(stdout); }
  }
  close(parent); free(path); free(before); free(after); free(current);
}

int main(int argc, char **argv) {
  if (argc != 3 || strlen(argv[2]) < 24U || strlen(argv[2]) > 256U) return 64;
  rootfd = open(argv[1], O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
  if (rootfd < 0 || fstat(rootfd, &root_identity) != 0 || !S_ISDIR(root_identity.st_mode)) return 65;
  printf("READY %ld %s\n", (long)getpid(), argv[2]);
  fflush(stdout);
  char *line = NULL;
  size_t capacity = 0;
  while (getline(&line, &capacity, stdin) >= 0) {
    line[strcspn(line, "\r\n")] = 0;
    char *save = NULL;
    char *operation = strtok_r(line, " ", &save);
    char *first = strtok_r(NULL, " ", &save);
    char *second = strtok_r(NULL, " ", &save);
    char *third = strtok_r(NULL, " ", &save);
    if (!operation) continue;
    if (!strcmp(operation, "READ") && first && !second) do_read(first);
    else if (!strcmp(operation, "CAS") && first && second && third && !strtok_r(NULL, " ", &save))
      do_cas(first, second, third);
    else if (!strcmp(operation, "FAULT") && first && !second && strlen(first) < sizeof(fault_phase)) {
      strcpy(fault_phase, first); printf("OK FAULT\n"); fflush(stdout);
    } else if (!strcmp(operation, "QUIT") && !first) break;
    else { errno = EINVAL; fail("operation"); }
  }
  free(line);
  close(rootfd);
  return 0;
}
