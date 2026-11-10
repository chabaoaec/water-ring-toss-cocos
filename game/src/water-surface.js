// A volume-preserving hydrostatic plane inside a rectangular tank. This module
// describes equilibrium geometry only: it does not simulate slosh or fluid flow.
export const DEFAULT_WATER_BOUNDS=Object.freeze({
  min:Object.freeze({x:20,y:32,z:-52}),max:Object.freeze({x:400,y:540,z:52})
});
export const DEFAULT_WATER_AREA=48/488;
const AXES=['x','y','z'];
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const clamp01=x=>Math.max(0,Math.min(1,x));
const copy=p=>({x:p.x,y:p.y,z:p.z});

// Integral of the CDF of two independent uniforms with widths a <= b.
// The piecewise form avoids subtracting nearly equal cubics near an axis.
function integratedTwoUniforms(t,a,b) {
  if(t<=0)return 0;
  if(t<a)return t*(t/a)*(t/b)/6;
  if(t<b)return (t*t-t*a+a*a/3)/(2*b);
  const tail=a+b-t;
  if(tail>0)return t-(a+b)/2+tail*(tail/a)*(tail/b)/6;
  return t-(a+b)/2;
}
// Projection of a uniform box is a sum of at most three uniforms. Reflect the
// upper half before evaluation, including near-axis and inverted directions.
function projectedFraction(t,widths) {
  const count=widths.length,span=widths.reduce((a,b)=>a+b,0);
  if(t<=0)return 0;
  if(t>=span)return 1;
  if(t>span/2)return 1-projectedFraction(span-t,widths);
  if(count===1)return t/widths[0];
  const [a,b,c]=widths;
  if(count===2) {
    if(t<a)return .5*(t/a)*(t/b);
    return (t-a/2)/b; // Reflection ensures t <= (a+b)/2 <= b.
  }
  return clamp01((integratedTwoUniforms(t,a,b)-integratedTwoUniforms(t-c,a,b))/c);
}
function parameters({gravity={x:0,y:-1,z:0},volume=48,area=DEFAULT_WATER_AREA,bounds=DEFAULT_WATER_BOUNDS}={}) {
  const length=Math.hypot(gravity.x,gravity.y,gravity.z);
  if(!Number.isFinite(length)||length===0)throw new RangeError('Gravity must be a finite nonzero vector');
  if(!Number.isFinite(volume)||!Number.isFinite(area)||area<=0)throw new RangeError('Volume must be finite and area positive');
  const normal={x:-gravity.x/length||0,y:-gravity.y/length||0,z:-gravity.z/length||0};
  const min=copy(bounds.min),max=copy(bounds.max),center={},widths=[];
  let span=0;
  for(const axis of AXES) {
    if(!Number.isFinite(min[axis])||!Number.isFinite(max[axis])||max[axis]<=min[axis])throw new RangeError('Bounds must have finite positive extents');
    center[axis]=(min[axis]+max[axis])/2;
    const width=Math.abs(normal[axis])*(max[axis]-min[axis]);
    if(width>0)widths.push(width);
    span+=width;
  }
  widths.sort((a,b)=>a-b);
  const capacity=area*(max.y-min.y);
  if(!Number.isFinite(capacity)||!Number.isFinite(span))throw new RangeError('Tank capacity and projected extent must be finite');
  const boundedVolume=Math.max(0,Math.min(capacity,volume));
  return {normal,min,max,center,widths,span,area,capacity,volume:boundedVolume,fraction:boundedVolume/capacity};
}
function keyOf(p) {return [...AXES.map(a=>p.normal[a]),p.volume,p.area,...AXES.map(a=>p.min[a]),...AXES.map(a=>p.max[a])];}
function solve(p) {
  const {normal,min,max,center,widths,span,area,capacity,volume,fraction}=p;
  const centeredMinimum=-span/2;
  let low=0,high=span;
  if(fraction===0)high=0;
  else if(fraction===1)low=span;
  else if(widths.length===1)low=high=span*fraction;
  else for(let i=0;i<52;i++) {
    const middle=(low+high)/2;
    if(projectedFraction(middle,widths)<fraction)low=middle;else high=middle;
  }
  const centeredOffset=centeredMinimum+(low+high)/2;
  const offset=dot(normal,center)+centeredOffset;
  const scale=Math.max(max.x-min.x,max.y-min.y,max.z-min.z),epsilon=scale*1e-11;
  const signedDepth=point=>centeredOffset-(normal.x*(point.x-center.x)+normal.y*(point.y-center.y)+normal.z*(point.z-center.z));
  const inBounds=(point,tolerance=epsilon)=>AXES.every(a=>point[a]>=min[a]-tolerance&&point[a]<=max[a]+tolerance);
  const contains=(point,tolerance=epsilon)=>fraction>0&&inBounds(point,tolerance)&&signedDepth(point)>=-tolerance;
  const volumeFractionAt=planeOffset=>projectedFraction(planeOffset-dot(normal,center)-centeredMinimum,widths);
  const interpolate=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
  const distinct=points=>{
    const result=[];
    for(const point of points)if(!result.some(other=>Math.hypot(point.x-other.x,point.y-other.y,point.z-other.z)<=epsilon))result.push(point);
    return result;
  };
  const clipPolygon=(points,{water=true}={})=>{
    if((water&&fraction===0)||(!water&&fraction===1))return [];
    if((water&&fraction===1)||(!water&&fraction===0))return points.map(copy);
    const result=[],sign=water?1:-1;
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length],da=sign*signedDepth(a),db=sign*signedDepth(b);
      const aInside=da>=0,bInside=db>=0;
      if(aInside)result.push(copy(a));
      if(aInside!==bInside)result.push(interpolate(a,b,da/(da-db)));
    }
    return distinct(result);
  };
  const faceRectangle=(axis,side)=>{
    if(!AXES.includes(axis)||!['min','max'].includes(side))throw new RangeError('Face uses axis x/y/z and side min/max');
    const [u,v]=AXES.filter(a=>a!==axis),fixed=(side==='min'?min:max)[axis];
    return [[min[u],min[v]],[max[u],min[v]],[max[u],max[v]],[min[u],max[v]]].map(([a,b])=>({[axis]:fixed,[u]:a,[v]:b}));
  };
  const facePolygon=(axis,side,options)=>clipPolygon(faceRectangle(axis,side),options);
  const frontRectangle=z=>{
    if(!Number.isFinite(z)||z<min.z||z>max.z)throw new RangeError('Front slice z must lie inside tank bounds');
    return [{x:min.x,y:min.y,z},{x:max.x,y:min.y,z},{x:max.x,y:max.y,z},{x:min.x,y:max.y,z}];
  };
  const planeIntersections=points=>{
    const result=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length],da=signedDepth(a),db=signedDepth(b);
      if(Math.abs(da)<=epsilon)result.push(copy(a));
      if((da<0&&db>0)||(da>0&&db<0))result.push(interpolate(a,b,da/(da-db)));
    }
    return distinct(result);
  };
  const frontFaceLine=(z=max.z)=>{
    if(fraction===0||fraction===1)return [];
    const points=planeIntersections(frontRectangle(z));
    return points.length===2?points:[]; // A coincident face has no unique line.
  };
  const surfacePolygon3D=()=>{
    if(fraction===0||fraction===1)return [];
    const points=distinct(AXES.flatMap(axis=>['min','max'].flatMap(side=>planeIntersections(faceRectangle(axis,side)))));
    if(points.length<3)return [];
    const middle={x:0,y:0,z:0};for(const point of points)for(const axis of AXES)middle[axis]+=point[axis]/points.length;
    const helper=Math.abs(normal.x)<.8?{x:1,y:0,z:0}:{x:0,y:1,z:0};
    const u={x:normal.y*helper.z-normal.z*helper.y,y:normal.z*helper.x-normal.x*helper.z,z:normal.x*helper.y-normal.y*helper.x};
    const length=Math.hypot(u.x,u.y,u.z);for(const axis of AXES)u[axis]/=length;
    const v={x:normal.y*u.z-normal.z*u.y,y:normal.z*u.x-normal.x*u.z,z:normal.x*u.y-normal.y*u.x};
    const angle=point=>{const d={x:point.x-middle.x,y:point.y-middle.y,z:point.z-middle.z};return Math.atan2(dot(d,v),dot(d,u));};
    return points.sort((a,b)=>angle(a)-angle(b));
  };
  return Object.freeze({normal:Object.freeze(normal),offset,centeredOffset,center:Object.freeze(center),
    bounds:Object.freeze({min:Object.freeze(min),max:Object.freeze(max)}),volume,area,capacity,fraction,
    signedDepth,contains,inBounds,volumeFractionAt,clipPolygon,facePolygon,frontFaceLine,surfacePolygon3D,
    frontFacePolygon:(z=max.z,options)=>clipPolygon(frontRectangle(z),options)});
}
/**
 * `area` converts game volume to upright height, not the box's geometric XZ area.
 * `normal` points out of the water (-gravity); water has n·point <= offset.
 * signedDepth(point) is positive under water and is evaluated about box center.
 * contains also checks the box. facePolygon/clipPolygon accept {water:false}
 * for the air side. surfacePolygon3D is ordered around the plane normal.
 * Capacity is area*(max.y-min.y); out-of-range volumes clamp to empty/full.
 * Reuse the returned surface until gravity, volume, area or bounds change.
 */
export function createWaterSurface(options) {return solve(parameters(options));}
/** Reuses the exact same immutable surface when normalized inputs are unchanged. */
export function createWaterSurfaceCache() {
  let lastKey,lastSurface;
  return {
    get(options) {
      const p=parameters(options),key=keyOf(p);
      if(!lastKey||key.some((value,i)=>value!==lastKey[i])) {lastKey=key;lastSurface=solve(p);}
      return lastSurface;
    },
    clear() {lastKey=lastSurface=undefined;}
  };
}
