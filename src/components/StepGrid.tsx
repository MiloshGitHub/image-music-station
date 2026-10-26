import type { NoteEvent } from '../music/events';
import { midiName } from '../music/scales';

const MAX_PER_LINE = 16;

export default function StepGrid({events,activeStep,onSelect}:{events:NoteEvent[];activeStep:number;onSelect:(step:number)=>void}){
 const lines = Math.max(1, Math.ceil(events.length / MAX_PER_LINE));
 const perLine = Math.max(1, Math.ceil(events.length / lines));
 const pitches = events.map(e=>e.pitch);
 const lo = Math.min(...pitches), hi = Math.max(...pitches);
 const span = Math.max(1, hi - lo);
 const rows: NoteEvent[][] = [];
 for (let i = 0; i < events.length; i += perLine) rows.push(events.slice(i, i + perLine));
 return <div className="pillar-grid">{rows.map((row,r)=><div key={r} className="pillar-line" style={{gridTemplateColumns:`repeat(${perLine}, 1fr)`}}>
  {row.map(e=>{
   const h = 12 + ((e.pitch - lo) / span) * 88;
   const w = Math.max(10, Math.min(100, e.duration * 100));
   const v = Math.max(0.1, Math.min(1, e.velocity));
   return <button key={e.step} className={`pillar-slot ${e.active?'on':''} ${e.step===activeStep?'playhead':''}`} onClick={()=>onSelect(e.step)} title={`Step ${e.step+1}: ${midiName(e.pitch)} · dur ${Math.round(e.duration*100)}% · vol ${Math.round(e.velocity*100)}%`}>
    <span className="pillar" style={{height:`${h}%`,width:`${w}%`,background:`rgba(80,200,255,${v})`}}/>
    <small>{e.step+1}</small>
   </button>;
  })}
 </div>)}</div>;
}
