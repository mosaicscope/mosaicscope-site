import {describe,it,expect} from 'vitest';
import {regionProfile} from '../src/content/regions';
import {regionalArchitecture} from '../src/content/mappedBuildingStyle';
describe('worldwide regional fallbacks',()=>{
 it('chooses country-specific profiles for Spain and Brazil',()=>{expect(regionProfile('ES').country).toBe('ES');expect(regionProfile('ES').first).toContain('Lucía');expect(regionProfile('BR').first).toContain('Camila');expect(regionProfile('ES').side).toBe('right');});
 it('uses regional architecture only when map tags do not supply values',()=>{const a=regionalArchitecture({country:'ES'}),b=regionalArchitecture({country:'BR'});expect(a.wall).not.toBe(b.wall);expect(regionalArchitecture({country:'ES','building:colour':'#123456'}).wall).toBe('#123456');});
});
