import {it,expect,vi} from 'vitest';
import {destinationTranslation} from '../src/ui/DestinationTranslation';
it('falls back to the public browser provider when shared server translation is unavailable, then caches it',async()=>{
 const request=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({translated:false},{status:503})).mockResolvedValueOnce(Response.json({responseStatus:200,responseData:{translatedText:'مرحبا بك'}}));
 try{const d=await destinationTranslation('hello','ar');expect(d.text).toBe('مرحبا بك');expect(d.language).toBe('ar');const url=new URL(String(request.mock.calls[1][0]));expect(url.origin).toBe('https://api.mymemory.translated.net');expect(url.searchParams.get('q')).toBe('Hello. Welcome to the neighbourhood.');expect(await destinationTranslation('hello','ar')).toEqual(d);expect(request).toHaveBeenCalledTimes(2);}finally{request.mockRestore();}
});
it('does not display provider quota errors as translated dialogue',async()=>{const request=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({translated:false},{status:503})).mockResolvedValueOnce(Response.json({responseStatus:200,quotaFinished:true,responseData:{translatedText:'Quota exceeded'}}));try{await expect(destinationTranslation('food','ja')).rejects.toThrow('Translation unavailable');}finally{request.mockRestore();}});
