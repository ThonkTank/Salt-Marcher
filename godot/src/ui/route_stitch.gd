extends Control

var ink := Color("#75979a")
var brass := Color("#d2a743")


func _ready() -> void:
	custom_minimum_size = Vector2(68, 360)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	queue_redraw()


func _draw() -> void:
	var x := size.x * 0.5
	var top := 22.0
	var bottom := maxf(top + 120.0, size.y - 22.0)
	draw_dashed_line(Vector2(x, top), Vector2(x, bottom), ink, 2.0, 8.0, true)
	var stops := [top, lerpf(top, bottom, 0.34), lerpf(top, bottom, 0.67), bottom]
	for index in stops.size():
		var radius := 7.0 if index == 0 else 4.0
		var color := brass if index == 0 else ink
		draw_circle(Vector2(x, stops[index]), radius, color, true, -1.0, true)
		draw_circle(Vector2(x, stops[index]), radius + 4.0, Color(color, 0.18), false, 2.0, true)
