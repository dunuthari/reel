# The Bug That Made GTA: animation source

A 60 s vertical short (1080x1920, 30 fps) in the "flat characters in a 3D toon world" style, made with three.js inside
Remotion. Built from the Ice King composition (same shaders, ink, lens blur, grade, motion blur and character kit).

- `src/story.ts`: timeline (16 shots keyed to the narration's word times), car paths (the chase, the rams), cameras,
  lens blur, what the hero CRT and the whiteboard show.
- `src/world.ts`: three places in one scene: a toon city (avenue, cross streets, tall blocks, lamp posts, trees, parked
  cars), a sandstone street in 1995 Dundee, and the studio's office (desks, beige CRTs, whiteboard, trophy shelf). Cars
  are built in code (`buildCar`) with flashing light bars on the cruisers. The CRT and whiteboard are live canvases
  (`drawGame`, `drawCode` + a cartoon bug, `drawBoard`). The pile of game boxes is one instanced mesh.
- `src/cast.ts`: devs, the publisher, the cop, the robber, fans, Dundee passers-by; crash sparks, smoke, confetti,
  the rule binder, the racing clock.

## Rebuild

1. In the skill project (`templates/projeto/` + `npm install`), copy `src/` to `src/videos/gta/` and `Root.tsx` to `src/`.
2. Render (software WebGL works):

```bash
npx remotion render src/index.ts GtaShort out/video_silent.mp4 --codec h264 --crf 16 --gl=swangle --concurrency 3
```

3. Add the voice and captions:

```bash
ffmpeg -i out/video_silent.mp4 -i voice.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -af apad -t 60 gta-bug.mp4
```

```bash
ffmpeg -i gta-bug.mp4 -vf "ass=gta-bug.ass" -c:v libx264 -crf 18 -preset slow -c:a copy gta-bug-subtitled.mp4
```
