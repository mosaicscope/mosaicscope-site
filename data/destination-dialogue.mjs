// Bounded authored dialogue: no player text or account data is sent to a translator.
export const PHRASES={
 hello:'Hello. Welcome to the neighbourhood.',
 directions:'The nearest places are marked on your map. Stay on the footpath at busy roads.',
 food:'The local kitchens are a good place to stop for something to eat.',
 park:'This is a good place for a quiet walk. Please keep the paths clear.',
 water:'Stay back from the water. Look for a marked crossing or a public landing.',
 shop:'Have a look around. Ask at the counter if you need help.',
 hospital:'If you need medical help, speak to the reception desk.',
 police:'If you need assistance, speak to an officer at the station.',
 goodbye:'Take care. Enjoy the rest of your visit.',
};
export const LANGUAGES={en:'English',ar:'العربية',hi:'हिन्दी',ta:'தமிழ்',te:'తెలుగు',bn:'বাংলা',ja:'日本語',id:'Bahasa Indonesia',fr:'Français',es:'Español',de:'Deutsch',pt:'Português',ko:'한국어',zh:'中文',it:'Italiano',tr:'Türkçe',ru:'Русский',ur:'اردو'};
export const languageFor=country=>({KW:'ar',AE:'ar',SA:'ar',QA:'ar',OM:'ar',BH:'ar',IN:'hi',PK:'ur',BD:'bn',JP:'ja',ID:'id',FR:'fr',ES:'es',MX:'es',AR:'es',DE:'de',AT:'de',BR:'pt',PT:'pt',KR:'ko',CN:'zh',TW:'zh',IT:'it',TR:'tr',RU:'ru'}[country]??'en');
