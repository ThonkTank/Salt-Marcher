self.setProjectionHandler((definition)=>{
  const match=/^saltmarcher-meter-plane-v1:(\d+(?:\.\d+)?)$/.exec(definition);
  if(!match)throw new Error(`Unexpected CRS worker definition: ${definition}`);
  const units=Number(match[1]);
  return {
    forward:([x,y])=>[x*units,y*units],
    inverse:([x,y])=>[x/units,y/units]
  };
});
