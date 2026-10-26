import type { DurationSource, Feature, MappingSettings, NoteEvent, PitchSource, VolumeSource } from './events';
import { quantizeToScale } from './scales';
function pitchValue(f:Feature,s:PitchSource):number {
 if(s==='line-position')return f.linePosition ?? .5;
 if(s==='line-area')return f.lineArea ?? 0;
 if(s==='line-tangent')return f.lineTangent ?? .5;
 if(s==='brightness')return f.brightness;
 if(s==='vertical')return f.position ?? f.step/63;
 if(s==='edge')return f.edge ?? 0;
 if(s==='object-position')return f.objectFound?(f.position ?? .5):.5;
 return f.hue/360;
}
function durationValue(f:Feature,s:DurationSource):number {
 if(s==='line-position')return f.linePosition ?? .5;
 if(s==='line-area')return f.lineArea ?? 0;
 if(s==='line-tangent')return f.lineTangent ?? .5;
 if(s==='fixed')return .72;
 if(s==='saturation')return f.saturation;
 if(s==='edge')return f.edge ?? 0;
 if(s==='object-size')return f.objectFound?(f.objectSize ?? 0):0;
 return f.brightness;
}
function volumeValue(f:Feature,s:VolumeSource):number {
 if(s==='line-position')return f.linePosition ?? .5;
 if(s==='line-area')return f.lineArea ?? 0;
 if(s==='line-tangent')return f.lineTangent ?? .5;
 if(s==='fixed')return .8;
 if(s==='saturation')return f.saturation;
 if(s==='edge')return f.edge ?? 0;
 return f.brightness;
}
export function mapFeaturesToEvents(features:Feature[],settings:MappingSettings):NoteEvent[]{
 const count=Math.max(1,settings.steps);
 return Array.from({length:count},(_,step)=>{
  const f=features[step]??{step,hue:0,brightness:.5,saturation:.5,edge:0,position:step/Math.max(1,count-1),objectSize:0,objectFound:false};
  const norm=Math.max(0,Math.min(1,pitchValue(f,settings.pitchSource)));
  const raw=settings.minMidi+norm*(settings.maxMidi-settings.minMidi);
  const pitch=quantizeToScale(raw,settings.rootMidi,settings.scale,settings.minMidi,settings.maxMidi);
  const durationNorm=Math.max(0,Math.min(1,durationValue(f,settings.durationSource)));
  const duration=settings.stepBeats*(.12+durationNorm*.84);
  const velocity=Math.max(.03,Math.min(1,.05+volumeValue(f,settings.volumeSource ?? 'brightness')*.95));
    const active=settings.analysisMode==='line-to-follow'?f.lineFound===true:f.brightness*100>=settings.threshold;
    return {step,pitch,duration,velocity,probability:1,active};
 });
}
