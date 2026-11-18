# The Pig on Trial: animation source

A 60 s vertical short (1080x1920, 30 fps) in the "flat characters in a 3D toon world" style, made with three.js inside
Remotion from the `desenho-animado` skill's Pisa template.

- `src/`: the composition (`Pig.tsx`), timeline and cameras (`story.ts`), Falaise town and courtroom hall (`world.ts`),
  cast and props (`cast.ts`), animals (`beasts.ts`), camera motion blur (`motionblur.ts`), plus the template's shared
  look files (ink, lens blur, grade, lights, paint, toon).
- `lines.json`: sentence timings of the Kokoro voiceover (`../../voiceover/pig-on-trial/voice.wav`); the action keys on them.

## Rebuild

1. Create the skill project (`templates/projeto/` + `npm install`), copy `src/` to `src/videos/pig/` and `Root.tsx` to `src/`.
2. Render (software WebGL works; about 4 s per frame without a GPU):

```bash
npx remotion render src/index.ts PigShort out/video_silent.mp4 --codec h264 --crf 16 --gl=swangle
```

3. Add the voice:

```bash
ffmpeg -i out/video_silent.mp4 -i voice.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -af apad -t 60 pig-on-trial.mp4
```

Motion blur is a post pass (`motionblur.ts`): every pixel is smeared along its screen path between the camera a quarter
frame before and after the frame (180-degree shutter). Camera moves use smootherstep glides and slow creeping zooms, so
no hold is ever static. Test stills: `COMP=PigShort GL=swangle CHROME=<chrome> node bridge-stills.mjs out/s_ 100,500 0.5`.
