import {describe,it,expect} from 'vitest';
import {WINDOW_ACTIVITIES,windowActivity,activityPose} from '../src/render/WindowActivities';
import {storyOf} from '../src/render/NightGlow';

describe('living window animation library',()=>{
  it('contains 60 distinct authored motion tracks and reaches every one',()=>{
    expect(WINDOW_ACTIVITIES).toHaveLength(60);
    expect(new Set(WINDOW_ACTIVITIES.map(a=>a.name)).size).toBe(60);
    expect(new Set(WINDOW_ACTIVITIES.map(a=>JSON.stringify([a.poses,a.path,a.prop]))).size).toBe(60);
    const seen=new Set(Array.from({length:4000},(_,seed)=>windowActivity(seed).name));
    expect(seen.size).toBe(60);
    const occupants=new Set<string>();
    for(let seed=0;seed<12000;seed++)if(['figure','couple','walking','dancing','working'].includes(storyOf(seed)))occupants.add(windowActivity(seed).name);
    expect(occupants.size).toBe(60);
    for(const a of WINDOW_ACTIVITIES)expect(a.path).toHaveLength(a.poses.length);
  });
  it('animates every track with continuous, repeatable movement',()=>{
    const seeds=new Map<string,number>();for(let seed=0;seed<4000;seed++)seeds.set(windowActivity(seed).name,seed);
    for(const seed of seeds.values()){
      const frames=Array.from({length:30},(_,t)=>activityPose(seed,t*1.17));
      expect(new Set(frames.map(f=>JSON.stringify([f.u,f.pose]))).size).toBeGreaterThan(20);
      expect(activityPose(seed,19.73)).toEqual(activityPose(seed,19.73));
      let maxDelta=0,finite=true;
      for(let t=0;t<80;t+=.37){
        const a=activityPose(seed,t),b=activityPose(seed,t+.001);
        maxDelta=Math.max(maxDelta,Math.abs(a.u-b.u));
        a.pose.forEach((v,k)=>{finite=finite&&Number.isFinite(v);maxDelta=Math.max(maxDelta,Math.abs(v-b.pose[k]));});
      }
      expect(finite).toBe(true);expect(maxDelta).toBeLessThan(.01);
    }
  });
});
