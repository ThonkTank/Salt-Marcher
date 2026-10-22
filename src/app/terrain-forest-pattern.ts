import * as THREE from 'three';
/** Bounded repeat texture for distant forest cartography. */
const random=(x:number,y:number,salt:number)=>{let h=Math.imul(x+salt,374761393)^Math.imul(y-salt,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
export function crownPattern(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const context=canvas.getContext('2d')!;context.fillStyle='#747474';context.fillRect(0,0,256,256);
  const grey=(n:number)=>`rgb(${n},${n},${n})`;
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const cx=(x+.5)*16+(random(x,y,1)-.5)*12,cy=(y+.5)*16+(random(x,y,2)-.5)*12,radius=5.5+random(x,y,3)*5;
    for(const dx of [-256,0,256])for(const dy of [-256,0,256]){
      const px=cx+dx,py=cy+dy;if(px+radius<0||py+radius<0||px-radius>256||py-radius>256)continue;
      context.beginPath();
      for(let n=0;n<=40;n++){const a=n/40*Math.PI*2,r=radius*(1+.065*Math.sin(a*5+random(x,y,4)*6.28)+.045*Math.sin(a*8));
        const xx=px+Math.cos(a)*r,yy=py+Math.sin(a)*r;if(n)context.lineTo(xx,yy);else context.moveTo(xx,yy);}
      context.closePath();context.fillStyle=grey(Math.round(137+random(x,y,5)*14));context.fill();
      context.lineWidth=.8;context.strokeStyle='#535353';context.stroke();
      context.beginPath();context.arc(px-1,py-1,radius*.72,Math.PI*.93,Math.PI*1.68);context.lineWidth=1.2;context.strokeStyle='#b2b2b2';context.stroke();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  return texture;
}

/** World-addressed levels; phase reduction preserves precision far from zero.
 * Retain the forest mass through sparse regional canopy LODs, then hand over
 * between 8 and 2 m/pixel to the nearby individual-tree range. */
export function forestPatternLevels(origin:{x:number;y:number},mpp:number){
  const zoom=Math.log2(mpp*8),cell=2**Math.floor(zoom),t=zoom-Math.floor(zoom),fade=Math.max(0,Math.min(1,(mpp-2)/6));
  const level=(period:number)=>[((origin.x%period)+period)%period/period,((origin.y%period)+period)%period/period,period] as const;
  return {a:level(cell*16),b:level(cell*32),mix:t*t*(3-2*t),opacity:fade*fade*(3-2*fade)};
}
/** Pattern resources survive colour tiles and mesh replacement; poses change uniforms only. */
export class TerrainForestPattern {
  private texture:THREE.Texture|null=null;
  readonly uniforms={forestPattern:{value:null as THREE.Texture|null},forestA:{value:new THREE.Vector3()},forestB:{value:new THREE.Vector3()},forestMix:{value:0},forestOpacity:{value:0}};
  compile(shader:THREE.WebGLProgramParametersWithUniforms){
    this.uniforms.forestPattern.value=this.texture??=crownPattern();Object.assign(shader.uniforms,this.uniforms);
    shader.vertexShader='varying vec2 forestPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nforestPosition=vec2(position.x,-position.y);');
    shader.fragmentShader=`varying vec2 forestPosition;
      uniform sampler2D forestPattern;uniform vec3 forestA;uniform vec3 forestB;uniform float forestMix;uniform float forestOpacity;
      float terrainForestTone(float coverage){
        // Keep implicit mip derivatives outside fragment-dependent branches.
        if(forestOpacity<=0.0)return 1.0;
        float small=texture2D(forestPattern,forestPosition/forestA.z+forestA.xy).r;
        float large=texture2D(forestPattern,forestPosition/forestB.z+forestB.xy).r;
        return mix(1.0,.48+mix(small,large,forestMix),coverage*forestOpacity)*(1.0-forestOpacity*coverage*(1.0-coverage)*.35);
      }\n`+shader.fragmentShader;
  }
  update(origin:{x:number;y:number},mpp:number){
    const p=forestPatternLevels(origin,mpp);this.uniforms.forestA.value.set(...p.a);this.uniforms.forestB.value.set(...p.b);this.uniforms.forestMix.value=p.mix;this.uniforms.forestOpacity.value=p.opacity;
  }
  dispose(){this.texture?.dispose();this.texture=null;}
}
