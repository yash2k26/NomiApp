"""
Bake crown + 3 hair styles into nomi-combined.glb at correct head-relative
positions. Each one is parented to mixamorig:Head bone with applied transforms,
so the runtime only needs visibility toggling — no per-accessory scale/position
overrides.

Modeled after the working approach used previously: import hair, normalize its
size to the pet's head dimensions, position it at head center + small Z offset,
parent to the head bone.
"""
import bpy
import mathutils

ROOT = '/Users/yash/Documents/code/NomiApp'
NOMI_GLB = f'{ROOT}/assets/pets/nomi-combined.glb'

# Source GLBs live in assets/shop/. Paths are relative to ROOT.
# (source_glb, target_node_name, x_factor, y_factor, z_factor, z_offset_factor)
# - x_factor:        lateral (ear-to-ear) scale vs head_max_width
# - y_factor:        front-to-back scale vs head_max_width
# - z_factor:        vertical scale vs head_height
# - z_offset_factor: vertical offset above head center (fraction of head_height)
ACCESSORIES = [
    ('assets/shop/thick_curly_hairs_v7.1.glb',                      'Accessory_Hair',          1.05, 1.05, 1.20, 0.15),
    ('assets/shop/curly_hair_1_beatrice_-_character_hair_free.glb', 'Accessory_HairBeatrice',  1.45, 1.15, 0.75, 0.25),
    ('assets/shop/brown_kink_hairs_08.glb',                         'Accessory_HairKink',      1.05, 1.05, 1.20, 0.15),
    ('assets/shop/little_crown.glb',                                'Accessory_Crown',         0.50, 0.50, 0.45, 0.78),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
print(f'== Loading {NOMI_GLB}')
bpy.ops.import_scene.gltf(filepath=NOMI_GLB)

armature = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
assert armature, 'No armature found'

body_mesh = max(
    [o for o in bpy.data.objects if o.type == 'MESH' and not o.name.startswith('Accessory_')],
    key=lambda o: len(o.data.vertices),
)
print(f'== Body mesh: {body_mesh.name} ({len(body_mesh.data.vertices)} verts)')

# Head bone reference points
head_bone = armature.data.bones['mixamorig:Head']
head_top_bone = armature.data.bones.get('mixamorig:HeadTop_End') or head_bone
head_world_base = armature.matrix_world @ head_bone.head_local
head_world_top = armature.matrix_world @ head_top_bone.head_local
head_height = max((head_world_top - head_world_base).length, 0.05)
print(f'== Head bone world: base={tuple(round(v,3) for v in head_world_base)} top={tuple(round(v,3) for v in head_world_top)} height={round(head_height,3)}')

# Head max width — sample body verts above head bone height
verts_above = [body_mesh.matrix_world @ v.co for v in body_mesh.data.vertices
               if (body_mesh.matrix_world @ v.co).z >= head_world_base.z]
if verts_above:
    head_max_width = max(
        max(v.x for v in verts_above) - min(v.x for v in verts_above),
        max(v.y for v in verts_above) - min(v.y for v in verts_above),
    )
else:
    head_max_width = head_height * 0.9
print(f'== Head max width: {round(head_max_width,3)}')


def bake_one(src_filename, target_name, x_factor, y_factor, z_factor, z_offset):
    print(f'\n== Baking {target_name} from {src_filename}')

    # Remove existing accessory if present
    for o in list(bpy.data.objects):
        if o.name == target_name or o.name.startswith(target_name + '.'):
            bpy.data.objects.remove(o, do_unlink=True)

    src_path = f'{ROOT}/{src_filename}'
    before = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=src_path)
    new_names = [o.name for o in bpy.data.objects if o.name not in before]
    new_meshes = [bpy.data.objects[n] for n in new_names if bpy.data.objects[n].type == 'MESH']

    if not new_meshes:
        print(f'   !! no meshes imported, skipping')
        # Cleanup
        for n in new_names:
            if n in bpy.data.objects:
                bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
        return

    # Unparent each mesh from its scene-graph parent (Sketchfab wrappers etc.)
    for m in new_meshes:
        if m.parent is not None:
            bpy.ops.object.select_all(action='DESELECT')
            m.select_set(True)
            bpy.context.view_layer.objects.active = m
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

    # Join all meshes into one
    bpy.ops.object.select_all(action='DESELECT')
    for m in new_meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = new_meshes[0]
    if len(new_meshes) > 1:
        bpy.ops.object.join()
    accessory = bpy.context.view_layer.objects.active
    accessory.name = target_name

    # Apply any imported scale/rotation/translation onto the geometry
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    print(f'   raw verts: {len(accessory.data.vertices)}')

    # Decimate dense meshes
    if len(accessory.data.vertices) > 50000:
        bpy.ops.object.select_all(action='DESELECT')
        accessory.select_set(True)
        bpy.context.view_layer.objects.active = accessory
        mod = accessory.modifiers.new(name='Decimate', type='DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = 50000 / len(accessory.data.vertices)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        print(f'   decimated to: {len(accessory.data.vertices)} verts')

    # Center geometry at origin
    wv = [accessory.matrix_world @ v.co for v in accessory.data.vertices]
    amin = mathutils.Vector((min(v.x for v in wv), min(v.y for v in wv), min(v.z for v in wv)))
    amax = mathutils.Vector((max(v.x for v in wv), max(v.y for v in wv), max(v.z for v in wv)))
    asize = amax - amin
    acenter = (amin + amax) * 0.5
    accessory.location = (-acenter.x, -acenter.y, -acenter.z)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

    # Scale to fit head (independent X / Y / Z so we can spread asymmetrically)
    scale_x = (head_max_width * x_factor) / max(asize.x, 0.001)
    scale_y = (head_max_width * y_factor) / max(asize.y, 0.001)
    scale_z = (head_height * z_factor) / max(asize.z, 0.001)
    accessory.scale = (scale_x, scale_y, scale_z)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    print(f'   scaled: x={round(scale_x,3)} y={round(scale_y,3)} z={round(scale_z,3)}')

    # Position at head center + Z offset
    target_z = (head_world_base.z + head_world_top.z) * 0.5 + head_height * z_offset
    accessory.location = mathutils.Vector((head_world_base.x, head_world_base.y, target_z))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

    # Parent to head bone
    bpy.ops.object.select_all(action='DESELECT')
    accessory.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')
    armature.data.bones.active = armature.data.bones['mixamorig:Head']
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.parent_set(type='BONE')

    # Cleanup any leftover empties from import
    for nm in list(new_names):
        if nm in bpy.data.objects:
            o = bpy.data.objects[nm]
            if o.type == 'EMPTY':
                bpy.data.objects.remove(o, do_unlink=True)

    print(f'   done.')


for src, name, xf, yf, zf, off in ACCESSORIES:
    bake_one(src, name, xf, yf, zf, off)

# Pack textures so they survive export
for img in list(bpy.data.images):
    try:
        if img.packed_file is None and img.filepath:
            img.pack()
    except Exception:
        pass
    img.use_fake_user = True
for mat in list(bpy.data.materials):
    mat.use_fake_user = True
for o in bpy.data.objects:
    o.hide_viewport = False
    o.hide_select = False

print(f'\n== Exporting back to {NOMI_GLB}')
bpy.ops.export_scene.gltf(
    filepath=NOMI_GLB, export_format='GLB',
    export_animations=True, export_skins=True,
    export_image_format='JPEG', export_image_quality=85, export_yup=True,
)
print('DONE')
