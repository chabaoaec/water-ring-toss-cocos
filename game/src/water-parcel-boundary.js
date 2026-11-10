// Passive parcels cannot pass through the shell or evaporate through the water
// plane. Reflect attempted crossings; do not clamp all parcels onto one surface,
// create new IDs, or add a particle-only attraction/mixing force.
export function reflectWaterParcel(point,surface) {
  if(!surface)return true;
  const {min,max}=surface.bounds,n=surface.normal;
  const fold=(value,low,high)=>{const span=high-low,t=((value-low)%(2*span)+2*span)%(2*span);return low+(t<=span?t:2*span-t);};
  for(let pass=0;pass<24;pass++) {
    for(const k of ['x','y','z'])point[k]=fold(point[k],min[k],max[k]);
    const depth=surface.signedDepth(point);
    if(depth>=-1e-8)return true;
    // Equal normal distance on the wet side, preserving tangential position.
    const distance=-2*depth+1e-9;
    point.x-=n.x*distance;point.y-=n.y*distance;point.z-=n.z*distance;
  }
  // The large, nearly full tank normally converges in one or two reflections.
  // Report failure to the caller rather than silently reseeding or hiding it.
  return surface.contains(point,1e-7);
}
