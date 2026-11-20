import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS,loadSettings,saveSettings} from '../src/persistence/Settings';
import {MemoryStorageProvider} from '../src/persistence/storage';
describe('graphics settings',()=>{
 it('persists the ultra ultra GPU preference and restores low mode',()=>{const store=new MemoryStorageProvider(),settings={...DEFAULT_SETTINGS,quality:'ultra-ultra' as const};saveSettings(store,settings);expect(loadSettings(store).quality).toBe('ultra-ultra');saveSettings(store,{...settings,quality:'low'});expect(loadSettings(store).quality).toBe('low');});
});
