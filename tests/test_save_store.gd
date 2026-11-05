extends SceneTree
## Run with Godot 4.7.2: --headless --path . --script tests/test_save_store.gd
## This native test was provided, NOT executed in the assistant's environment.
const Store := preload("res://scripts/save_store.gd")
var failed := 0
var checks := 0
var root_dir := ""

func expect(ok: bool, message: String) -> void:
    checks += 1
    if not ok:
        failed += 1
        printerr("FAIL: ", message)

func write_raw(name: String, text: String) -> void:
    var f := FileAccess.open(root_dir + name, FileAccess.WRITE)
    expect(f != null, "test file open")
    if f != null:
        f.store_string(text)
        f.close()

func _init() -> void:
    root_dir = "user://qa-save-%d/" % OS.get_process_id()
    var store := Store.new(root_dir)
    expect(store.load_game().status == "new", "new game")
    var d: Dictionary = Store.defaults()
    expect(store.save_game(d) == OK, "first save")
    d.coins = 120
    expect(store.save_game(d) == OK, "second save")
    expect(store.load_game().data.coins == 120, "latest value")
    write_raw(Store.MAIN, "{truncated")
    var recovered: Dictionary = store.load_game()
    expect(recovered.status == "recovered", "corruption falls back to backup")
    expect(recovered.data.coins == 60, "previous good value survives")
    expect(store.save_game(recovered.data) == OK, "repair without clobbering backup")
    var bad := {"character":"../../secrets", "name":"\\u0000", "level":999999, "coins":-6, "zone":500, "hp":INF, "speed":[], "skills":{}, "attack":"a", "first_run":"false", "new_field":123, "hunt":true}
    var clean: Dictionary = Store.sanitize(bad)
    expect(clean.character == "z_rabbit", "path-like pet identifier rejected")
    expect(clean.level == 20 and clean.xp == 0, "level cap")
    expect(clean.coins == 0 and clean.speed == 1, "bounds and types")
    expect(clean.attack == 7 and clean.skills == 0, "bad stat types")
    expect(not clean.hunt and clean.first_run, "boolean validation; no auto hunting")
    expect(not clean.has("new_field"), "unknown keys discarded")
    expect(Store.sanitize({"level":1, "zone":3}).zone == 0, "locked zone")
    expect(Store.sanitize({"name":"x".repeat(400)}).name.length() == 24, "name bound")
    expect(Store.sanitize({"hp":NAN}).hp == 60, "NaN rejected")
    expect(Store.sanitize({"speed":INF}).speed == 1, "infinite number rejected")
    var before := FileAccess.get_sha256(root_dir + Store.MAIN)
    expect(store.begin_new_game() == OK, "explicit reset")
    expect(FileAccess.get_sha256(root_dir + Store.RESET_BACKUP) == before, "pre-reset byte copy")
    expect(store.load_game().data.coins == 60, "reset value")
    write_raw(Store.MAIN, JSON.stringify({"schema":999, "character":"z_rat", "level":1}))
    before = FileAccess.get_sha256(root_dir + Store.MAIN)
    expect(store.load_game().status == "blocked", "future schema blocked")
    expect(store.save_game(d) == ERR_UNAUTHORIZED, "future data never overwritten")
    expect(store.begin_new_game() == ERR_UNAUTHORIZED, "future reset blocked")
    expect(FileAccess.get_sha256(root_dir + Store.MAIN) == before, "future data intact")
    write_raw(Store.MAIN, "x".repeat(Store.LIMIT_BYTES + 1))
    store = Store.new(root_dir)
    expect(store.load_game().status == "recovered", "oversized main recovers backup")
    expect(store.begin_new_game() == ERR_INVALID_DATA, "oversized reset fails closed")
    for file in [Store.MAIN, Store.BACKUP, Store.TEMP, Store.RESET_BACKUP, "backup.pending.json", "reset.pending.json"]:
        if FileAccess.file_exists(root_dir + file):
            DirAccess.remove_absolute(root_dir + file)
    write_raw(Store.MAIN, "not json")
    store = Store.new(root_dir)
    expect(store.load_game().status == "blocked", "unrecoverable save locks writes")
    expect(store.save_game(d) == ERR_UNAUTHORIZED, "no silent reset")
    expect(store.begin_new_game() == OK, "explicit reset preserves damaged main")
    for file in [Store.MAIN, Store.BACKUP, Store.TEMP, Store.RESET_BACKUP, "backup.pending.json", "reset.pending.json"]:
        if FileAccess.file_exists(root_dir + file):
            DirAccess.remove_absolute(root_dir + file)
    DirAccess.remove_absolute(root_dir)
    print("SAVE_TESTS checks=", checks, " failures=", failed)
    quit(0 if failed == 0 else 1)
