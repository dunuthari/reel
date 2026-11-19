# The Ice King: animation source

A 63 s vertical short (1080x1920, 30 fps) in the "flat characters in a 3D toon world" style, made with three.js inside
Remotion. Built from the Pig on Trial composition (same shaders, ink, lens blur, grade, motion blur and character kit).

- `src/story.ts`: timeline (15 shots keyed to `lines.json`), the brig's path, the blocks of ice, cameras, lens blur.
- `src/world.ts`: five places in one scene, each in its own group (only the shot's place is drawn): Boston wharf, a
  frozen pond, Martinique harbour (palms, icehouse, bar), a jail cell, open sea. The brig is built in code
  (`buildShip`) and posed every frame; the sea uses the bridge short's water shader.
- `src/cast.ts`: Tudor (young, then old with a crown), the paper reader, Bostonians, islanders, ice cutters, dockers.
- `src/toon.ts`: adds the newspaper, iced glass, warm cup, ice saw and shovel props, and the crown hat.

## Rebuild

1. In the skill project (`templates/projeto/` + `npm install`), copy `src/` to `src/videos/ice/` and `Root.tsx` to `src/`.
2. Render (software WebGL works; about 7 s per frame on 4 CPU cores):

```bash
npx remotion render src/index.ts IceShort out/video_silent.mp4 --codec h264 --crf 16 --gl=swangle --concurrency 3
```

3. Add the voice and captions:

```bash
ffmpeg -i out/video_silent.mp4 -i voice.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -af apad -t 63 ice-king.mp4
```

```bash
ffmpeg -i ice-king.mp4 -vf "ass=ice-king.ass" -c:v libx264 -crf 18 -preset slow -c:a copy ice-king-subtitled.mp4
```
