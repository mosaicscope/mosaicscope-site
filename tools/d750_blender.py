# Builds a Nikon D750-style DSLR in Blender and renders transparent PNG layers (assembled + exploded parts).
# Run: "D:\blender new\blender.exe" -b -P tools/d750_blender.py -- <outdir> [samples] [assembled_only]
import bpy, bmesh, math, sys, os
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else os.path.abspath('assets/d750')
SAMPLES = int(argv[1]) if len(argv) > 1 else 48
ONLY_ASM = len(argv) > 2 and argv[2] == '1'
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
LAYERS = {}

def mat(name, col, rough=0.5, metal=0.0, bump=None, spec=0.5, coat=0.0, emit=None, es=0):
    m = bpy.data.materials.new(name); m.use_nodes = True; n = m.node_tree.nodes; l = m.node_tree.links
    b = n['Principled BSDF']; b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    for k in ('Specular IOR Level', 'Specular'):
        if k in b.inputs: b.inputs[k].default_value = spec
    if coat and 'Coat Weight' in b.inputs: b.inputs['Coat Weight'].default_value = coat
    if emit and 'Emission Color' in b.inputs: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = es
    if bump:
        tc = n.new('ShaderNodeTexCoord'); vo = n.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = bump[0]; vo.feature = 'F1'
        mp = n.new('ShaderNodeMapping'); l.new(tc.outputs['Object'], mp.inputs['Vector']); l.new(mp.outputs['Vector'], vo.inputs['Vector'])
        no = n.new('ShaderNodeTexNoise'); no.inputs['Scale'].default_value = bump[0] * 2.2; l.new(mp.outputs['Vector'], no.inputs['Vector'])
        mx = n.new('ShaderNodeMath'); mx.operation = 'ADD'; l.new(vo.outputs['Distance'], mx.inputs[0]); l.new(no.outputs['Fac'], mx.inputs[1])
        bp = n.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump[1]; bp.inputs['Distance'].default_value = 0.05
        l.new(mx.outputs['Value'], bp.inputs['Height']); l.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

def reg(layer, o, m=None, smooth=True):
    if m: o.data.materials.append(m)
    if smooth and o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = True
    for c in list(o.users_collection): c.objects.unlink(o)
    sc.collection.objects.link(o); LAYERS.setdefault(layer, []).append(o); return o

def rbox(name, size, loc, bevel=0.3, layer='body', m=None, seg=4, sub=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new('b', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'ANGLE'
    if sub: s = o.modifiers.new('s', 'SUBSURF'); s.levels = sub
    return reg(layer, o, m)

def cyl(name, r, depth, loc, layer, m, verts=96, rot=(math.pi / 2, 0, 0), bevel=0.0, fill='NGON'):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot, end_fill_type=fill); o = bpy.context.active_object; o.name = name
    if bevel: bv = o.modifiers.new('b', 'BEVEL'); bv.width = bevel; bv.segments = 3
    return reg(layer, o, m)

def torus(name, R, r, loc, layer, m, rot=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=128, minor_segments=24, location=loc, rotation=rot); o = bpy.context.active_object; o.name = name
    return reg(layer, o, m)

def plane(name, w, h, loc, layer, m, rot=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot); o = bpy.context.active_object; o.name = name; o.scale = (w, h, 1)
    bpy.ops.object.transform_apply(scale=True); return reg(layer, o, m)

def text(name, s, size, loc, layer, m, ext=0.08, font=None):
    bpy.ops.object.text_add(location=loc, rotation=(math.pi / 2, 0, 0)); o = bpy.context.active_object; o.name = name; o.data.body = s; o.data.size = size; o.data.extrude = ext
    o.data.align_x = 'CENTER'; o.data.align_y = 'CENTER'
    if font: o.data.font = font
    o.data.bevel_depth = 0.01; o.data.materials.append(m)
    for c in list(o.users_collection): c.objects.unlink(o)
    sc.collection.objects.link(o); LAYERS.setdefault(layer, []).append(o); return o

# ---------- materials ----------
M_body = mat('body', (0.012, 0.012, 0.014), 0.52, 0, bump=(60, 0.12), spec=0.45)
M_grip = mat('grip', (0.010, 0.010, 0.011), 0.62, 0, bump=(26, 0.9), spec=0.3)
M_rub = mat('rubber', (0.006, 0.006, 0.007), 0.7, 0, bump=(90, 0.15), spec=0.3)
M_blk = mat('black', (0.004, 0.004, 0.005), 0.35, 0, spec=0.5)
M_chr = mat('chrome', (0.85, 0.86, 0.9), 0.14, 1.0)
M_alu = mat('alu', (0.5, 0.5, 0.52), 0.35, 1.0)
M_wht = mat('white', (0.92, 0.92, 0.9), 0.4, 0, emit=(1, 1, 1), es=0.35)
M_red = mat('red', (0.75, 0.04, 0.02), 0.28, 0, spec=0.6, coat=0.6)
M_gold = mat('gold', (0.9, 0.62, 0.15), 0.25, 1.0)
M_glass = mat('glass', (0.01, 0.015, 0.02), 0.03, 0.0, spec=1.0, coat=1.0)
M_g2 = mat('glass2', (0.02, 0.05, 0.05), 0.02, 0.0, spec=1.0, coat=1.0)
M_gl2 = None
M_amber = mat('coat_amber', (0.28, 0.12, 0.02), 0.04, 0, spec=1, coat=1, emit=(0.9, 0.45, 0.1), es=0.5)
M_purp = mat('coat_purp', (0.06, 0.02, 0.2), 0.04, 0, spec=1, coat=1, emit=(0.35, 0.1, 0.9), es=0.35)
M_grn = mat('coat_grn', (0.02, 0.15, 0.08), 0.04, 0, spec=1, coat=1, emit=(0.1, 0.8, 0.4), es=0.25)
M_pcb = mat('pcb', (0.03, 0.22, 0.1), 0.35, 0, spec=0.6, coat=0.4)
M_lcd = mat('lcd', (0.005, 0.01, 0.02), 0.04, 0, spec=1, coat=1, emit=(0.2, 0.5, 0.9), es=0.5)
M_sens = mat('sensor', (0.12, 0.05, 0.3), 0.05, 0.4, spec=1, coat=1, emit=(0.25, 0.1, 0.6), es=0.4)
M_batt = mat('batt', (0.08, 0.09, 0.11), 0.4, 0, spec=0.5)
M_prism = mat('prism', (0.5, 0.65, 0.8), 0.02, 0, spec=1, coat=1)
M_gl = bpy.data.materials.new('clear'); M_gl.use_nodes = True
g = M_gl.node_tree.nodes['Principled BSDF']; g.inputs['Roughness'].default_value = 0.0; g.inputs['Transmission Weight'].default_value = 1.0; g.inputs['IOR'].default_value = 1.5; g.inputs['Base Color'].default_value = (0.8, 0.9, 1, 1)

# ---------- body (x right, y back, z up; camera sits at -y) ----------
W, D, Hb = 14.1, 7.6, 8.9
rbox('bodyShell', (W, D, Hb), (0, 0, 0.45), bevel=1.0, layer='body', m=M_body, seg=6)
rbox('rightShoulder', (3.6, D * 0.98, 1.2), (5.6, 0, 4.7), bevel=0.5, layer='body', m=M_body)
rbox('leftShoulder', (4.8, D * 0.98, 1.0), (-4.6, 0, 4.8), bevel=0.5, layer='body', m=M_body)
# grip on screen-left
rbox('grip', (4.6, 2.0, 7.7), (-4.7, -D / 2 - 0.3, -0.7), bevel=0.9, layer='body', m=M_grip, seg=6)
rbox('rightPad', (2.9, 0.25, 6.2), (5.2, -D / 2 - 0.1, -0.2), bevel=0.2, layer='body', m=M_grip)
# red grip accent
plane('redStripe', 3.9, 0.22, (-4.6, -D / 2 - 1.28, 3.35), 'body', M_red, rot=(math.pi / 2, 0, math.radians(-8)))
# AF-assist / flash button / strap lugs
cyl('afLamp', 0.42, 0.25, (-0.2 - 4.0, -D / 2 - 0.2, 3.3), 'body', M_chr, verts=48, rot=(math.pi / 2, 0, 0))
torus('lugL', 0.38, 0.1, (-6.55, -2.0, 4.0), 'body', M_chr, rot=(0, math.pi / 4, 0))
torus('lugR', 0.38, 0.1, (6.55, -2.0, 3.6), 'body', M_chr, rot=(0, -math.pi / 4, 0))
# logo plates
plane('d750Plate', 2.3, 1.15, (5.55, -D / 2 - 0.2, 1.9), 'body', M_blk)
text('d750', 'D750', 0.72, (5.55, -D / 2 - 0.3, 1.9), 'body', M_wht, 0.05)
rbox('fxPlate', (1.0, 0.1, 0.9), (6.1, -D / 2 - 0.1, -3.6), bevel=0.05, layer='body', m=M_blk)
text('fx', 'FX', 0.62, (6.1, -D / 2 - 0.3, -3.6), 'body', M_gold, 0.05)
# lens mount
torus('mountRing', 3.9, 0.35, (0, -D / 2 - 0.35, 0), 'body', M_chr)
cyl('mountDark', 3.7, 0.5, (0, -D / 2 - 0.15, 0), 'body', M_blk, bevel=0.0)

# ---------- top hump (pentaprism housing) + controls ----------
rbox('hump', (6.9, 5.6, 3.6), (0.9, -0.9, 6.6), bevel=1.0, layer='top', m=M_body, seg=6)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.9, -3.3, 6.1)); o = bpy.context.active_object; o.scale = (6.0, 1.6, 2.6); o.name = 'humpFront'
bpy.ops.object.transform_apply(scale=True); bv = o.modifiers.new('b', 'BEVEL'); bv.width = 0.7; bv.segments = 6; reg('top', o, M_body)
plane('nikonBadge', 4.3, 1.5, (0.9, -4.12, 6.2), 'top', M_blk, rot=(math.pi / 2 - math.radians(12), 0, 0))
text('nikon', 'Nikon', 1.6, (0.9, -4.2, 6.2), 'top', M_wht, 0.06)
rbox('hotshoe', (2.3, 1.7, 0.4), (0.9, -0.9, 8.55), bevel=0.06, layer='top', m=M_chr)
# mode dial (right) with knurling
cyl('modeDial', 2.1, 2.2, (6.1, -0.7, 5.8), 'top', M_blk, verts=72, rot=(0, 0, 0), bevel=0.05)
for i in range(60):
    a = i / 60 * math.tau; bpy.ops.mesh.primitive_cube_add(size=1, location=(6.1 + 2.1 * math.cos(a), -0.7 + 2.1 * math.sin(a), 5.8)); k = bpy.context.active_object; k.scale = (0.1, 0.1, 2.0); k.rotation_euler[2] = a; reg('top', k, M_blk, smooth=False)
cyl('modeTop', 1.5, 0.5, (6.1, -0.7, 6.95), 'top', M_alu, verts=64, rot=(0, 0, 0), bevel=0.04)
# left controls: on/off collar, shutter button, movie + info buttons
cyl('collar', 1.7, 0.9, (-4.9, -2.2, 5.4), 'top', M_blk, verts=64, rot=(0, 0, 0), bevel=0.1)
cyl('shutterBtn', 0.95, 0.5, (-4.9, -2.2, 6.0), 'top', M_blk, verts=48, rot=(0, 0, 0), bevel=0.15)
cyl('shutterRing', 1.05, 0.12, (-4.9, -2.2, 5.78), 'top', M_chr, verts=48, rot=(0, 0, 0))
cyl('movieBtn', 0.34, 0.3, (-2.9, -2.4, 5.6), 'top', M_red, verts=32, rot=(0, 0, 0), bevel=0.04)
cyl('infoBtn', 0.34, 0.3, (-2.2, -2.4, 5.55), 'top', M_blk, verts=32, rot=(0, 0, 0), bevel=0.04)
# front command dial (grip top)
cyl('cmdDial', 1.2, 2.6, (-3.6, -D / 2 - 0.9, 3.7), 'top', M_blk, verts=64, rot=(0, math.pi / 2, math.radians(-8)), bevel=0.1)

# ---------- lens (Nikkor 24-120 style) ----------
Y0 = -D / 2 - 0.2
cyl('lensBarrel', 4.55, 7.2, (0, Y0 - 3.6, 0), 'lens', M_rub, verts=160, fill='NOTHING')
for i, (r, dy, mm) in enumerate([(4.62, 1.2, M_rub), (4.35, 3.0, M_blk)]):
    cyl('lensRing%d' % i, r, 1.4, (0, Y0 - dy, 0), 'lens', mm, verts=160, fill='NOTHING')
for i in range(120):   # zoom ring ribs
    a = i / 120 * math.tau; bpy.ops.mesh.primitive_cube_add(size=1, location=(4.58 * math.cos(a), Y0 - 3.4, 4.58 * math.sin(a))); k = bpy.context.active_object; k.scale = (0.12, 2.0, 0.22); k.rotation_euler[1] = -a; reg('lens', k, M_blk, smooth=False)
cyl('frontBezel', 4.5, 0.8, (0, Y0 - 7.4, 0), 'lens', M_blk, verts=160, fill='NOTHING')
torus('frontRim', 4.18, 0.2, (0, Y0 - 7.85, 0), 'lens', M_alu)
cyl('innerBarrel', 3.9, 1.5, (0, Y0 - 7.0, 0), 'lens', M_blk, verts=160, fill='NOTHING')
# inner tube stages, each narrower and deeper
for i, (r, dy) in enumerate([(3.55, 6.2), (3.15, 5.0), (2.55, 4.0), (1.9, 3.1)]):
    cyl('stage%d' % i, r, 1.2, (0, Y0 - dy, 0), 'lens', M_blk if i % 2 == 0 else M_alu, verts=128, fill='NOTHING')
    torus('stageRim%d' % i, r - 0.05, 0.07, (0, Y0 - dy - 0.2, 0), 'lens', M_alu)
# glass elements: coated rings stacked down the barrel (annuli so deeper ones stay visible)
for i, (r, dy, mm) in enumerate([(3.55, 6.4, M_grn), (3.2, 5.4, M_amber), (2.7, 4.5, M_purp), (2.15, 3.6, M_grn), (1.6, 2.9, M_amber), (1.15, 2.4, M_purp)]):
    bpy.ops.mesh.primitive_torus_add(major_radius=r * 0.82, minor_radius=r * 0.2, major_segments=128, minor_segments=32, location=(0, Y0 - dy, 0), rotation=(math.pi / 2, 0, 0)); o = bpy.context.active_object; o.name = 'elem%d' % i; o.scale = (1, 1, 0.5)
    bpy.ops.object.transform_apply(scale=True); reg('lens', o, mm)
cyl('frontGlass', 3.75, 0.12, (0, Y0 - 7.75, 0), 'lens', M_gl, verts=160, fill='NGON')
cyl('apertureBlades', 0.9, 0.2, (0, Y0 - 1.9, 0), 'lens', M_blk, verts=9, fill='NOTHING')
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.52, location=(0, Y0 - 2.1, 0)); o = bpy.context.active_object; o.name = 'rearElem'; reg('lens', o, M_amber)

# ---------- internals (flat, front-facing, placed where they live inside the body) ----------
yi = -1.2
plane('sensorFrame', 4.2, 3.0, (0, yi, 0), 'sensor', M_gold)
plane('sensorGlass', 3.6, 2.4, (0, yi - 0.02, 0), 'sensor', M_sens)
for k in range(7): plane('sPin%d' % k, 0.18, 0.5, (-2.4 + k * 0.0, yi, 1.0 - k * 0.3), 'sensor', M_gold)
for k in range(7): plane('sPin%d' % (k + 9), 0.5, 0.18, (2.3, yi, 1.0 - k * 0.3), 'sensor', M_gold)
rbox('shutterFrame', (5.0, 0.5, 3.8), (0, yi + 0.6, 0), bevel=0.2, layer='shutter', m=M_blk)
for k in range(5): rbox('blade%d' % k, (4.4, 0.1, 0.55), (0, yi + 0.3, 1.4 - k * 0.7), bevel=0.04, layer='shutter', m=M_chr)
rbox('mirrorBox', (5.8, 0.25, 3.0), (0, -2.0, 1.9), bevel=0.12, layer='mirror', m=M_blk)
plane('mirrorGlass', 5.4, 2.6, (0, -2.16, 1.9), 'mirror', M_chr)
rbox('pcbBoard', (5.6, 0.2, 5.8), (-0.4, 1.2, 0.6), bevel=0.1, layer='board', m=M_pcb)
for i in range(9): rbox('chip%d' % i, (0.9 + 0.2 * (i % 3), 0.2, 0.9), (-2.0 + (i % 3) * 1.6, 1.0, 2.4 - (i // 3) * 1.8), bevel=0.04, layer='board', m=M_blk)
for i in range(18): rbox('trace%d' % i, (0.06, 0.04, 4.6), (-2.6 + i * 0.3, 1.05, 0.6), bevel=0.01, layer='board', m=M_gold)
rbox('batteryBody', (3.2, 1.0, 5.0), (-4.2, -0.2, -0.8), bevel=0.3, layer='battery', m=M_batt)
rbox('batteryLabel', (2.8, 0.05, 1.8), (-4.2, -0.72, -0.3), bevel=0.02, layer='battery', m=M_wht)
text('battTxt', 'EN-EL15', 0.5, (-4.2, -0.78, -0.3), 'battery', M_blk, 0.02)
rbox('lcdFrame', (6.0, 0.3, 3.6), (0.0, 3.6, -0.2), bevel=0.15, layer='lcd', m=M_blk)
plane('lcdScreen', 5.5, 3.1, (0, 3.42, -0.2), 'lcd', M_lcd)
text('lcdTxt', '1/250  f/4  ISO 100', 0.45, (0, 3.38, -0.2), 'lcd', M_wht, 0.01)
bm = bmesh.new(); pts = [(-2.6, 0), (2.6, 0), (2.6, 1.2), (0, 2.8), (-2.6, 1.2)]
vs = [bm.verts.new((x, -0.4, z)) for x, z in pts]; f = bm.faces.new(vs); r = bmesh.ops.extrude_face_region(bm, geom=[f]); [setattr(v, 'co', v.co + Vector((0, 1.8, 0))) for v in r['geom'] if isinstance(v, bmesh.types.BMVert)]
me = bpy.data.meshes.new('prism'); bm.to_mesh(me); bm.free(); po = bpy.data.objects.new('pentaprism', me); sc.collection.objects.link(po); po.location = (0.8, 0, 5.4); po.data.materials.append(M_prism); LAYERS.setdefault('prism', []).append(po)
bv = po.modifiers.new('b', 'BEVEL'); bv.width = 0.1
cyl('eyepieceTube', 0.95, 0.6, (0.8, 1.2, 6.4), 'prism', M_blk, verts=48)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.65, location=(0.8, 1.55, 6.4)); o = bpy.context.active_object; o.scale = (1, 0.3, 1); o.name = 'eyeLens'; reg('prism', o, M_grn)

# ---------- scene: camera, lights, render ----------
cam = bpy.data.cameras.new('cam'); cam.lens = 135; cam.sensor_width = 36
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0.3, -78, 1.6); co.rotation_euler = (math.pi / 2, 0, 0)
def light(n, loc, e, size, tgt=(0, 0, 0)):
    l = bpy.data.lights.new(n, 'AREA'); l.energy = e; l.size = size; o = bpy.data.objects.new(n, l); sc.collection.objects.link(o); o.location = loc
    d = Vector(tgt) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); return o
light('key', (-10, -40, 22), 22000, 18, (0, -3, 2)); light('fill', (20, -40, 4), 5000, 24, (0, -3, 0)); light('rim', (0, -10, 30), 9000, 20, (0, -3, 3)); light('under', (0, -35, -22), 1500, 30, (0, -3, -2))
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; bg = sc.world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.5, 0.52, 0.58, 1); bg.inputs['Strength'].default_value = 0.12
r = sc.render; r.engine = 'CYCLES'; r.resolution_x = 1800; r.resolution_y = 1350; r.film_transparent = True
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.cycles.max_bounces = 6; sc.cycles.transparent_max_bounces = 8
try: sc.cycles.use_adaptive_sampling = True
except Exception: pass

def show(names):
    keep = set()
    for n in names: keep.update(LAYERS.get(n, []))
    for o in sc.objects:
        if o.type in ('CAMERA', 'LIGHT'): continue
        o.hide_render = o not in keep
def shoot(name, names):
    show(names); r.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True); print('rendered', name)
ALL = list(LAYERS.keys())
shoot('assembled', ['body', 'top', 'lens'])
if not ONLY_ASM:
    for L in ('body', 'top', 'lens', 'sensor', 'shutter', 'mirror', 'board', 'battery', 'lcd', 'prism'): shoot(L, [L])
