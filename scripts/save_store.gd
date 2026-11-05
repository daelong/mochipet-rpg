extends RefCounted
## Bounded JSON only. Never deserializes objects, runs commands, or accepts paths
## from a save file. Backups reduce risk; this is NOT a power-loss guarantee.

const SCHEMA := 1
const LIMIT_BYTES := 65536
const MAIN := "save.json"
const BACKUP := "save.previous.json"
const TEMP := "save.pending.json"
const RESET_BACKUP := "before-reset.json"
const PET_IDS := ["z_rat", "z_ox", "z_tiger", "z_rabbit", "z_dragon", "z_snake", "z_horse", "z_sheep", "z_monkey", "z_rooster", "z_dog", "z_pig", "m_INTJ", "m_INTP", "m_ENTJ", "m_ENTP", "m_INFJ", "m_INFP", "m_ENFJ", "m_ENFP", "m_ISTJ", "m_ISFJ", "m_ESTJ", "m_ESFJ", "m_ISTP", "m_ISFP", "m_ESTP", "m_ESFP"]

var base := "user://"
var read_only := false
var last_error := ""

func _init(directory: String = "user://") -> void:
    # The optional subdirectory is for isolated developer tests, not player input.
    if not directory.begins_with("user://") or ".." in directory or "\\" in directory:
        read_only = true
        last_error = "저장 경로가 올바르지 않습니다."
        return
    base = directory.trim_suffix("/") + "/"
    if directory == "user://":
        base = "user://"
    var err := DirAccess.make_dir_recursive_absolute(base)
    if err != OK and err != ERR_ALREADY_EXISTS:
        read_only = true
        last_error = "저장 폴더를 만들 수 없습니다."

static func defaults() -> Dictionary:
    return {"schema":SCHEMA, "character":"z_rabbit", "name":"모찌", "level":1, "xp":0, "coins":60, "hp":60, "hunger":82, "mood":80, "attack":7, "defense":2, "speed":1, "toys":0, "skills":0, "zone":0, "hunt":false, "first_run":true}

static func _bounded(value: Variant, low: int, high: int, fallback: int) -> int:
    if typeof(value) != TYPE_INT and typeof(value) != TYPE_FLOAT:
        return fallback
    var number := float(value)
    if not is_finite(number):
        return fallback
    return int(clampf(number, float(low), float(high)))

static func sanitize(value: Variant) -> Dictionary:
    var clean := defaults()
    if not value is Dictionary:
        return clean
    var source: Dictionary = value
    var id: Variant = source.get("character")
    if id is String and id in PET_IDS:
        clean.character = id
    var name_value: Variant = source.get("name")
    if name_value is String:
        var text := ""
        for i in range(mini(name_value.length(), 96)):
            var c: int = name_value.unicode_at(i)
            if c >= 32 and c != 127 and not (c >= 0x202a and c <= 0x202e) and not (c >= 0x2066 and c <= 0x2069):
                text += String.chr(c)
        text = text.strip_edges().left(24)
        if not text.is_empty():
            clean.name = text
    clean.level = _bounded(source.get("level"), 1, 20, 1)
    clean.xp = _bounded(source.get("xp"), 0, 35 + int(clean.level) * 20 - 1, 0)
    if clean.level == 20:
        clean.xp = 0
    clean.coins = _bounded(source.get("coins"), 0, 9999999, 60)
    clean.hp = _bounded(source.get("hp"), 0, 60 + (int(clean.level) - 1) * 7, 60)
    clean.hunger = _bounded(source.get("hunger"), 0, 100, 82)
    clean.mood = _bounded(source.get("mood"), 0, 100, 80)
    clean.attack = _bounded(source.get("attack"), 1, 200, 7)
    clean.defense = _bounded(source.get("defense"), 0, 100, 2)
    clean.speed = _bounded(source.get("speed"), 1, 20, 1)
    clean.toys = _bounded(source.get("toys"), 0, 99, 0)
    clean.skills = _bounded(source.get("skills"), 0, 20, 0)
    clean.zone = _bounded(source.get("zone"), 0, 3, 0)
    var min_levels := [1, 5, 10, 15]
    if int(clean.level) < int(min_levels[int(clean.zone)]):
        clean.zone = 0
    # Hunting never resumes silently at application launch.
    clean.hunt = false
    var first: Variant = source.get("first_run")
    if first is bool:
        clean.first_run = first
    return clean

func _path(name: String) -> String:
    return base + name

func _read(name: String) -> Dictionary:
    var path := _path(name)
    if not FileAccess.file_exists(path):
        return {"status":"missing"}
    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        return {"status":"unreadable"}
    if file.get_length() > LIMIT_BYTES:
        file.close()
        return {"status":"oversize"}
    var text := file.get_as_text()
    file.close()
    var json := JSON.new()
    if json.parse(text) != OK or not json.data is Dictionary:
        return {"status":"invalid"}
    var raw: Dictionary = json.data
    if not raw.has("character") or not raw.has("level"):
        return {"status":"invalid"}
    var version: Variant = raw.get("schema", 1)
    if typeof(version) != TYPE_FLOAT and typeof(version) != TYPE_INT:
        return {"status":"invalid"}
    if not is_finite(float(version)):
        return {"status":"invalid"}
    if float(version) > SCHEMA:
        return {"status":"future"}
    if float(version) != SCHEMA:
        return {"status":"invalid"}
    return {"status":"ok", "data":sanitize(raw)}

func load_game() -> Dictionary:
    if read_only:
        return {"data":defaults(), "status":"blocked", "message":last_error}
    var main := _read(MAIN)
    if main.status == "future":
        read_only = true
        last_error = "새 버전의 저장 기록입니다. 이 버전으로 덮어쓰지 않습니다."
        return {"data":defaults(), "status":"blocked", "message":last_error}
    if main.status == "ok":
        return {"data":main.data, "status":"ok", "message":""}
    for name in [BACKUP, TEMP]:
        var alternative := _read(name)
        if alternative.status == "ok":
            return {"data":alternative.data, "status":"recovered", "message":"이전 정상 저장 기록을 복구했습니다. 일부 최근 진행은 없을 수 있습니다."}
    if main.status == "missing" and _read(BACKUP).status == "missing" and _read(TEMP).status == "missing":
        return {"data":defaults(), "status":"new", "message":""}
    read_only = true
    last_error = "저장 파일을 읽을 수 없어 기록을 보호했습니다. 자동 덮어쓰기는 중단됩니다."
    return {"data":defaults(), "status":"blocked", "message":last_error}

func _write_checked(name: String, value: Dictionary) -> Error:
    var text := JSON.stringify(sanitize(value), "  ")
    if text.to_utf8_buffer().size() > LIMIT_BYTES:
        return ERR_OUT_OF_MEMORY
    var file := FileAccess.open(_path(name), FileAccess.WRITE)
    if file == null:
        return FileAccess.get_open_error()
    file.store_string(text)
    file.flush()
    var err := file.get_error()
    file.close()
    if err != OK:
        return err
    var check := _read(name)
    if check.status != "ok" or JSON.stringify(check.data) != JSON.stringify(sanitize(value)):
        return ERR_FILE_CORRUPT
    return OK

func save_game(value: Dictionary) -> Error:
    if read_only:
        return ERR_UNAUTHORIZED
    # Write and reopen the temporary file BEFORE replacing any good copy.
    var err := _write_checked(TEMP, value)
    if err != OK:
        last_error = "임시 저장 실패: %s" % error_string(err)
        return err
    var current := _read(MAIN)
    if current.status == "future":
        read_only = true
        last_error = "다른 버전의 저장 기록이 발견되어 저장을 중단했습니다."
        return ERR_UNAUTHORIZED
    if current.status == "ok":
        err = _write_checked("backup.pending.json", current.data)
        if err != OK:
            last_error = "백업 생성에 실패하여 원본 교체를 중단했습니다."
            return err
        err = DirAccess.rename_absolute(_path("backup.pending.json"), _path(BACKUP))
        if err != OK:
            last_error = "백업 교체에 실패하여 원본을 유지했습니다."
            return err
    err = DirAccess.rename_absolute(_path(TEMP), _path(MAIN))
    if err != OK:
        last_error = "저장 교체에 실패했습니다. 이전 기록과 임시 파일은 보존했습니다."
        return err
    last_error = ""
    return OK

func begin_new_game() -> Error:
    # Call only after a visible user confirmation. Preserve a fixed, bounded
    # pre-reset snapshot. A future-format save must never be reset by this build.
    if _read(MAIN).status == "future":
        return ERR_UNAUTHORIZED
    var exists := FileAccess.file_exists(_path(MAIN))
    if exists:
        var file := FileAccess.open(_path(MAIN), FileAccess.READ)
        if file == null:
            return ERR_FILE_CANT_OPEN
        var size := file.get_length()
        file.close()
        if size > LIMIT_BYTES:
            return ERR_INVALID_DATA
        var copy_err := DirAccess.copy_absolute(_path(MAIN), _path("reset.pending.json"))
        if copy_err != OK:
            return copy_err
        var original_hash := FileAccess.get_sha256(_path(MAIN))
        if original_hash.is_empty() or original_hash != FileAccess.get_sha256(_path("reset.pending.json")):
            return ERR_FILE_CORRUPT
        copy_err = DirAccess.rename_absolute(_path("reset.pending.json"), _path(RESET_BACKUP))
        if copy_err != OK:
            return copy_err
    read_only = false
    return save_game(defaults())
