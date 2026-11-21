import React from "react";
import { Composition } from "remotion";
import { PisaShort, PISA_FRAMES } from "./videos/pisa/Pisa";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { PigShort, PIG_FRAMES } from "./videos/pig/Pig";
import { IceShort, ICE_FRAMES } from "./videos/ice/Ice";
import { GtaShort, GTA_FRAMES } from "./videos/gta/Gta";
// Cada desenho novo: copie templates/pisa/ para src/videos/<nome>/, renomeie e registre aqui.
// PigShort60 is the motion-blur render: 60 fps sub-frames of the same 30 fps timeline, averaged in pairs by ffmpeg.
export const Root: React.FC = () => (
  <>
    <Composition id="PisaShort" component={PisaShort} durationInFrames={PISA_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="PigShort" component={PigShort} durationInFrames={PIG_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="PigShort60" component={PigShort} durationInFrames={PIG_FRAMES * 2} fps={60} width={1080} height={1920} />
    <Composition id="IceShort" component={IceShort} durationInFrames={ICE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="GtaShort" component={GtaShort} durationInFrames={GTA_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
