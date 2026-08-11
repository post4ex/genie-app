import json
import os
import re
import time

dist_dir = os.path.dirname(__file__)
dist_path = os.path.join(dist_dir, "dist")
metadata_path = os.path.join(dist_path, "metadata.json")
app_json_path = os.path.join(dist_dir, "app.json")
output_path = os.path.join(dist_path, "android-index.json")

if not os.path.exists(metadata_path):
    print("metadata.json not found in dist/")
    exit(1)

with open(metadata_path, "r") as f:
    data = json.load(f)

runtime_version = "1.0.10"
if os.path.exists(app_json_path):
    with open(app_json_path, "r") as f:
        app_data = json.load(f)
        runtime_version = app_data.get("expo", {}).get("runtimeVersion") or app_data.get("expo", {}).get("version") or "1.0.10"

android_info = data.get("fileMetadata", {}).get("android", {})
bundle_rel = android_info.get("bundle", "")
assets_info = android_info.get("assets", [])

match = re.search(r"index-([a-f0-9]+)\.hbc", bundle_rel)
bundle_hash = match.group(1) if match else "1.0.11"

base_raw = "https://raw.githubusercontent.com/post4ex/genie-app/main/dist/"

manifest = {
    "id": bundle_hash,
    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "runtimeVersion": runtime_version,
    "launchAsset": {
        "url": f"{base_raw}{bundle_rel}",
        "key": bundle_hash,
        "contentType": "application/javascript"
    },
    "assets": [
        {
            "url": f"{base_raw}{a['path']}",
            "key": os.path.basename(a['path']),
            "type": a.get("ext", "png")
        }
        for a in assets_info if "path" in a
    ]
}

with open(output_path, "w") as f:
    json.dump(manifest, f, indent=2)

print(f"✅ Generated {output_path} (runtimeVersion: {runtime_version}, bundle hash: {bundle_hash}, assets: {len(assets_info)})")
