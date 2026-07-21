import { writeFileSync, renameSync } from "fs";

// Atomic write: write to a temp file then rename over the target. rename(2) is
// atomic on POSIX filesystems, so concurrent readers never observe a partial
// write (the class of corruption multiple uncoordinated writers risk here).
// ponytail: this does NOT prevent lost updates from concurrent read-modify-write
// (two writers racing can still clobber each other's changes) — add file
// locking if that starts causing real data loss.
//
// Copied standalone alongside statusline.js / hooks/*.js into
// ~/.vibenotifications/core/ (see core/hooks.js installHooks) so relative
// imports keep working outside the dev tree.
export function atomicWriteFileSync(path, data, options = {}) {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, data, options);
  renameSync(tmp, path);
}
