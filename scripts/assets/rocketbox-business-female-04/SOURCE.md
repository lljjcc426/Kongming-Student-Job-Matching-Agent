# Microsoft Rocketbox Business Female 04

- Source: https://github.com/microsoft/Microsoft-Rocketbox
- Source commit: `0943055db6ec570bcef9f2c8b41c9e5467c808f9`
- Character: `Assets/Avatars/Professions/Business_Female_04`
- Face source: `Export/Business_Female_04_facial.fbx`
- License: MIT, included as `LICENSE-Microsoft-Rocketbox.md`

The checked-in PNG textures are 1024 px derivatives of the original TGA textures. The application model retains the 15 Rocketbox visemes and the expression targets used by the native HarmonyOS interview state machine. Unused FACS and tracker-specific targets are removed to keep the HAP suitable for mobile deployment.

Run `npm run build:avatar:rocketbox` to rebuild `professional-interviewer-v5.glb`. The script expects FBX2glTF 0.9.7 through `FBX2GLTF`, the command search path, or the workspace-level `tools/FBX2glTF-v0.9.7` directory.
