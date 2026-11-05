extends SceneTree
const Store := preload("res://scripts/save_store.gd")
var failures := 0
var checked := 0

func _init() -> void:
    for id in Store.PET_IDS:
        for state in ["idle", "walk", "play", "eat", "happy", "sad", "sleep"]:
            for frame in range(2):
                check_texture("res://assets/pets/%s/%s_%d_right.png" % [id, state, frame])
    for mob in ["slime", "mushroom", "bat", "foxfire", "golem", "shade", "ghost", "moon"]:
        check_texture("res://assets/monsters/%s.png" % mob)
    print("RESOURCE_TESTS checked=", checked, " failures=", failures)
    quit(0 if failures == 0 else 1)

func check_texture(path: String) -> void:
    checked += 1
    if not ResourceLoader.exists(path):
        failures += 1
        printerr("Missing texture: ", path)
        return
    var texture: Texture2D = load(path)
    if texture == null or texture.get_width() <= 0 or texture.get_height() <= 0:
        failures += 1
        printerr("Invalid texture: ", path)
