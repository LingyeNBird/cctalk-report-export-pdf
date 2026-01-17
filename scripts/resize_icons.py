import os
from PIL import Image

source_path = "chrome-plugin/icons/source.png"
output_dir = "chrome-plugin/icons"

sizes = {"icon16.png": (16, 16), "icon48.png": (48, 48), "icon128.png": (128, 128)}

try:
    img = Image.open(source_path)
    print(f"Source image: {source_path}")
    print(f"Original size: {img.size}")
    print(f"Mode: {img.mode}")

    for filename, size in sizes.items():
        output_path = os.path.join(output_dir, filename)
        resized = img.resize(size, Image.Resampling.LANCZOS)
        resized.save(output_path, "PNG")
        print(f"Created: {filename} ({size[0]}x{size[1]})")

    print("\nAll icons created successfully!")

except FileNotFoundError:
    print(f"Error: Source image not found at {source_path}")
except Exception as e:
    print(f"Error: {e}")
