extends Node3D

const TRACK_LENGTH := 2600.0
const ROAD_HALF := 11.0
const NORMAL_MAX_SPEED := 87.5 # 315 km/h
const NITRO_MAX_SPEED := 110.0 # 396 km/h

var car: Node3D
var follow_camera: Camera3D
var nitro_light: OmniLight3D

var speed := 0.0
var nitro := 100.0
var steer_visual := 0.0
var race_finished := false
var collision_cooldown := 0.0

var rivals: Array = []
var rival_lanes := [-6.0, -3.0, 0.0, 3.0, 6.0, -6.0, -3.0, 3.0, 6.0]

var speed_label: Label
var position_label: Label
var progress_label: Label
var nitro_bar: ProgressBar
var status_label: Label
var finish_panel: Panel
var finish_title: Label
var finish_text: Label

var rng := RandomNumberGenerator.new()


func _ready() -> void:
	rng.seed = 20260922
	_setup_environment()
	_build_track()
	_build_city()
	_build_lights()

	car = _create_car(Color8(255, 46, 76), true)
	car.position = Vector3(0.0, 0.0, 10.0)
	add_child(car)

	nitro_light = OmniLight3D.new()
	nitro_light.light_color = Color8(40, 215, 255)
	nitro_light.light_energy = 0.0
	nitro_light.omni_range = 13.0
	nitro_light.position = Vector3(0.0, 1.0, 3.5)
	car.add_child(nitro_light)

	_create_rivals()
	_create_camera()
	_create_hud()
	_reset_race()


func _setup_environment() -> void:
	var world := WorldEnvironment.new()
	var env := Environment.new()
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()

	sky_material.sky_top_color = Color8(55, 130, 190)
	sky_material.sky_horizon_color = Color8(165, 211, 235)
	sky_material.ground_bottom_color = Color8(32, 42, 43)
	sky_material.ground_horizon_color = Color8(113, 145, 134)
	sky_material.sun_angle_max = 18.0
	sky_material.sun_curve = 0.08

	sky.sky_material = sky_material
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.75
	env.tonemap_mode = Environment.TONE_MAPPER_ACES

	world.environment = env
	add_child(world)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-47.0, -28.0, 0.0)
	sun.light_color = Color8(255, 239, 211)
	sun.light_energy = 1.65
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 180.0
	add_child(sun)


func _material(color: Color, metallic := 0.0, roughness := 0.7) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.metallic = metallic
	mat.roughness = roughness
	return mat


func _box(size: Vector3, color: Color, pos: Vector3, parent: Node = null, metallic := 0.0, roughness := 0.75) -> MeshInstance3D:
	if parent == null:
		parent = self

	var mesh := BoxMesh.new()
	mesh.size = size

	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.material_override = _material(color, metallic, roughness)
	node.position = pos
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	parent.add_child(node)
	return node


func _build_track() -> void:
	_box(
		Vector3(ROAD_HALF * 2.0, 0.25, TRACK_LENGTH + 260.0),
		Color8(43, 47, 52),
		Vector3(0.0, -0.12, -TRACK_LENGTH * 0.5)
	)

	_box(
		Vector3(90.0, 0.18, TRACK_LENGTH + 260.0),
		Color8(67, 105, 60),
		Vector3(-56.0, -0.2, -TRACK_LENGTH * 0.5)
	)
	_box(
		Vector3(90.0, 0.18, TRACK_LENGTH + 260.0),
		Color8(67, 105, 60),
		Vector3(56.0, -0.2, -TRACK_LENGTH * 0.5)
	)

	# Lane markings and red/white curbs.
	for z in range(20, int(TRACK_LENGTH) + 120, 12):
		for x in [-3.65, 3.65]:
			_box(
				Vector3(0.16, 0.035, 5.5),
				Color8(242, 238, 219),
				Vector3(x, 0.15, -float(z))
			)

	for z in range(0, int(TRACK_LENGTH) + 120, 7):
		var curb_color := Color8(230, 45, 60) if int(z / 7) % 2 == 0 else Color8(242, 242, 242)
		_box(
			Vector3(0.65, 0.1, 6.7),
			curb_color,
			Vector3(-ROAD_HALF - 0.15, 0.15, -float(z))
		)
		_box(
			Vector3(0.65, 0.1, 6.7),
			curb_color,
			Vector3(ROAD_HALF + 0.15, 0.15, -float(z))
		)

	# Finish gate.
	var finish_z := -TRACK_LENGTH
	_box(Vector3(28.0, 0.7, 0.7), Color8(235, 235, 235), Vector3(0.0, 8.0, finish_z))
	_box(Vector3(0.7, 8.0, 0.7), Color8(235, 235, 235), Vector3(-13.5, 4.0, finish_z))
	_box(Vector3(0.7, 8.0, 0.7), Color8(235, 235, 235), Vector3(13.5, 4.0, finish_z))

	for i in range(12):
		var x := -10.5 + float(i) * 1.9
		var c := Color8(20, 20, 20) if i % 2 == 0 else Color8(245, 245, 245)
		_box(Vector3(1.9, 0.05, 3.0), c, Vector3(x, 0.16, finish_z))


func _build_city() -> void:
	var building_colors := [
		Color8(72, 95, 112),
		Color8(93, 78, 75),
		Color8(70, 80, 102),
		Color8(86, 100, 91),
		Color8(83, 75, 103)
	]

	for i in range(120):
		var side := -1.0 if i % 2 == 0 else 1.0
		var z := -30.0 - float(i) * 22.0
		var width := rng.randf_range(8.0, 17.0)
		var depth := rng.randf_range(9.0, 18.0)
		var height := rng.randf_range(13.0, 44.0)
		var x := side * rng.randf_range(20.0, 35.0)
		var color: Color = building_colors[i % building_colors.size()]

		var building := _box(
			Vector3(width, height, depth),
			color,
			Vector3(x, height * 0.5, z),
			self,
			0.08,
			0.8
		)

		# Bright window bands make the roadside feel richer without external assets.
		for floor_index in range(2, int(height / 7.0)):
			var glow_mat := StandardMaterial3D.new()
			glow_mat.albedo_color = Color8(185, 222, 235)
			glow_mat.emission_enabled = true
			glow_mat.emission = Color8(110, 190, 220)
			glow_mat.emission_energy_multiplier = 0.65

			var band_mesh := BoxMesh.new()
			band_mesh.size = Vector3(width + 0.06, 0.22, depth + 0.06)
			var band := MeshInstance3D.new()
			band.mesh = band_mesh
			band.material_override = glow_mat
			band.position = Vector3(0.0, -height * 0.5 + float(floor_index) * 6.5, 0.0)
			building.add_child(band)


func _build_lights() -> void:
	var pole_mat := _material(Color8(47, 55, 62), 0.65, 0.4)
	var lamp_mat := StandardMaterial3D.new()
	lamp_mat.albedo_color = Color8(228, 247, 255)
	lamp_mat.emission_enabled = true
	lamp_mat.emission = Color8(135, 215, 255)
	lamp_mat.emission_energy_multiplier = 2.0

	for i in range(90):
		var z := -15.0 - float(i) * 29.0
		for side in [-1.0, 1.0]:
			var group := Node3D.new()
			group.position = Vector3(side * 14.0, 0.0, z)
			add_child(group)

			var pole_mesh := CylinderMesh.new()
			pole_mesh.top_radius = 0.08
			pole_mesh.bottom_radius = 0.1
			pole_mesh.height = 5.8

			var pole := MeshInstance3D.new()
			pole.mesh = pole_mesh
			pole.material_override = pole_mat
			pole.position.y = 2.9
			group.add_child(pole)

			var lamp_mesh := BoxMesh.new()
			lamp_mesh.size = Vector3(0.65, 0.15, 0.42)

			var lamp := MeshInstance3D.new()
			lamp.mesh = lamp_mesh
			lamp.material_override = lamp_mat
			lamp.position = Vector3(-side * 0.95, 5.55, 0.0)
			group.add_child(lamp)


func _create_car(color: Color, is_player := false) -> Node3D:
	var root := Node3D.new()

	var body_mat := _material(color, 0.34, 0.28)
	var glass_mat := _material(Color8(21, 53, 71), 0.2, 0.14)
	var dark_mat := _material(Color8(12, 17, 22), 0.5, 0.45)
	var tire_mat := _material(Color8(5, 6, 7), 0.0, 0.95)
	var rim_mat := _material(Color8(196, 210, 220), 0.8, 0.2)

	_box(Vector3(3.65, 0.8, 6.5), color, Vector3(0.0, 1.0, 0.0), root, 0.34, 0.28)
	_box(Vector3(3.25, 0.45, 1.85), color, Vector3(0.0, 1.56, -2.15), root, 0.34, 0.28)
	_box(Vector3(2.75, 1.18, 2.85), Color8(21, 53, 71), Vector3(0.0, 1.95, -0.05), root, 0.2, 0.14)
	_box(Vector3(2.66, 0.17, 2.35), Color8(12, 17, 22), Vector3(0.0, 2.57, -0.03), root, 0.5, 0.45)
	_box(Vector3(2.7, 0.14, 0.35), Color8(12, 17, 22), Vector3(0.0, 1.94, 2.95), root, 0.5, 0.45)

	for x in [-0.9, 0.9]:
		_box(Vector3(0.12, 0.42, 0.12), Color8(12, 17, 22), Vector3(x, 1.75, 2.88), root, 0.5, 0.45)

	for x in [-1.08, 1.08]:
		var tail_mat := StandardMaterial3D.new()
		tail_mat.albedo_color = Color8(255, 35, 57)
		tail_mat.emission_enabled = true
		tail_mat.emission = Color8(150, 0, 10)
		tail_mat.emission_energy_multiplier = 1.5

		var tail_mesh := BoxMesh.new()
		tail_mesh.size = Vector3(0.7, 0.24, 0.14)
		var tail := MeshInstance3D.new()
		tail.mesh = tail_mesh
		tail.material_override = tail_mat
		tail.position = Vector3(x, 1.2, 3.28)
		root.add_child(tail)

	for x in [-1.08, 1.08]:
		var head_mat := StandardMaterial3D.new()
		head_mat.albedo_color = Color8(245, 250, 255)
		head_mat.emission_enabled = true
		head_mat.emission = Color8(180, 225, 255)
		head_mat.emission_energy_multiplier = 1.8

		var head_mesh := BoxMesh.new()
		head_mesh.size = Vector3(0.72, 0.2, 0.12)
		var head := MeshInstance3D.new()
		head.mesh = head_mesh
		head.material_override = head_mat
		head.position = Vector3(x, 1.18, -3.28)
		root.add_child(head)

	var wheel_positions := [
		Vector3(-1.77, 0.63, -1.85),
		Vector3(1.77, 0.63, -1.85),
		Vector3(-1.77, 0.63, 1.88),
		Vector3(1.77, 0.63, 1.88)
	]

	for wheel_pos in wheel_positions:
		var tire_mesh := CylinderMesh.new()
		tire_mesh.top_radius = 0.56
		tire_mesh.bottom_radius = 0.56
		tire_mesh.height = 0.46

		var tire := MeshInstance3D.new()
		tire.mesh = tire_mesh
		tire.material_override = tire_mat
		tire.rotation.z = PI * 0.5
		tire.position = wheel_pos
		tire.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		root.add_child(tire)

		var rim_mesh := CylinderMesh.new()
		rim_mesh.top_radius = 0.28
		rim_mesh.bottom_radius = 0.28
		rim_mesh.height = 0.48

		var rim := MeshInstance3D.new()
		rim.mesh = rim_mesh
		rim.material_override = rim_mat
		rim.rotation.z = PI * 0.5
		rim.position = wheel_pos
		root.add_child(rim)

	if is_player:
		for x in [-0.8, 0.8]:
			var flame_mat := StandardMaterial3D.new()
			flame_mat.albedo_color = Color8(65, 225, 255)
			flame_mat.emission_enabled = true
			flame_mat.emission = Color8(30, 175, 255)
			flame_mat.emission_energy_multiplier = 3.5

			var flame_mesh := CylinderMesh.new()
			flame_mesh.top_radius = 0.05
			flame_mesh.bottom_radius = 0.22
			flame_mesh.height = 1.7

			var flame := MeshInstance3D.new()
			flame.name = "NitroFlame"
			flame.mesh = flame_mesh
			flame.material_override = flame_mat
			flame.rotation.x = PI * 0.5
			flame.position = Vector3(x, 0.78, 3.95)
			flame.visible = false
			root.add_child(flame)

	return root


func _create_rivals() -> void:
	var colors := [
		Color8(0, 199, 255),
		Color8(255, 190, 55),
		Color8(141, 97, 255),
		Color8(64, 220, 130),
		Color8(255, 88, 112),
		Color8(242, 242, 242),
		Color8(34, 210, 198),
		Color8(255, 139, 53),
		Color8(79, 104, 255)
	]
	var starts := [-18.0, -12.0, -6.0, 6.0, 12.0, 18.0, 24.0, 30.0, 36.0]
	var target_speeds := [72.0, 73.0, 74.0, 71.0, 75.0, 73.5, 72.5, 74.5, 73.0]

	for i in range(9):
		var rival := _create_car(colors[i], false)
		rival.position = Vector3(rival_lanes[i], 0.0, starts[i])
		add_child(rival)

		rivals.append({
			"node": rival,
			"speed": 0.0,
			"target_speed": target_speeds[i],
			"target_lane": rival_lanes[i],
			"change_timer": 1.6 + float(i % 4) * 0.6,
			"index": i
		})


func _create_camera() -> void:
	follow_camera = Camera3D.new()
	follow_camera.current = true
	follow_camera.fov = 66.0
	follow_camera.position = Vector3(0.0, 6.8, 16.5)
	add_child(follow_camera)


func _create_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(root)

	var panel := Panel.new()
	panel.position = Vector2(22.0, 20.0)
	panel.size = Vector2(320.0, 186.0)
	root.add_child(panel)

	var title := Label.new()
	title.text = "VERTEX RACING: NITRO RUSH"
	title.position = Vector2(18.0, 14.0)
	title.add_theme_font_size_override("font_size", 20)
	panel.add_child(title)

	position_label = Label.new()
	position_label.position = Vector2(18.0, 51.0)
	position_label.add_theme_font_size_override("font_size", 18)
	panel.add_child(position_label)

	speed_label = Label.new()
	speed_label.position = Vector2(18.0, 79.0)
	speed_label.add_theme_font_size_override("font_size", 22)
	panel.add_child(speed_label)

	var nitro_title := Label.new()
	nitro_title.text = "NITRO"
	nitro_title.position = Vector2(18.0, 115.0)
	panel.add_child(nitro_title)

	nitro_bar = ProgressBar.new()
	nitro_bar.position = Vector2(18.0, 139.0)
	nitro_bar.size = Vector2(282.0, 18.0)
	nitro_bar.min_value = 0.0
	nitro_bar.max_value = 100.0
	nitro_bar.show_percentage = false
	panel.add_child(nitro_bar)

	progress_label = Label.new()
	progress_label.position = Vector2(22.0, 216.0)
	progress_label.add_theme_font_size_override("font_size", 18)
	root.add_child(progress_label)

	status_label = Label.new()
	status_label.position = Vector2(22.0, 252.0)
	status_label.add_theme_font_size_override("font_size", 18)
	root.add_child(status_label)

	var help := Label.new()
	help.text = "W/↑ تسارع   S/↓ فرامل   A/D توجيه   SPACE نيترو   SHIFT درفت   R إعادة"
	help.position = Vector2(22.0, 682.0)
	help.add_theme_font_size_override("font_size", 16)
	root.add_child(help)

	finish_panel = Panel.new()
	finish_panel.position = Vector2(365.0, 225.0)
	finish_panel.size = Vector2(550.0, 220.0)
	finish_panel.visible = false
	root.add_child(finish_panel)

	finish_title = Label.new()
	finish_title.position = Vector2(30.0, 30.0)
	finish_title.size = Vector2(490.0, 48.0)
	finish_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	finish_title.add_theme_font_size_override("font_size", 34)
	finish_panel.add_child(finish_title)

	finish_text = Label.new()
	finish_text.position = Vector2(30.0, 92.0)
	finish_text.size = Vector2(490.0, 90.0)
	finish_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	finish_text.add_theme_font_size_override("font_size", 21)
	finish_panel.add_child(finish_text)


func _physics_process(delta: float) -> void:
	if race_finished:
		_update_camera(delta, false, false)
		return

	if collision_cooldown > 0.0:
		collision_cooldown -= delta

	var throttle := Input.is_physical_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)
	var braking := Input.is_physical_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)
	var left_pressed := Input.is_physical_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT)
	var right_pressed := Input.is_physical_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)
	var steer := (-1.0 if left_pressed else 0.0) + (1.0 if right_pressed else 0.0)
	var drift_pressed := Input.is_key_pressed(KEY_SHIFT)
	var nitro_pressed := Input.is_key_pressed(KEY_SPACE)
	var drifting := drift_pressed and abs(steer) > 0.05 and speed > 28.0
	var nitro_active := nitro_pressed and nitro > 0.0 and speed > 10.0 and not drifting

	if throttle:
		speed += 24.0 * delta
	else:
		speed -= 5.0 * delta

	if braking:
		speed -= 38.0 * delta

	if drifting:
		speed -= 7.0 * delta
		nitro = min(100.0, nitro + 16.0 * delta)
		status_label.text = "DRIFT 🔥"
	else:
		status_label.text = ""

	var max_speed := NORMAL_MAX_SPEED
	if nitro_active:
		max_speed = NITRO_MAX_SPEED
		speed += 42.0 * delta
		nitro = max(0.0, nitro - 27.0 * delta)
	else:
		nitro = min(100.0, nitro + 2.0 * delta)

	speed = clampf(speed, 0.0, max_speed)

	var steer_power := 6.0 + speed * 0.055
	if drifting:
		steer_power += 4.0

	car.position.x += steer * steer_power * delta

	if abs(car.position.x) > ROAD_HALF - 1.2:
		speed = max(0.0, speed - 28.0 * delta)

	car.position.x = clampf(car.position.x, -ROAD_HALF - 4.0, ROAD_HALF + 4.0)
	car.position.z -= speed * delta

	var target_yaw := -steer * (0.5 if drifting else 0.18)
	var target_roll := -steer * (0.1 if drifting else 0.055)
	car.rotation.y = lerp_angle(car.rotation.y, target_yaw, min(1.0, delta * 6.0))
	car.rotation.z = lerp(car.rotation.z, target_roll, min(1.0, delta * 8.0))

	for child in car.get_children():
		if child.name == "NitroFlame":
			child.visible = nitro_active
			if nitro_active:
				child.scale.y = 0.85 + sin(Time.get_ticks_msec() * 0.025) * 0.16

	nitro_light.light_energy = 4.2 if nitro_active else 0.0

	_update_rivals(delta)
	_check_rival_collisions()
	_update_camera(delta, nitro_active, drifting)
	_update_hud()

	if car.position.z <= -TRACK_LENGTH:
		_finish_race()


func _update_rivals(delta: float) -> void:
	var lane_choices := [-6.0, -3.0, 0.0, 3.0, 6.0]

	for rival_data in rivals:
		var rival: Node3D = rival_data["node"]
		rival_data["change_timer"] = float(rival_data["change_timer"]) - delta

		if float(rival_data["change_timer"]) <= 0.0:
			rival_data["target_lane"] = lane_choices[rng.randi_range(0, lane_choices.size() - 1)]
			rival_data["change_timer"] = rng.randf_range(1.7, 4.2)

		rival.position.x = lerp(
			rival.position.x,
			float(rival_data["target_lane"]),
			min(1.0, delta * 1.1)
		)

		var target_speed := float(rival_data["target_speed"]) + sin(Time.get_ticks_msec() * 0.001 + float(rival_data["index"])) * 2.0
		var gap := car.position.z - rival.position.z

		if gap > 70.0:
			target_speed += 5.0
		elif gap < -70.0:
			target_speed -= 8.0

		rival_data["speed"] = move_toward(float(rival_data["speed"]), target_speed, 18.0 * delta)
		rival.position.z -= float(rival_data["speed"]) * delta

		var lane_delta := float(rival_data["target_lane"]) - rival.position.x
		rival.rotation.y = -lane_delta * 0.045
		rival.rotation.z = -lane_delta * 0.02


func _check_rival_collisions() -> void:
	if collision_cooldown > 0.0:
		return

	for rival_data in rivals:
		var rival: Node3D = rival_data["node"]
		if abs(car.position.x - rival.position.x) < 3.0 and abs(car.position.z - rival.position.z) < 5.1:
			speed *= 0.62
			nitro = max(0.0, nitro - 16.0)
			collision_cooldown = 0.8
			status_label.text = "CONTACT 💥"
			break


func _update_camera(delta: float, nitro_active: bool, drifting: bool) -> void:
	var desired := car.position + Vector3(car.position.x * -0.08, 6.8, 16.5)
	follow_camera.position = follow_camera.position.lerp(desired, min(1.0, delta * 5.0))

	var target_fov := 78.0 if nitro_active else (70.0 if drifting else 64.0)
	follow_camera.fov = lerp(follow_camera.fov, target_fov, min(1.0, delta * 5.5))

	var look_target := car.position + Vector3(0.0, 1.2, -24.0)
	follow_camera.look_at(look_target, Vector3.UP)


func _update_hud() -> void:
	var kmh := speed * 3.6
	speed_label.text = "السرعة: %d km/h" % int(kmh)
	nitro_bar.value = nitro

	var progress := clampf((-car.position.z / TRACK_LENGTH) * 100.0, 0.0, 100.0)
	progress_label.text = "تقدم السباق: %d%%" % int(progress)

	var ahead := 0
	for rival_data in rivals:
		var rival: Node3D = rival_data["node"]
		if rival.position.z < car.position.z:
			ahead += 1
	position_label.text = "المركز: %d / 10" % (ahead + 1)


func _finish_race() -> void:
	if race_finished:
		return

	race_finished = true
	speed = 0.0

	var ahead := 0
	for rival_data in rivals:
		var rival: Node3D = rival_data["node"]
		if rival.position.z < car.position.z:
			ahead += 1

	var place := ahead + 1
	var place_text := "الأول 🏆" if place == 1 else ("الثاني 🥈" if place == 2 else ("الثالث 🥉" if place == 3 else "المركز %d" % place))

	finish_title.text = "خط النهاية 🏁"
	finish_text.text = "مركزك: %s\nاضغط R لبدء سباق جديد" % place_text
	finish_panel.visible = true


func _reset_race() -> void:
	speed = 0.0
	nitro = 100.0
	steer_visual = 0.0
	race_finished = false
	collision_cooldown = 0.0

	car.position = Vector3(0.0, 0.0, 10.0)
	car.rotation = Vector3.ZERO

	for i in range(rivals.size()):
		var rival_data = rivals[i]
		var rival: Node3D = rival_data["node"]
		var starts := [-18.0, -12.0, -6.0, 6.0, 12.0, 18.0, 24.0, 30.0, 36.0]
		rival.position = Vector3(rival_lanes[i], 0.0, starts[i])
		rival.rotation = Vector3.ZERO
		rival_data["speed"] = 0.0
		rival_data["target_lane"] = rival_lanes[i]
		rival_data["change_timer"] = 1.6 + float(i % 4) * 0.6

	finish_panel.visible = false
	status_label.text = ""
	_update_hud()


func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_R:
			_reset_race()
