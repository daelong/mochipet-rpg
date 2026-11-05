extends RefCounted
## Atomic directory creation serializes instances without listening on any port.
## Invalid/stale metadata fails closed; no broad directory deletion is used.
const LOCK_DIR := "user://session.lock"
const OWNER := LOCK_DIR + "/owner.json"
var acquired := false

func acquire() -> bool:
    for attempt in range(2):
        var err := DirAccess.make_dir_absolute(LOCK_DIR)
        if err == OK:
            var f := FileAccess.open(OWNER, FileAccess.WRITE)
            if f == null:
                DirAccess.remove_absolute(LOCK_DIR)
                return false
            f.store_string(JSON.stringify({"pid":OS.get_process_id()}))
            f.flush()
            var write_err := f.get_error()
            f.close()
            if write_err != OK:
                DirAccess.remove_absolute(OWNER)
                DirAccess.remove_absolute(LOCK_DIR)
                return false
            acquired = true
            return true
        var previous := _owner_pid()
        if previous <= 0 or OS.is_process_running(previous):
            return false
        # Only our two known lock paths are removed. Never traverse contents.
        if DirAccess.remove_absolute(OWNER) != OK:
            return false
        if DirAccess.remove_absolute(LOCK_DIR) != OK:
            return false
    return false

func _owner_pid() -> int:
    var f := FileAccess.open(OWNER, FileAccess.READ)
    if f == null:
        return -1
    if f.get_length() > 1024:
        f.close()
        return -1
    var raw := f.get_as_text()
    f.close()
    var value: Variant = JSON.parse_string(raw)
    if not value is Dictionary:
        return -1
    var pid: Variant = value.get("pid")
    if typeof(pid) != TYPE_INT and typeof(pid) != TYPE_FLOAT:
        return -1
    if not is_finite(float(pid)) or float(pid) <= 0 or float(pid) > 2147483647:
        return -1
    return int(pid)

func release() -> void:
    if acquired and _owner_pid() == OS.get_process_id():
        DirAccess.remove_absolute(OWNER)
        DirAccess.remove_absolute(LOCK_DIR)
    acquired = false
