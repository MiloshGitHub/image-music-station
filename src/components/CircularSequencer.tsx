import type { NoteEvent } from '../music/events';
import { midiName } from '../music/scales';
export default function CircularSequencer({events,activeStep,onSelect}:{events:NoteEvent[];activeStep:number;onSelect:(step:number)=>void}){
 const size=340,center=size/2,radius=118;
 return <div className="circle-wrap"><svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Circular sequencer">
 <circle cx={center} cy={center} r={radius} fill="none" stroke="#28313d" strokeDasharray="3 5"/>
 <circle cx={center} cy={center} r={radius-25} fill="none" stroke="#222a34"/>
 {events.map((e,i)=>{const a=i/events.length*Math.PI*2-Math.PI/2,inner=radius-15,outer=radius+(e.active?13+e.velocity*12:3),x1=center+Math.cos(a)*inner,y1=center+Math.sin(a)*inner,x2=center+Math.cos(a)*outer,y2=center+Math.sin(a)*outer,selected=i===activeStep;
 return <g key={e.step} onClick={()=>onSelect(e.step)} className="step-hit" tabIndex={0} role="button" aria-label={`Select step ${i+1}, ${midiName(e.pitch)}`} onKeyDown={ev=>{if(ev.key==='Enter'||ev.key===' ')onSelect(e.step);}}>
 <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={selected?'#fff3b0':e.active?'#86d8c2':'#3a4553'} strokeWidth={selected?9:6} strokeLinecap="round"/>
 <circle cx={center+Math.cos(a)*(radius+31)} cy={center+Math.sin(a)*(radius+31)} r="11" fill={selected?'#fff3b0':'#151a21'} stroke={selected?'#fff3b0':'#3a4553'}/>
 <text x={center+Math.cos(a)*(radius+31)} y={center+Math.sin(a)*(radius+31)+4} fill={selected?'#17191c':'#aeb9c8'} fontSize="10" textAnchor="middle">{i+1}</text>
 </g>})}
 <text x={center} y={center-9} fill="#f2f5fa" fontSize="15" fontWeight="700" textAnchor="middle">IMAGE</text><text x={center} y={center+13} fill="#8e9aaa" fontSize="11" textAnchor="middle">TO MUSIC</text><text x={center} y={center+34} fill="#86d8c2" fontSize="12" textAnchor="middle">{events.length} STEPS</text>
 </svg></div>;
}
