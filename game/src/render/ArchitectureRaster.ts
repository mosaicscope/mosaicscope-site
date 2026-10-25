/** Match on-screen building pixels while bounding canvas memory. Quantization avoids zoom churn. */
export function architectureRaster(extent:number,scale:number,dpr:number,quality:number):number {
 const density=Math.max(1,Math.min(2,dpr)),wanted=Math.ceil(Math.max(1,scale)*density/4)*4;
 return Math.min(48,wanted,[1024,1280,1536,1792][Math.max(0,Math.min(3,quality))]/Math.max(1,extent));
}
