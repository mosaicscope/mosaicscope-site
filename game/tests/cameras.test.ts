import {describe,expect,it} from 'vitest';
// @ts-ignore the Pages Function is plain JS shared with the deployed site
import {tflCameras,safeUrl,caltransCameras,digitrafficCameras,km} from '../../functions/api/cameras.js';
describe('camera directory',()=>{
 it('accepts only https images on the provider hosts',()=>{
  expect(safeUrl('http://www.trafficnz.info/camera/1.jpg',['trafficnz.info'])).toBe('https://www.trafficnz.info/camera/1.jpg');
  expect(safeUrl('https://evil.example/x.jpg',['trafficnz.info'])).toBeNull();
  expect(safeUrl('javascript:alert(1)',['trafficnz.info'])).toBeNull();
  expect(safeUrl('https://s3-eu-west-1.amazonaws.com/other-bucket/x.jpg',['s3-eu-west-1.amazonaws.com'])).toBeNull();
 });
 it('normalises TfL, Caltrans and Digitraffic and drops unavailable cameras',()=>{
  const tfl=tflCameras([{id:'a',commonName:'A <b>x</b>',lat:51.5,lon:-.1,additionalProperties:[{key:'imageUrl',value:'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/1.jpg'},{key:'available',value:'true'}]},{id:'b',lat:51,lon:0,additionalProperties:[{key:'imageUrl',value:'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/2.jpg'},{key:'available',value:'false'}]}]);
  expect(tfl.map((c:any)=>c.name)).toEqual(['A x']);
  const ct=caltransCameras({data:[{cctv:{inService:'true',index:'1',location:{district:'7',locationName:'I-5',latitude:'34.1',longitude:'-118.2'},imageData:{static:{currentImageURL:'https://cwwp2.dot.ca.gov/a.jpg'}}}},{cctv:{inService:'false',index:'2',location:{},imageData:{}}}]});
  expect(ct).toHaveLength(1);expect(ct[0].lat).toBe(34.1);
  const fi=digitrafficCameras({features:[{id:'C1',geometry:{coordinates:[24.9,60.1,0]},properties:{name:'kt51_Inkoo',presets:[{id:'C101',inCollection:true}]}}]});
  expect(fi[0].img).toBe('https://weathercam.digitraffic.fi/C101.jpg');expect(fi[0].name).toBe('Road 51 · Inkoo');
 });
 it('measures distance in km',()=>{expect(km(51.5,-.12,51.5,-.12)).toBe(0);expect(km(0,0,0,1)).toBeGreaterThan(110);expect(km(0,0,0,1)).toBeLessThan(112);});
});
