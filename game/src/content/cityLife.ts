export type LifePlace='cafe'|'shop'|'office'|'home'|'hospital'|'park'|'nightlife'|'hotel'|'manchester';
export interface LifeStop{place:LifePlace;action:string;pose:string}
export interface CityLifeEvent{id:string;title:string;story:string;from:number;to:number;weather?:'rain'|'dry';cost:number;reward:number;minutes:number;stops:LifeStop[]}
const stop=(place:LifePlace,action:string,pose='give'):LifeStop=>({place,action,pose});
const event=(id:string,title:string,story:string,place:LifePlace,action:string,cost=0,reward=15,from=7,to=20,minutes=10):CityLifeEvent=>({id,title,story,from,to,cost,reward,minutes,stops:[stop(place,action)]});
export const CITY_LIFE_EVENTS:CityLifeEvent[]=[
 event('coffee-run','The morning coffee run','A colleague sent three different coffee orders. Get the names right.','cafe','Collect the labelled coffees',12,28,6,12),
 event('groceries','Dinner still needs groceries','Pick up ingredients and bring them home before dinner.','shop','Pack the grocery bag',18,0,8,21),
 event('bakery-shift','Bakery cover shift','The morning assistant called in sick. Cover the counter and tidy up.','cafe','Serve the morning queue',0,42,6,13,30),
 event('office-parcel','Reception delivery','Someone is waiting on a signed parcel before the meeting starts.','office','Deliver the parcel and get a signature',0,24,8,18),
 event('medic-supper','Supper for the late shift','Hospital staff have been too busy to take a break.','hospital','Hand over the labelled food bag',8,25,17,24),
 event('flat-viewing','A flat viewing','Meet the fictional flatmates, check the light and ask about the washing machine.','home','Meet the flatmates',0,0,10,19),
 event('laundry','The laundry run','Clean clothes, matching socks, one missing coin. Ordinary life.','home','Sort and fold the washing',4,0,7,22),
 event('bin-day','It is bin day','Help a neighbour bring the bins back without blocking the footpath.','home','Return the bins',0,12,7,19),
 event('lost-keys','Keys at reception','A commuter left their keys with the front desk. Bring them back.','office','Collect the named key envelope',0,18,8,18),
 event('lunch-break','A proper lunch break','Get away from the screen, eat something and sit outside.','park','Take a quiet lunch break',6,0,11,15),
 event('neighbour-boxes','The new neighbour','A neighbour has moving boxes and an excellent supply of terrible jokes.','home','Help carry the light boxes',0,20,9,20),
 event('library-return','Return the borrowed book','The book has been on your table all week. Take it back today.','office','Leave the book at the returns desk',0,8,9,18),
 event('bike-commute','A bicycle before work','Check the tyres, straighten the light and help a commuter get going.','manchester','Help with the bike light',0,16,7,10),
 event('school-lunch','Community lunch packing','Pack sandwiches for a fictional community food programme.','cafe','Pack the labelled lunch bags',0,26,8,12,25),
 event('dog-walk','A neighbour needs a walk buddy','Take a relaxed park stroll and hear about the neighbour’s week.','park','Take the park loop',0,12,7,20),
 event('bus-missed','Missed the bus again','The timetable is fictional. The feeling is very familiar. Help someone plan their walk.','manchester','Check the route together',0,10,7,23),
 event('flower-stop','Flowers for a friend','A small bunch and a handwritten note can change someone’s afternoon.','shop','Choose flowers and write the note',10,0,9,20),
 event('work-interview','The job interview','Arrive prepared, ask a useful question and leave the reception desk tidy.','office','Attend the interview',0,35,9,17,30),
 event('stockroom','Stockroom half shift','Sort deliveries, face the shelves and finish the inventory.','shop','Finish the stock count',0,45,8,19,30),
 event('cafe-close','Closing the cafe','Stack chairs, wipe tables and help the team catch their bus.','cafe','Close down with the team',0,32,16,21,25),
 event('rain-coats','Rain caught everyone out','The live weather says rain. Bring spare umbrellas to a friend.','manchester','Share a spare umbrella',3,14,7,23),
 event('park-litter','Ten minutes for the park','Sort a few pieces of litter and leave the grass better than you found it.','park','Sort the recyclable litter',0,18,8,20),
 event('rent-chat','A flatmate budget chat','Split the groceries fairly and agree on a fictional household budget.','home','Talk through the weekly budget',0,0,17,23),
 event('repair-meet','A community repair table','A loose handle needs a screwdriver, not a new appliance.','office','Help at the repair table',0,22,10,18),
 event('family-call','Call someone you care about','A quiet corner and five minutes to ask how their day went.','park','Make the catch-up call',0,0,9,22),
 event('brunch','Weekend-style brunch','Meet a local, split a plate and argue gently about the best coffee.','cafe','Sit down for brunch',14,0,9,15),
 event('photo-walk','A golden-hour photo walk','Look for shadows, actual facades and a street worth remembering.','manchester','Frame the street photograph',0,12,16,21),
 event('hospital-visit','A small hospital visit','Drop off a book and a kind note at reception.','hospital','Leave the named visitor parcel',4,10,10,20),
 event('open-mic','Manchester open-mic signup','A fictional host needs someone to test the microphone before the crowd arrives.','nightlife','Try an original verse',0,24,19,4),
 event('door-shift','A calm door shift','Check the fictional guest list, direct the queue and help people find their friends.','nightlife','Finish the door shift',0,50,20,4,30),
 event('late-food','The late-night food run','Bring a hot takeaway to two friends working a late shift.','cafe','Collect the hot takeaway',9,24,18,3),
 event('taxi-friend','Get a friend home','Wait together at the pickup point. The ride is fictional, the company matters.','manchester','Wait at the agreed pickup point',0,15,20,5),
 event('night-market','The evening market','Help pack a stall, return the crates and make room on the pavement.','shop','Pack the produce stall',0,32,17,23),
 event('dance-floor','A night of dancing','Meet the fictional crowd, dance a little and leave time to get home.','nightlife','Join the dance floor',12,0,20,4),
 event('night-portraits','Night portrait session','A musician wants a portrait by the actual street frontage.','manchester','Take the agreed portrait',0,30,18,3),
 event('hotel-desk','Late check-in delivery','A fictional visitor has left a charger at the cafe. Reception is expecting it.','hotel','Leave the charger at reception',0,22,19,5),
];
CITY_LIFE_EVENTS.find(e=>e.id==='rain-coats')!.weather='rain';
for(const id of ['coffee-run','groceries','office-parcel','medic-supper','lost-keys','flower-stop','late-food']){const e=CITY_LIFE_EVENTS.find(e=>e.id===id)!;e.stops.push(stop(id==='medic-supper'?'hospital':id==='office-parcel'?'office':'home','Hand over the delivery'));}
export const CITY_RESIDENTS=[
 {name:'Mara Vale',age:29,role:'local',line:'I work evenings. Before that, it is shopping, laundry and finding my keys.',companion:true},
 {name:'Alex Mercer',age:32,role:'local',line:'Good company begins with a conversation. No pressure, either way.',companion:true},
 {name:'Kiri Bennett',age:30,role:'local',line:'I have a whole life outside my night shift. Ask about my terrible pottery.',companion:true},
 {name:'Samira Cole',age:35,role:'local',line:'Some nights I work; some nights I just want chips and a quiet chat.',companion:true},
 {name:'Nia Bishop',age:28,role:'driver',line:'Two parcels, one coffee, and then I can finally take a break.'},
 {name:'Tane Reed',age:41,role:'chef',line:'The last batch is in. Can you help me close the counter?'},
 {name:'Ava Heke',age:27,role:'barista',line:'Your coffee is ready. Tell me one good thing about your day.'},
 {name:'Jules Fraser',age:33,role:'busker',line:'Street lights, wet shoes; still got a verse and a little good news.'},
 {name:'Dev Shah',age:38,role:'office',line:'I missed the bus, but I finally sent that application.'},
 {name:'Moana Webb',age:45,role:'cleaner',line:'Keep this bit of footpath clear, please. Everyone needs a way through.'},
 {name:'Eli Hart',age:31,role:'bouncer',line:'Find your friend first. We can sort the guest list after that.'},
 {name:'Ruth Lane',age:52,role:'shopkeeper',line:'The stall is nearly packed. Give me a hand with the empty crates?'},
] as const;
export function isNight(hour:number){return hour>=19||hour<5;}
export function inHours(hour:number,from:number,to:number){return from<to?hour>=from&&hour<to:hour>=from||hour<to;}
