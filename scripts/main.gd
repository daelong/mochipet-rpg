extends Node2D
## Godot 4.7.2 target: offline desktop-pet prototype, hardening review build.
## Open-source, offline prototype. Online account linking is intentionally NOT implemented.

const MAX_LEVEL := 20
const SaveStore := preload("res://scripts/save_store.gd")
const SessionGuard := preload("res://scripts/session_guard.gd")
const MAX_FLOATS := 24
const FPS_ACTIVE := 30
const FPS_PAUSED := 10
const PET_SIZE := Vector2(104, 104)
const MOB_SIZE := Vector2(86, 86)
const CHARACTERS := [
    ["z_rat", "쥐", "재빠른 훔치기"], ["z_ox", "소", "우직한 돌진"],
    ["z_tiger", "호랑이", "맹호 발톱"], ["z_rabbit", "토끼", "달빛 점프"],
    ["z_dragon", "용", "청룡 숨결"], ["z_snake", "뱀", "그림자 독니"],
    ["z_horse", "말", "질풍 돌파"], ["z_sheep", "양", "포근한 응원"],
    ["z_monkey", "원숭이", "장난 폭탄"], ["z_rooster", "닭", "새벽의 노래"],
    ["z_dog", "개", "충성 돌진"], ["z_pig", "돼지", "행운 꿀꺽"],
    ["m_INTJ", "INTJ", "전략의 일격"], ["m_INTP", "INTP", "탐구의 섬광"],
    ["m_ENTJ", "ENTJ", "지휘 돌격"], ["m_ENTP", "ENTP", "기발한 폭발"],
    ["m_INFJ", "INFJ", "꿈의 수호"], ["m_INFP", "INFP", "희망의 빛"],
    ["m_ENFJ", "ENFJ", "따뜻한 용기"], ["m_ENFP", "ENFP", "반짝 장난"],
    ["m_ISTJ", "ISTJ", "튼튼한 일격"], ["m_ISFJ", "ISFJ", "포근한 보호"],
    ["m_ESTJ", "ESTJ", "대장의 돌진"], ["m_ESFJ", "ESFJ", "우정의 응원"],
    ["m_ISTP", "ISTP", "정밀 타격"], ["m_ISFP", "ISFP", "고요한 바람"],
    ["m_ESTP", "ESTP", "질주 공격"], ["m_ESFP", "ESFP", "신나는 한방"]
]
const ZONES := [
    {"name":"풀잎 초원", "level":1, "mobs":["slime", "mushroom"], "hp":22, "attack":2, "xp":10, "coin":8},
    {"name":"반짝 숲", "level":5, "mobs":["bat", "foxfire"], "hp":54, "attack":4, "xp":22, "coin":18},
    {"name":"바위 동굴", "level":10, "mobs":["golem", "shade"], "hp":106, "attack":7, "xp":41, "coin":32},
    {"name":"달빛 언덕", "level":15, "mobs":["ghost", "moon"], "hp":174, "attack":10, "xp":70, "coin":55}
]

var data: Dictionary = SaveStore.defaults()
var pet_x := 280.0
var target_x := 500.0
var y_base := 600.0
var mob := {}
var animation_time := 0.0
var spawn_wait := 1.0
var action_wait := 0.0
var rest_wait := 0.0
var hit_flash := 0.0
var message := ""
var message_time := 0.0
var floats: Array = []
var screen_size := Vector2(1280, 720)
var hud: Control
var dialog: PanelContainer
var button_bar: HBoxContainer
var stat_label: Label
var msg_label: Label
var pet_tex_cache := {}
var mob_tex_cache := {}
var rng := RandomNumberGenerator.new()
var autosave_time := 0.0
var save_store = SaveStore.new()
var session_guard = SessionGuard.new()
var save_dirty := false
var save_ready := false
var save_retry_wait := 0.0
var startup_notice := ""
var game_paused := false
var quitting := false
var mode_button: Button
var pause_button: Button
var reset_confirm: ConfirmationDialog
var quit_confirm: ConfirmationDialog
var ui_layer: CanvasLayer
var desktop_mode := false
var controller: Window
var normal_position := Vector2i(80, 80)
var normal_size := Vector2i(960, 720)
var display_check_time := 0.0

func _ready() -> void:
    Engine.max_fps = FPS_ACTIVE
    rng.randomize()
    set_process(false)
    get_tree().auto_accept_quit = false
    if not session_guard.acquire():
        OS.alert("모찌펫이 이미 실행 중이거나 잠금 기록을 확인할 수 없습니다. 기존 모찌펫 창을 먼저 닫아 주세요. 저장 파일은 변경하지 않았습니다.", "모찌펫 실행 중단")
        get_tree().quit()
        return
    _load_game()
    var win := get_window()
    win.title = "모찌펫 RPG 0.4.1 — 검토용 테스트 빌드"
    win.transparent = false
    win.borderless = false
    win.always_on_top = false
    win.mouse_passthrough = false
    win.unfocusable = false
    win.min_size = Vector2i(720, 600)
    win.size = normal_size
    get_viewport().transparent_bg = false
    get_viewport().gui_embed_subwindows = false
    win.close_requested.connect(_request_quit)
    win.size_changed.connect(_resize_layout)
    _build_ui()
    _build_confirmations()
    _resize_layout()
    pet_x = minf(280.0, screen_size.x * 0.4)
    target_x = pet_x + 120.0
    _refresh_ui()
    if bool(data.first_run) and save_ready:
        _show_characters()
    if not startup_notice.is_empty():
        _notify(startup_notice)
        message_time = 30.0
    if not save_ready:
        game_paused = true
        _show_settings()
    set_process(true)

func _build_ui() -> void:
    ui_layer = CanvasLayer.new()
    add_child(ui_layer)
    hud = Control.new()
    hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
    ui_layer.add_child(hud)
    var box := PanelContainer.new()
    box.position = Vector2(16, 14)
    box.custom_minimum_size = Vector2(492, 86)
    hud.add_child(box)
    var v := VBoxContainer.new()
    v.add_theme_constant_override("separation", 5)
    box.add_child(v)
    stat_label = Label.new()
    stat_label.add_theme_font_size_override("font_size", 16)
    v.add_child(stat_label)
    button_bar = HBoxContainer.new()
    button_bar.add_theme_constant_override("separation", 4)
    v.add_child(button_bar)
    _btn(button_bar,"🐾 산책", func(): _toggle_hunt(false))
    _btn(button_bar,"⚔ 사냥", func(): _toggle_hunt(true))
    _btn(button_bar,"🗺 사냥터", _show_zones)
    _btn(button_bar,"🛒 상점", _show_shop)
    _btn(button_bar,"🐣 펫", _show_status)
    _btn(button_bar,"⚙", _show_settings)
    _btn(button_bar,"종료", _request_quit)
    var safety_row := HBoxContainer.new()
    v.add_child(safety_row)
    pause_button = _btn(safety_row, "일시정지", _toggle_pause)
    mode_button = _btn(safety_row, "바탕화면 모드 (시험)", _request_desktop_mode)
    mode_button.disabled = not bool(ProjectSettings.get_setting("mochi/experimental_desktop_overlay", false))
    mode_button.tooltip_text = "운영체제별 클릭 통과·종료 검증 전까지 비활성화했습니다. 일반 창에서 사냥과 육성은 가능합니다."
    msg_label = Label.new()
    msg_label.position = Vector2(20, 124)
    msg_label.add_theme_font_size_override("font_size", 14)
    msg_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    msg_label.custom_minimum_size = Vector2(510, 40)
    hud.add_child(msg_label)
    dialog = PanelContainer.new()
    dialog.visible = false
    dialog.position = Vector2(18, 170)
    dialog.custom_minimum_size = Vector2(490, 420)
    hud.add_child(dialog)

func _btn(parent: Node, label: String, action: Callable) -> Button:
    var b := Button.new()
    b.text = label
    b.pressed.connect(action)
    b.add_theme_font_size_override("font_size", 14)
    parent.add_child(b)
    return b

func _open_panel(heading: String) -> VBoxContainer:
    for c in dialog.get_children():
        dialog.remove_child(c)
        c.queue_free()
    dialog.visible = true
    _resize_layout()
    var outer := VBoxContainer.new()
    outer.add_theme_constant_override("separation", 9)
    dialog.add_child(outer)
    var row := HBoxContainer.new()
    outer.add_child(row)
    var title := Label.new()
    title.text = "  " + heading
    title.add_theme_font_size_override("font_size", 21)
    title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    row.add_child(title)
    _btn(row, "닫기 ×", func():
        dialog.hide()
        _update_passthrough()
    )
    var scroll := ScrollContainer.new()
    scroll.custom_minimum_size = Vector2(468, minf(350.0, _ui_height() - 230.0))
    outer.add_child(scroll)
    var body := VBoxContainer.new()
    body.add_theme_constant_override("separation", 7)
    body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    scroll.add_child(body)
    _update_passthrough()
    return body

func _show_characters() -> void:
    var body := _open_panel("🐣 캐릭터 선택 (28종)")
    var note := Label.new()
    note.text = "십이지신 또는 MBTI 동물 중 하나를 선택하세요."
    body.add_child(note)
    for item in CHARACTERS:
        var id: String = item[0]
        var row := HBoxContainer.new()
        body.add_child(row)
        var icon := TextureRect.new()
        icon.texture = _pet_texture(id, "idle", 0)
        icon.custom_minimum_size = Vector2(52, 52)
        icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
        icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
        row.add_child(icon)
        _btn(row, "%s  ·  %s" % [item[1], item[2]], func():
            data.character = id
            data.name = str(item[1])
            data.first_run = false
            data.hunt = false
            dialog.hide()
            _save_game()
            _notify("%s와 함께 모험 시작!" % item[1])
            _update_passthrough()
        )

func _show_zones() -> void:
    var body := _open_panel("🗺 화면 위 사냥터")
    var info := Label.new()
    info.text = "사냥터를 선택하고 사냥을 누르면 게임 화면에서 몬스터가 등장해요."
    info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    body.add_child(info)
    for i in range(ZONES.size()):
        var z: Dictionary = ZONES[i]
        var unlocked := int(data.level) >= int(z.level)
        var b := _btn(body, "%s (Lv.%d+) %s" % [z.name, z.level, "✓" if unlocked else "🔒"], func():
            data.zone = i
            mob.clear()
            spawn_wait = 0.6
            _notify("%s 선택!" % z.name)
            _save_game()
            dialog.hide()
            _update_passthrough()
        )
        b.disabled = not unlocked

func _show_shop() -> void:
    var body := _open_panel("🛒 모찌 상점 — 코인 %d" % int(data.coins))
    _shop_item(body, "🍙 맛있는 밥 | 15코인 | 배부름 +30", 15, false, func(): data.hunger = mini(100, int(data.hunger)+30))
    var toy_effect := func():
        data.mood = mini(100, int(data.mood)+25)
        data.toys = int(data.toys)+1
    _shop_item(body, "🧸 장난감 | 45코인 | 기분 +25, 소장 +1 (최대 99)", 45, int(data.toys) >= 99, toy_effect)
    _shop_item(body, "⚔ 공격 훈련 | 70코인 | 공격력 +2 (최대 200)", 70, int(data.attack) >= 200, func(): data.attack = mini(200, int(data.attack)+2))
    _shop_item(body, "🛡 방어 훈련 | 70코인 | 방어력 +1 (최대 100)", 70, int(data.defense) >= 100, func(): data.defense = int(data.defense)+1)
    _shop_item(body, "👟 민첩 훈련 | 75코인 | 속도 +1 (최대 20)", 75, int(data.speed) >= 20, func(): data.speed = int(data.speed)+1)
    _shop_item(body, "✨ 스킬 강화 | 120코인 | 스킬 +1 (최대 20)", 120, int(data.skills) >= 20, func(): data.skills = int(data.skills)+1)
    _shop_item(body, "💗 회복 간식 | 20코인 | HP 회복", 20, false, func(): data.hp = _max_hp())

func _shop_item(parent: Node, label: String, price: int, at_cap: bool, effect: Callable) -> void:
    var b := _btn(parent, label, func():
        if at_cap or not save_ready:
            return
        if int(data.coins) < price:
            _notify("코인이 부족해요!")
            return
        data.coins = int(data.coins) - price
        effect.call()
        _save_game()
        _notify("구매 성공! -%d 코인" % price)
        _show_shop()
    )
    b.disabled = int(data.coins) < price or at_cap or not save_ready

func _show_status() -> void:
    var body := _open_panel("🐣 내 펫 정보")
    var content := Label.new()
    content.text = "%s  |  Lv.%d / %d\n경험치 %d / %d\nHP %d / %d\n공격력 %d · 방어력 %d · 민첩 %d\n배고픔 %d · 기분 %d\n소장 장난감 %d · 스킬 강화 %d\n고유 스킬: %s" % [data.name, data.level, MAX_LEVEL, data.xp, _xp_need(), data.hp, _max_hp(), data.attack, data.defense, data.speed, data.hunger, data.mood, data.toys, data.skills, _skill_name()]
    body.add_child(content)
    _btn(body, "🍙 간식 주기 (무료 · 재사용 대기시간 없음)", func():
        data.hunger = mini(100, int(data.hunger)+5)
        _notify("맛있어!")
        _save_game()
        _show_status()
    )
    _btn(body, "🧸 쓰다듬기", func():
        data.mood = mini(100, int(data.mood)+6)
        _notify("기분이 좋아졌어!")
        _save_game()
        _show_status()
    )

func _show_settings() -> void:
    var body := _open_panel("⚙ 설정 · 보안/안정성 검토판")
    _btn(body, "캐릭터 바꾸기 (능력치 유지)", _show_characters).disabled = not save_ready
    _btn(body, "지금 저장", func():
        save_dirty = true
        if _flush_save():
            _notify("저장 완료. 이전 정상 기록도 백업했습니다.")
    ).disabled = not save_ready
    _btn(body, "처음부터 다시 시작…", func():
        reset_confirm.popup_centered(Vector2i(490, 240))
    )
    _btn(body, "게임 종료", _request_quit)
    var note := Label.new()
    note.text = "오프라인 Lv.20까지 · 온라인/멀티플레이 미구현\n네트워크 통신·자동 실행 등록·보안 설정 변경 없음\n첫 실행은 일반 창. 바탕화면 모드는 OS 검증 전 비활성화.\n저장 위치: 앱 전용 desktop-v041 폴더\n초기화 전 기록은 before-reset.json에 마지막 1개 보관.\n현재 빌드는 실기기 실행/백신 검사가 완료되지 않았습니다."
    note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    body.add_child(note)
    if not save_ready:
        var warning := Label.new()
        warning.text = save_store.last_error + "\n기록 보호를 위해 자동 저장을 멈췄습니다."
        warning.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        body.add_child(warning)

func _toggle_hunt(on: bool) -> void:
    if not save_ready:
        _notify("저장 문제를 먼저 확인해 주세요.")
        return
    data.hunt = on
    if on and int(data.level) < int(ZONES[int(data.zone)].level):
        data.zone = 0
    _refresh_ui()
    if not on:
        mob.clear()
        _notify("평화로운 산책 시작 🐾")
    else:
        spawn_wait = 0.5
        _notify("%s 사냥 시작 ⚔" % ZONES[int(data.zone)].name)
    _save_game()

func _process(delta: float) -> void:
    delta = minf(delta, 0.1)
    save_retry_wait = maxf(0.0, save_retry_wait - delta)
    autosave_time += delta
    if autosave_time >= 10.0:
        autosave_time = 0.0
        if save_dirty and save_retry_wait <= 0.0:
            _flush_save()
    var minimized := get_window().mode == Window.MODE_MINIMIZED
    if is_instance_valid(controller):
        minimized = minimized or controller.mode == Window.MODE_MINIMIZED
    if game_paused or minimized or not save_ready:
        Engine.max_fps = FPS_PAUSED
        return
    Engine.max_fps = FPS_ACTIVE
    animation_time += delta
    action_wait = maxf(0, action_wait - delta)
    hit_flash = maxf(0, hit_flash - delta)
    message_time = maxf(0, message_time - delta)
    if message_time <= 0:
        msg_label.text = ""
    y_base = screen_size.y - 42.0
    if bool(data.hunt):
        if mob.is_empty():
            spawn_wait -= delta
            if spawn_wait <= 0:
                _spawn_monster()
        else:
            var distance := absf(pet_x - float(mob.x))
            if distance > 93.0:
                var approach := float(mob.x) + (80.0 if pet_x > float(mob.x) else -80.0)
                pet_x = move_toward(pet_x, approach, (105 + int(data.speed)*18)*delta)
            elif action_wait <= 0:
                _attack_monster()
    else:
        if absf(pet_x-target_x) < 10:
            target_x = rng.randf_range(95, maxf(130, screen_size.x-95))
            rest_wait = rng.randf_range(0.5, 2.0)
        if rest_wait > 0:
            rest_wait -= delta
        else:
            pet_x = move_toward(pet_x, target_x, (45 + int(data.speed)*12)*delta)
    for f in floats:
        f.life -= delta
        f.y -= delta*42
    floats = floats.filter(func(f): return f.life > 0)
    if desktop_mode:
        display_check_time += delta
        if display_check_time >= 2.0:
            display_check_time = 0.0
            _fit_desktop()
    queue_redraw()

func _spawn_monster() -> void:
    var z: Dictionary = ZONES[int(data.zone)]
    var kind: String = z.mobs[rng.randi_range(0, z.mobs.size()-1)]
    var x := rng.randf_range(screen_size.x*0.55, maxf(screen_size.x*0.57,screen_size.x-110))
    if absf(x - pet_x) < 160: x = minf(screen_size.x-100,pet_x+225)
    mob = {"kind":kind, "x":x, "hp":int(z.hp), "max_hp":int(z.hp), "next_hit":0.0}
    _notify("야생 %s 등장!" % _mob_name(kind))

func _attack_monster() -> void:
    if mob.is_empty(): return
    action_wait = 0.7
    hit_flash = 0.22
    var dmg := int(data.attack) + int(data.level)*2 + rng.randi_range(0, 5) + int(data.skills)*3
    mob.hp = int(mob.hp)-dmg
    _float_text("-%d ✨" % dmg,float(mob.x),y_base-115,Color("ffe38d"))
    if rng.randf() < 0.36:
        _float_text(_skill_name(),pet_x,y_base-165,Color("bcefff"))
    if int(mob.hp) <= 0:
        var z: Dictionary = ZONES[int(data.zone)]
        var reward := int(z.coin)+rng.randi_range(0, 8)
        data.coins = mini(9999999, int(data.coins)+reward)
        _gain_xp(int(z.xp))
        _float_text("+%d 🪙" % reward,float(mob.x),y_base-152,Color("fff5a6"))
        mob.clear()
        spawn_wait = rng.randf_range(2.0,4.0)
        _refresh_ui()
        _save_game()
    else:
        var enemy_hit := maxi(1, int(ZONES[int(data.zone)].attack)-int(int(data.defense) / 2.0))
        data.hp = maxi(0,int(data.hp)-enemy_hit)
        _float_text("-%d HP" % enemy_hit,pet_x,y_base-136,Color("ffb7b7"))
        if int(data.hp) <= 0:
            data.hp = _max_hp()
            data.hunt = false
            mob.clear()
            _notify("펫이 지쳐서 집으로 돌아왔어요. 사냥 OFF!")
        _refresh_ui()
        _save_game()

func _gain_xp(amount: int) -> void:
    if int(data.level) >= MAX_LEVEL: return
    data.xp = int(data.xp)+amount
    while int(data.level) < MAX_LEVEL and int(data.xp) >= _xp_need():
        data.xp = int(data.xp)-_xp_need()
        data.level = int(data.level)+1
        data.attack = mini(200, int(data.attack)+1)
        data.hp = _max_hp()
        _notify("🎉 레벨 업! Lv.%d" % int(data.level))
    if int(data.level) >= MAX_LEVEL:
        data.xp = 0
        _notify("🎓 Lv.20 달성! 오프라인 만렙! 온라인은 개발 예정")

func _draw() -> void:
    if not desktop_mode:
        draw_rect(Rect2(Vector2(0, screen_size.y - 180), Vector2(screen_size.x, 180)), Color("242d42"))
    var pet_state := "walk" if absf(pet_x-target_x) > 18 or bool(data.hunt) else "idle"
    if action_wait > 0 and hit_flash > 0: pet_state = "play"
    if not bool(data.hunt) and rest_wait > 0: pet_state = "idle"
    var frame := int(animation_time*4.0) % 2
    var pet_tex := _pet_texture(str(data.character),pet_state,frame)
    if pet_tex:
        var py := y_base - PET_SIZE.y + sin(animation_time*9.0)*2.5
        draw_texture_rect(pet_tex,Rect2(pet_x-PET_SIZE.x*0.5,py,PET_SIZE),false)
    draw_string(ThemeDB.fallback_font,Vector2(pet_x-36,y_base+10),"%s Lv.%d"%[data.name,data.level],HORIZONTAL_ALIGNMENT_LEFT,-1,16,Color("e9e6ff"))
    if not mob.is_empty():
        var tx := _monster_texture(str(mob.kind))
        if tx:
            var my := y_base - MOB_SIZE.y + sin(animation_time*6.0)*4.0
            var box := Rect2(float(mob.x)-MOB_SIZE.x*0.5,my,MOB_SIZE)
            draw_texture_rect(tx,box,false)
            if hit_flash > 0: draw_rect(box,Color(1,1,1,0.2),true)
        var bx := float(mob.x)-43
        draw_rect(Rect2(bx,y_base-103,86,8),Color("55425c"),true)
        draw_rect(Rect2(bx+1,y_base-102,84*maxf(0,float(mob.hp)/float(mob.max_hp)),6),Color("ff819d"),true)
        draw_string(ThemeDB.fallback_font,Vector2(bx,y_base+12),_mob_name(str(mob.kind)),HORIZONTAL_ALIGNMENT_LEFT,-1,15,Color("e9e6ff"))
    for f in floats:
        draw_string(ThemeDB.fallback_font,Vector2(f.x-25,f.y),f.text,HORIZONTAL_ALIGNMENT_LEFT,-1,19,f.color)

func _update_passthrough() -> void:
    # Full-screen hit-test polygons are intentionally no longer used.
    # The experimental overlay is all-pass-through; UI lives in a separate window.
    if desktop_mode:
        get_window().mouse_passthrough = true

func _pet_texture(id: String, state: String, frame: int) -> Texture2D:
    var path := "res://assets/pets/%s/%s_%d_right.png"%[id,state,frame]
    if not pet_tex_cache.has(path):
        pet_tex_cache[path] = load(path)
    return pet_tex_cache[path]

func _monster_texture(kind: String) -> Texture2D:
    if not mob_tex_cache.has(kind):
        mob_tex_cache[kind] = load("res://assets/monsters/%s.png" % kind)
    return mob_tex_cache[kind]

func _skill_name() -> String:
    for item in CHARACTERS:
        if item[0] == data.character: return str(item[2])
    return "빛의 일격"

func _mob_name(kind: String) -> String:
    var names := {"slime":"먼지 슬라임","mushroom":"뾰족 버섯","bat":"밤 박쥐","foxfire":"여우불","golem":"돌 골렘","shade":"그림자","ghost":"숲 유령","moon":"달빛 정령"}
    return str(names.get(kind,kind))

func _xp_need() -> int: return 35 + int(data.level)*20
func _max_hp() -> int: return 60 + (int(data.level)-1)*7

func _float_text(s: String, px: float, py: float, col: Color) -> void:
    if floats.size() >= MAX_FLOATS:
        floats.pop_front()
    floats.append({"text":s,"x":px,"y":py,"color":col,"life":1.25})

func _notify(s: String) -> void:
    message=s
    message_time=3.2
    if msg_label: msg_label.text=s

func _refresh_ui() -> void:
    if stat_label:
        stat_label.text = "  🐣 %s Lv.%d/20   💗 %d/%d   🪙 %d   %s" % [data.name,data.level,data.hp,_max_hp(),data.coins,"⚔ 사냥 중" if bool(data.hunt) else "🐾 산책 중"]

func _default_data() -> Dictionary:
    return SaveStore.defaults()

func _load_game() -> void:
    var result: Dictionary = save_store.load_game()
    data = result.data
    save_ready = result.status != "blocked"
    startup_notice = str(result.message)
    data.hunt = false

func _save_game() -> void:
    # Several kills/button clicks can happen per second: coalesce disk writes.
    if save_ready:
        save_dirty = true
    _refresh_ui()

func _exit_tree() -> void:
    if session_guard.acquired and save_ready and save_dirty:
        save_store.save_game(data)
    session_guard.release()

func _flush_save() -> bool:
    if not save_ready or not session_guard.acquired:
        return false
    if not save_dirty:
        return true
    var err: Error = save_store.save_game(data)
    if err != OK:
        save_retry_wait = 30.0
        _notify("저장 실패: " + save_store.last_error)
        message_time = 30.0
        return false
    save_dirty = false
    return true

func _build_confirmations() -> void:
    reset_confirm = ConfirmationDialog.new()
    reset_confirm.title = "처음부터 다시 시작할까요?"
    reset_confirm.dialog_text = "캐릭터·레벨·코인·스킬이 초기화됩니다.\n현재 기록은 초기화 전 백업 1개로 보관합니다.\n반복 초기화하면 그 백업도 마지막 기록으로 교체됩니다."
    reset_confirm.ok_button_text = "백업 후 초기화"
    reset_confirm.cancel_button_text = "취소"
    ui_layer.add_child(reset_confirm)
    reset_confirm.confirmed.connect(_reset_confirmed)
    quit_confirm = ConfirmationDialog.new()
    quit_confirm.title = "저장되지 않은 변경 사항"
    quit_confirm.dialog_text = "저장에 실패했습니다. 이전 기록은 보존됩니다.\n취소하면 다시 저장할 수 있습니다. 저장하지 않고 종료할까요?"
    quit_confirm.ok_button_text = "저장 없이 종료"
    quit_confirm.cancel_button_text = "취소"
    ui_layer.add_child(quit_confirm)
    quit_confirm.confirmed.connect(func():
        save_dirty = false
        quitting = true
        get_tree().quit()
    )

func _reset_confirmed() -> void:
    if save_ready and save_dirty and not _flush_save():
        _notify("현재 기록 저장에 실패하여 초기화를 중단했습니다.")
        return
    var err: Error = save_store.begin_new_game()
    if err != OK:
        _notify("기록 보존에 실패하여 초기화를 중단했습니다: " + error_string(err))
        message_time = 30.0
        return
    data = SaveStore.defaults()
    save_ready = true
    save_dirty = false
    game_paused = false
    pause_button.text = "일시정지"
    mob.clear()
    floats.clear()
    _refresh_ui()
    _show_characters()

func _request_quit() -> void:
    if quitting:
        return
    game_paused = true
    if pause_button != null:
        pause_button.text = "계속하기"
    if save_ready and save_dirty and not _flush_save():
        quit_confirm.popup_centered(Vector2i(490, 220))
        return
    quitting = true
    get_tree().quit()

func _toggle_pause() -> void:
    if not save_ready:
        return
    game_paused = not game_paused
    pause_button.text = "계속하기" if game_paused else "일시정지"
    if game_paused:
        _flush_save()

func _unhandled_key_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        if event.keycode == KEY_ESCAPE:
            if desktop_mode:
                _set_desktop_mode(false)
            elif dialog.visible:
                dialog.hide()
            else:
                _toggle_pause()
            get_viewport().set_input_as_handled()

func _ui_height() -> float:
    if is_instance_valid(controller):
        return float(controller.size.y)
    return float(get_window().size.y)

func _resize_layout() -> void:
    screen_size = Vector2(get_window().size)
    y_base = screen_size.y - 42.0
    pet_x = clampf(pet_x, 70.0, maxf(80.0, screen_size.x - 70.0))
    target_x = clampf(target_x, 70.0, maxf(80.0, screen_size.x - 70.0))
    if not mob.is_empty():
        mob.x = clampf(float(mob.x), 70.0, maxf(80.0, screen_size.x - 70.0))
    if dialog != null:
        dialog.custom_minimum_size.y = minf(420.0, _ui_height() - 190.0)
    queue_redraw()

func _request_desktop_mode() -> void:
    if not bool(ProjectSettings.get_setting("mochi/experimental_desktop_overlay", false)):
        _notify("바탕화면 모드는 운영체제별 검증 후 활성화합니다.")
        return
    _set_desktop_mode(not desktop_mode)

func _set_desktop_mode(on: bool) -> void:
    if on == desktop_mode:
        return
    var win := get_window()
    if on:
        if not DisplayServer.has_feature(DisplayServer.FEATURE_WINDOW_TRANSPARENCY):
            _notify("이 환경에서는 투명 창이 지원되지 않습니다. 일반 창을 유지합니다.")
            return
        normal_position = win.position
        normal_size = win.size
        # A separate, captioned control window provides an exit route. It does
        # not rely on a global keyboard hook or a full-screen clickable polygon.
        controller = Window.new()
        controller.title = "모찌펫 제어 — 닫으면 일반 창으로 복귀"
        controller.size = Vector2i(565, 660)
        controller.min_size = Vector2i(540, 600)
        controller.force_native = true
        controller.window_input.connect(_unhandled_key_input)
        controller.always_on_top = true
        controller.close_requested.connect(func(): _set_desktop_mode(false))
        add_child(controller)
        ui_layer.reparent(controller)
        win.min_size = Vector2i(1, 1)
        win.transparent = true
        win.borderless = true
        win.always_on_top = true
        win.unfocusable = true
        win.mouse_passthrough = true
        get_viewport().transparent_bg = true
        desktop_mode = true
        _fit_desktop()
        controller.position = win.position + Vector2i(24, 24)
        controller.show()
        mode_button.text = "일반 창으로 복귀"
    else:
        desktop_mode = false
        win.mouse_passthrough = false
        win.unfocusable = false
        win.always_on_top = false
        win.borderless = false
        win.transparent = false
        get_viewport().transparent_bg = false
        ui_layer.reparent(self)
        if is_instance_valid(controller):
            controller.queue_free()
        controller = null
        win.min_size = Vector2i(720, 600)
        var rect := DisplayServer.screen_get_usable_rect(win.current_screen)
        win.size = normal_size
        win.position = rect.position + Vector2i(24, 24)
        mode_button.text = "바탕화면 모드 (시험)"
        win.grab_focus()
    _resize_layout()

func _fit_desktop() -> void:
    if not desktop_mode:
        return
    var win := get_window()
    var count := DisplayServer.get_screen_count()
    if count <= 0:
        return
    var screen := clampi(win.current_screen, 0, count - 1)
    var rect := DisplayServer.screen_get_usable_rect(screen)
    if rect.size.x < 600 or rect.size.y < 400:
        _set_desktop_mode(false)
        return
    if win.position != rect.position:
        win.position = rect.position
    if win.size != rect.size:
        win.size = rect.size
