// Drawn HUD icon set: one stroke weight, rounded joins, white fill with a dark outline.
// Icons are built as SVG DOM nodes (no inline markup), so they work under the page CSP.
const NS='http://www.w3.org/2000/svg';
type Part=[tag:'path'|'circle'|'rect'|'polygon',attrs:Record<string,string|number>,variant?:'fill'|'line'|'dark'|'accent'];

function gearPath(){
 // Eight rounded teeth around a hub, generated so every tooth is identical.
 const points:string[]=[];
 for(let i=0;i<16;i++){
  const a0=(i/16)*Math.PI*2-Math.PI/16*.55,a1=(i/16)*Math.PI*2+Math.PI/16*.55,r=i%2?7.4:9.6;
  points.push(`${(12+Math.cos(a0)*r).toFixed(2)},${(12+Math.sin(a0)*r).toFixed(2)}`,`${(12+Math.cos(a1)*r).toFixed(2)},${(12+Math.sin(a1)*r).toFixed(2)}`);
 }
 return points.join(' ');
}

const ICONS={
 gear:[['polygon',{points:gearPath()}],['circle',{cx:12,cy:12,r:3},'accent']],
 upgrade:[['polygon',{points:'12,10.6 20.4,19 16.6,19 12,14.4 7.4,19 3.6,19'}],['polygon',{points:'12,3 20.4,11.4 16.6,11.4 12,6.8 7.4,11.4 3.6,11.4'},'accent']],
 cart:[['path',{d:'M2.5 4h2.6l2.3 10.4a1.6 1.6 0 0 0 1.6 1.3h8.5a1.6 1.6 0 0 0 1.6-1.2L21 7.8H6'}],['circle',{cx:9.6,cy:19.6,r:1.7}],['circle',{cx:17.4,cy:19.6,r:1.7}]],
 timer:[['circle',{cx:12,cy:13.5,r:7.6}],['path',{d:'M9.5 2.8h5M12 2.8v3.1M18.2 6.6l1.4-1.4'},'line'],['path',{d:'M12 13.5V9.4M12 13.5l2.8 1.8'},'line']],
 cup:[['path',{d:'M4.5 9h11.5v4.8A5.2 5.2 0 0 1 10.8 19h-1.1a5.2 5.2 0 0 1-5.2-5.2Z'}],['path',{d:'M16 10.4h1.6a2.6 2.6 0 0 1 0 5.2H16M8 3.5c-.8 1 .8 2-.1 3M11.5 3.5c-.8 1 .8 2-.1 3'},'line']],
 fish:[['path',{d:'M2.8 12c2.8-4.6 8.6-6 12.8-2.2L19.2 7v10l-3.6-2.8C11.4 18 5.6 16.6 2.8 12Z'}],['circle',{cx:7.6,cy:11.2,r:1.1},'dark']],
 hook:[['circle',{cx:14.5,cy:3.6,r:1.6}],['path',{d:'M14.5 5.2v8.8a4.6 4.6 0 0 1-9.2 0V11l-2.3 2.6'},'line']],
 drop:[['path',{d:'M12 2.8c3.6 4.6 6.2 7.8 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 10.6 8.4 7.4 12 2.8Z'}],['path',{d:'M9.2 14.5a2.9 2.9 0 0 0 2.6 2.7'},'line']],
 check:[['path',{d:'M4.8 12.6l4.6 4.6 9.8-10'},'line']],
 lock:[['rect',{x:5,y:10.5,width:14,height:10,rx:2.6}],['path',{d:'M8 10.5V8a4 4 0 0 1 8 0v2.5'},'line'],['circle',{cx:12,cy:15.3,r:1.3},'dark']],
 pin:[['path',{d:'M12 21.4s-6.6-6.2-6.6-11.1a6.6 6.6 0 0 1 13.2 0c0 4.9-6.6 11.1-6.6 11.1Z'}],['circle',{cx:12,cy:10.2,r:2.3},'accent']],
 compass:[['circle',{cx:12,cy:12,r:9}],['polygon',{points:'12,5.6 14.6,12 12,18.4 9.4,12'},'accent']],
 wrench:[['path',{d:'M15.6 3.6a4.7 4.7 0 0 0-5.7 5.9L3.6 15.8l4.6 4.6 6.3-6.3a4.7 4.7 0 0 0 5.9-5.7l-2.9 2.9-2.8-.7-.7-2.8Z'}]],
 boat:[['path',{d:'M2.8 14h18.4l-2.6 5.4H5.4Z'}],['path',{d:'M12 2.8V14'},'line'],['path',{d:'M12.6 4l6 8h-6Z'},'accent']],
 crew:[['path',{d:'M4.6 20.6a7.4 7.4 0 0 1 14.8 0Z'}],['circle',{cx:12,cy:8.6,r:3.8}],['path',{d:'M7.6 6.4c1.2-2.6 7.6-2.6 8.8 0Z'},'accent']],
 rod:[['path',{d:'M3.6 20.4 18.6 3.6'},'line'],['circle',{cx:7.4,cy:16.2,r:2.3}],['path',{d:'M18.6 3.6v9.6a1.8 1.8 0 0 1-3.6 0'},'line']],
 sun:[['circle',{cx:12,cy:12,r:4.4},'accent'],['path',{d:'M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4M5.4 5.4l1.7 1.7M16.9 16.9l1.7 1.7M5.4 18.6l1.7-1.7M16.9 7.1l1.7-1.7'},'line']],
 snow:[['path',{d:'M12 2.8v18.4M4 7.4l16 9.2M4 16.6l16-9.2M9.6 4.4 12 6.6l2.4-2.2M9.6 19.6 12 17.4l2.4 2.2'},'line']],
 wave:[['path',{d:'M2.6 10.2c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0 3.6-2.2 4.4-1.4M2.6 15.8c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0 3.6-2.2 4.4-1.4'},'line']],
 trophy:[['path',{d:'M7 3.6h10v4.8a5 5 0 0 1-10 0Z'}],['path',{d:'M7 5.4H4.4a2.8 2.8 0 0 0 3 3.6M17 5.4h2.6a2.8 2.8 0 0 1-3 3.6M12 13.4v3.6M8.2 20.4h7.6l-1-3.4H9.2Z'},'line']],
 play:[['path',{d:'M7.4 4.6v14.8L19.2 12Z'}]],
 pause:[['rect',{x:5.6,y:4.6,width:4.4,height:14.8,rx:1.2}],['rect',{x:14,y:4.6,width:4.4,height:14.8,rx:1.2}]],
 expand:[['path',{d:'M4 9.4V4h5.4M20 9.4V4h-5.4M4 14.6V20h5.4M20 14.6V20h-5.4'},'line']],
 fast:[['path',{d:'M3.4 5.6v12.8L11.6 12Z'}],['path',{d:'M12 5.6v12.8L20.2 12Z'}]],
 reset:[['path',{d:'M19.4 12a7.4 7.4 0 1 1-2.2-5.2'},'line'],['polygon',{points:'20.4,3.6 20.4,9.2 14.8,9.2'},'dark']],
} satisfies Record<string,Part[]>;
export type IconName=keyof typeof ICONS;

export function icon(name:IconName,className=''){
 const svg=document.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
 svg.setAttribute('class',('focus-icon '+className).trim());
 for(const [tag,attrs,variant] of ICONS[name] as Part[]){
  const node=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  node.setAttribute('class','focus-icon-'+(variant??'fill'));
  svg.append(node);
 }
 return svg;
}

/** Text with inline icons: "{fish}" style tokens become icons, the rest stays text. */
export function withIcons(text:string,make:(name:IconName|'coin')=>Node):Node[]{
 return text.split(/(\{[a-z]+\})/).filter(Boolean).map(part=>{
  const match=/^\{([a-z]+)\}$/.exec(part);
  return match?make(match[1] as IconName|'coin'):document.createTextNode(part);
 });
}
