# Pet GLB Models

This folder contains GLB 3D models for Oracle Pet.

## Required Files

- `default.glb` - Default pet model (required)

## Model Specifications

- Format: GLB (Binary glTF)
- Recommended poly count: < 50,000 triangles
- Centered at origin (0, 0, 0)
- Scale: ~1 unit tall
- Y-axis up

## Skin Support

The PetRenderer component applies material changes for different skins:
- Default (purple)
- Gold (metallic gold)
- Silver (metallic silver)
- Ruby (red)
- Emerald (green)
- Sapphire (blue)
- Obsidian (dark)
- Crystal (transparent/white)

## Adding New Models

1. Export model as GLB
2. Place in this folder
3. Update `nftHelpers.ts` metadata
