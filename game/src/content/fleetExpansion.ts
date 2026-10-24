import type { FleetModel } from './fleet';
import type { BaseVehicleClass } from './vehicles';
import type { BodyShape } from './vehicleBodies';
import type { UtilityKind } from '../sim/VehicleUtility';

/** Fictional production models, authored in world units (one tile is approximately two metres).
 * Each row is a model, not a paint variant: id, badge, length, width, height, speed, kerb mass,
 * price, roof crown, fittings, and optional working role/payload capacity in tonnes. */
type ModelRow=readonly [string,string,number,number,number,number,number,number,number,string,UtilityKind?,number?];
interface Segment {family:string;base:BaseVehicleClass;lamp:FleetModel['lamp'];wb:number;traffic:number;shape:BodyShape;rows:readonly ModelRow[]}
const SEGMENTS=[
 {family:'city micro',base:'retro_micro',lamp:'round',wb:.32,traffic:.18,shape:{cf:.32,cr:.18,hood:.37,deck:.55,cab:[-.42,.25],roof:[-.31,.08],cw:.94,rw:.74,wheel:.25},rows:[
 ['pika','Korora Pika',1.48,.77,.69,7.8,.72,7200,1.02,'plain'],['midge','Korora Midge',1.55,.79,.71,8.1,.78,8900,.98,'chrome'],
 ['pipi','Rimu Pipi',1.46,.76,.67,7.6,.69,6800,1.04,'plain'],['seed','Avon Seed',1.61,.81,.74,8.4,.86,11000,1.01,'eco'],
 ['pebble','Kauri Pebble',1.58,.80,.70,8.3,.82,9900,.96,'stripe'],['sprout','Rimu Sprout',1.67,.82,.75,8.6,.91,12500,1.06,'rack'],
 ['dot','Korora Dot',1.43,.75,.66,7.4,.65,5900,1.03,'plain'],['tahi','Aoraki Tahi',1.63,.83,.72,8.8,.89,13700,.97,'chrome'],
 ['button','Avon Button',1.51,.78,.68,8.0,.75,8100,1.05,'stripe'],['ruru','Kauri Ruru',1.69,.84,.73,8.7,.93,14200,.99,'eco']]},
 {family:'rounded compact hatch',base:'hatch',lamp:'slit',wb:.325,traffic:.24,shape:{cf:.27,cr:.065,hood:.40,deck:.60,cab:[-.45,.19],roof:[-.36,.015],cw:.91,rw:.78,wheel:.27},rows:[
 ['fern','Kauri Fern',1.87,.86,.72,9.2,1.02,14500,.98,'plain'],['bellbird','Rimu Bellbird',1.94,.88,.73,9.6,1.08,16200,1.02,'chrome'],
 ['swiftlet','Korora Swiftlet',1.81,.85,.70,9.5,.98,13800,.97,'stripe'],['quail','Avon Quail',2.01,.89,.74,9.8,1.13,18700,1.01,'plain'],
 ['kiko','Aoraki Kiko',1.89,.87,.71,9.7,1.04,15400,1.03,'eco'],['willow','Rimu Willow',2.04,.90,.76,9.5,1.16,19100,1.05,'rack'],
 ['hebe','Kauri Hebe',1.84,.86,.69,9.9,1.00,16800,.95,'stripe'],['cicada','Korora Cicada',1.98,.89,.72,10.0,1.10,20300,.99,'chrome'],
 ['rill','Avon Rill',1.92,.88,.75,9.3,1.09,15900,1.04,'plain'],['sedge','Aoraki Sedge',2.07,.91,.73,10.1,1.19,22000,.96,'eco']]},
 {family:'wide sport hatch',base:'hothatch',lamp:'quad',wb:.315,traffic:.11,shape:{cf:.23,cr:.11,hood:.38,deck:.57,cab:[-.43,.17],roof:[-.34,-.045],cw:.91,rw:.74,wheel:.30},rows:[
 ['tussockgt','Kauri Tussock GT',1.96,.91,.66,11.7,1.14,31000,.96,'wing'],['kea','Aoraki Kea',1.90,.90,.65,12.1,1.08,33500,.98,'stripe'],
 ['fuse','Korora Fuse',2.02,.93,.67,12.4,1.20,38000,.95,'wing'],['ember','Rimu Ember',1.93,.92,.64,12.0,1.12,35200,.97,'stripe'],
 ['brisk','Avon Brisk',2.06,.94,.68,11.9,1.24,36900,1.00,'chrome'],['volley','Kauri Volley',1.88,.89,.63,11.8,1.05,29700,1.02,'wing'],
 ['tangent','Aoraki Tangent',2.10,.95,.66,12.8,1.28,42500,.94,'stripe'],['pepper','Rimu Pepper',1.99,.92,.65,12.3,1.17,38700,.99,'wing'],
 ['apexh','Korora Apex-H',2.04,.94,.64,13.1,1.21,46500,.93,'wing'],['relay','Avon Relay',2.12,.95,.69,12.0,1.30,39900,1.01,'stripe']]},
 {family:'compact notch saloon',base:'compact_sedan',lamp:'square',wb:.32,traffic:.22,shape:{cf:.14,cr:.09,hood:.47,deck:.50,cab:[-.30,.18],roof:[-.21,.045],cw:.91,rw:.80,wheel:.27,pill:2},rows:[
 ['totara','Kauri Totara',2.12,.90,.70,10.1,1.18,18500,.99,'plain'],['karaka','Rimu Karaka',2.20,.91,.71,10.4,1.24,20900,1.03,'chrome'],
 ['lyall','Avon Lyall',2.08,.89,.68,10.2,1.13,17900,.97,'plain'],['sumner','Aoraki Sumner',2.26,.93,.72,10.6,1.31,23600,1.01,'stripe'],
 ['waimak','Kauri Waimak',2.17,.92,.69,10.8,1.22,22400,.96,'chrome'],['cress','Korora Cress',2.03,.88,.67,10.0,1.08,16500,1.04,'plain'],
 ['selwyn','Rimu Selwyn',2.29,.94,.73,10.5,1.35,24800,1.02,'eco'],['bealey','Avon Bealey',2.23,.92,.70,11.0,1.28,26200,.98,'chrome'],
 ['terrace','Aoraki Terrace',2.15,.91,.68,10.7,1.20,21100,1.00,'stripe'],['otakaro','Kauri Otakaro',2.32,.95,.71,11.1,1.38,27900,.95,'eco']]},
 {family:'long executive saloon',base:'executive',lamp:'bar',wb:.335,traffic:.08,shape:{cf:.16,cr:.08,hood:.47,deck:.53,cab:[-.36,.23],roof:[-.28,.08],cw:.92,rw:.81,wheel:.26,pill:3},rows:[
 ['regent','Aoraki Regent',2.46,.97,.72,11.6,1.65,53000,1.00,'chrome'],['consul','Rimu Consul',2.52,.98,.73,11.9,1.73,61000,1.03,'chrome'],
 ['dean','Kauri Dean',2.40,.96,.70,11.7,1.57,48700,.96,'plain'],['monarch','Korora Monarch',2.63,1.01,.76,12.2,1.91,79500,1.05,'chrome'],
 ['rutherford','Avon Rutherford',2.57,.99,.74,12.0,1.82,68200,1.02,'stripe'],['warden','Aoraki Warden',2.49,.98,.71,12.5,1.70,64500,.97,'chrome'],
 ['council','Rimu Council',2.66,1.02,.77,11.8,1.98,81000,1.06,'plain'],['envoy','Kauri Envoy',2.43,.97,.69,12.3,1.62,59400,.95,'stripe'],
 ['summit','Korora Summit',2.59,1.00,.73,12.7,1.86,76000,.99,'chrome'],['paragon','Avon Paragon',2.70,1.03,.75,12.6,2.04,92500,1.01,'chrome']]},
 {family:'long roof estate',base:'wagon',lamp:'square',wb:.33,traffic:.16,shape:{cf:.15,cr:.03,hood:.44,deck:.64,cab:[-.47,.17],roof:[-.44,.045],cw:.94,rw:.86,wheel:.26,pill:3},rows:[
 ['beech','Kauri Beech',2.28,.93,.73,10.5,1.35,24000,1.01,'rack'],['redwood','Rimu Redwood',2.39,.95,.75,10.8,1.47,28600,1.04,'rack'],
 ['grove','Avon Grove',2.23,.92,.71,10.7,1.28,21900,.98,'plain'],['marsh','Korora Marsh',2.45,.97,.77,10.4,1.58,31900,1.06,'rack'],
 ['snowgum','Aoraki Snowgum',2.35,.96,.74,11.3,1.44,33700,1.00,'stripe'],['canopy','Kauri Canopy',2.49,.98,.78,10.9,1.63,36500,1.03,'rack'],
 ['driftwood','Rimu Driftwood',2.31,.94,.72,11.1,1.39,26800,.96,'chrome'],['copse','Avon Copse',2.41,.96,.76,11.0,1.51,30100,1.02,'plain'],
 ['woodland','Korora Woodland',2.54,.99,.79,11.4,1.71,39900,1.05,'rack'],['alpineestate','Aoraki Alpine Estate',2.47,.97,.74,12.0,1.60,44100,.97,'stripe']]},
 {family:'sweeping fastback',base:'fastback',lamp:'slit',wb:.325,traffic:.09,shape:{cf:.33,cr:.12,hood:.38,deck:.58,cab:[-.42,.20],roof:[-.28,-.045],cw:.89,rw:.70,wheel:.30},rows:[
 ['aero','Korora Aero',2.29,.95,.64,12.3,1.40,38900,.95,'chrome'],['current','Avon Current',2.36,.97,.65,12.7,1.48,43200,.98,'stripe'],
 ['zephyr','Rimu Zephyr',2.24,.94,.62,12.5,1.32,36500,.93,'plain'],['skimmer','Kauri Skimmer',2.43,.98,.67,13.0,1.57,49700,1.00,'wing'],
 ['norwest','Aoraki Norwest',2.39,.97,.63,13.4,1.52,53600,.96,'stripe'],['glider','Korora Glider',2.32,.96,.66,12.4,1.44,41200,1.02,'eco'],
 ['slipstream','Avon Slipstream',2.49,1.00,.65,13.8,1.65,64900,.94,'wing'],['chicane','Rimu Chicane',2.27,.95,.61,13.1,1.37,45600,.92,'stripe'],
 ['jetty','Kauri Jetty',2.46,.99,.68,12.9,1.61,51400,1.01,'chrome'],['foehn','Aoraki Foehn',2.53,1.01,.64,14.0,1.72,69700,.97,'wing']]},
 {family:'rear drive sports coupe',base:'coupe',lamp:'quad',wb:.30,traffic:.07,shape:{cf:.23,cr:.14,hood:.45,deck:.51,cab:[-.31,.09],roof:[-.22,-.06],cw:.87,rw:.71,wheel:.31,pill:2},rows:[
 ['kestrel','Aoraki Kestrel',2.11,.94,.60,12.8,1.21,39900,.97,'stripe'],['falconet','Korora Falconet',2.18,.96,.61,13.2,1.29,44900,1.00,'wing'],
 ['razor','Avon Razor',2.06,.93,.58,13.0,1.15,37200,.94,'plain'],['raptor','Kauri Raptor',2.25,.98,.63,13.8,1.38,54900,1.02,'wing'],
 ['comet','Rimu Comet',2.21,.97,.59,13.6,1.33,51800,.96,'chrome'],['pursuit','Aoraki Pursuit',2.31,.99,.62,14.2,1.46,61800,.99,'wing'],
 ['talon','Korora Talon',2.14,.95,.57,13.5,1.24,47200,.93,'stripe'],['meteor','Avon Meteor',2.36,1.00,.64,14.1,1.52,63900,1.03,'chrome'],
 ['harrier','Kauri Harrier',2.27,.98,.60,14.5,1.41,68200,.95,'wing'],['kite','Rimu Kite',2.04,.92,.56,12.9,1.10,35900,.98,'stripe']]},
 {family:'open lightweight roadster',base:'roadster',lamp:'round',wb:.30,traffic:.045,shape:{cf:.30,cr:.24,hood:.40,deck:.49,cab:[-.24,.13],roof:[-.18,.005],cw:.86,rw:.74,wheel:.31,open:true},rows:[
 ['sunray','Kauri Sunray',1.94,.89,.54,11.9,.98,31200,.77,'chrome'],['sundial','Rimu Sundial',2.02,.91,.55,12.3,1.06,36900,.79,'plain'],
 ['tide','Avon Tide',1.89,.88,.52,12.0,.93,29800,.75,'stripe'],['solstice','Aoraki Solstice',2.13,.94,.57,13.0,1.19,47600,.81,'chrome'],
 ['daybreak','Korora Daybreak',2.07,.92,.53,12.8,1.11,41800,.76,'stripe'],['breeze','Kauri Breeze',1.97,.90,.56,12.1,1.01,33700,.80,'plain'],
 ['aurora','Rimu Aurora',2.18,.95,.58,13.4,1.25,53900,.82,'chrome'],['cove','Avon Cove',2.04,.91,.54,12.6,1.08,38900,.78,'stripe'],
 ['equinox','Aoraki Equinox',2.22,.96,.56,13.7,1.29,58100,.74,'chrome'],['sirocco','Korora Sirocco',2.11,.93,.52,13.1,1.16,45900,.73,'wing']]},
 {family:'long bonnet grand tourer',base:'grandtourer',lamp:'bar',wb:.31,traffic:.035,shape:{cf:.30,cr:.19,hood:.44,deck:.54,cab:[-.34,.035],roof:[-.25,-.10],cw:.85,rw:.69,wheel:.31,pill:2},rows:[
 ['traverse','Aoraki Traverse',2.43,.99,.60,14.0,1.62,81000,.98,'chrome'],['odysseygt','Avon Odyssey GT',2.51,1.01,.62,14.5,1.74,94000,1.02,'stripe'],
 ['meridian','Rimu Meridian',2.36,.98,.58,14.2,1.55,76500,.95,'chrome'],['horizon','Kauri Horizon',2.58,1.03,.64,14.9,1.86,110000,1.04,'chrome'],
 ['longitude','Korora Longitude',2.47,1.00,.59,14.7,1.68,99700,.96,'stripe'],['pilgrim','Aoraki Pilgrim',2.62,1.04,.65,14.4,1.94,119000,1.05,'chrome'],
 ['voyagergt','Avon Voyager GT',2.54,1.02,.61,15.1,1.79,124000,1.00,'wing'],['latitude','Rimu Latitude',2.40,.99,.57,14.6,1.59,88300,.94,'stripe'],
 ['expeditiongt','Kauri Expedition GT',2.66,1.05,.63,15.3,2.01,138000,1.01,'chrome'],['wayfarer','Korora Wayfarer',2.49,1.01,.60,14.8,1.71,103000,.97,'stripe']]},
 {family:'mid engine blade',base:'super_wedge',lamp:'slit',wb:.29,traffic:.012,shape:{cf:.42,cr:.24,hood:.27,deck:.50,cab:[-.25,.27],roof:[-.10,.045],cw:.80,rw:.62,wheel:.35},rows:[
 ['obsidian','Aoraki Obsidian',2.29,1.02,.49,16.0,1.35,185000,.96,'wing'],['ignimbrite','Rimu Ignimbrite',2.37,1.04,.50,16.5,1.44,225000,.99,'wing'],
 ['basalt','Kauri Basalt',2.22,1.00,.47,15.7,1.28,159000,.93,'stripe'],['shard','Korora Shard',2.43,1.06,.52,17.0,1.53,279000,1.02,'wing'],
 ['lancet','Avon Lancet',2.33,1.03,.48,16.8,1.39,248000,.94,'wing'],['caldera','Aoraki Caldera',2.49,1.08,.53,17.4,1.61,345000,1.04,'stripe'],
 ['scoria','Rimu Scoria',2.26,1.01,.46,16.3,1.31,197000,.92,'wing'],['prism','Kauri Prism',2.40,1.05,.51,17.2,1.48,318000,1.00,'chrome'],
 ['vector','Korora Vector',2.53,1.09,.50,17.8,1.67,410000,.97,'wing'],['splinter','Avon Splinter',2.31,1.03,.47,16.9,1.37,264000,.95,'stripe']]},
 {family:'electric city liftback',base:'compact_ev',lamp:'bar',wb:.34,traffic:.12,shape:{cf:.32,cr:.07,hood:.32,deck:.60,cab:[-.45,.28],roof:[-.35,.065],cw:.94,rw:.78,wheel:.28},rows:[
 ['electron','Avon Electron',2.04,.92,.75,11.0,1.48,38900,1.02,'eco'],['ion','Kauri Ion',1.93,.90,.73,10.7,1.36,32900,.99,'eco'],
 ['flux','Korora Flux',2.13,.95,.76,11.5,1.60,44900,1.04,'plain'],['coulomb','Rimu Coulomb',2.20,.97,.78,11.9,1.73,51200,1.01,'chrome'],
 ['ampere','Aoraki Ampere',2.08,.94,.72,11.7,1.55,42700,.96,'stripe'],['dynamo','Avon Dynamo',2.25,.98,.79,12.0,1.81,56800,1.05,'eco'],
 ['pulse','Kauri Pulse',2.00,.91,.71,11.4,1.43,36900,.95,'stripe'],['lumen','Korora Lumen',2.17,.96,.77,12.2,1.67,53400,1.03,'chrome'],
 ['watt','Rimu Watt',1.88,.89,.70,10.8,1.29,29800,.98,'eco'],['auric','Aoraki Auric',2.29,.99,.75,12.6,1.88,62900,.97,'chrome']]},
 {family:'urban high roof crossover',base:'crossover',lamp:'slit',wb:.325,traffic:.20,shape:{cf:.24,cr:.065,hood:.48,deck:.65,cab:[-.45,.19],roof:[-.37,.045],cw:.95,rw:.82,wheel:.28,pill:2},rows:[
 ['estuary','Avon Estuary',2.19,.96,.83,10.1,1.43,26900,1.01,'rack'],['foothill','Kauri Foothill',2.27,.98,.85,10.4,1.54,31200,1.04,'plain'],
 ['pukeko','Korora Pukeko',2.13,.95,.81,10.2,1.37,24800,.98,'stripe'],['ridgeline','Aoraki Ridgeline',2.35,1.00,.87,10.8,1.68,38900,1.02,'rack'],
 ['pioneer','Rimu Pioneer',2.30,.99,.82,10.6,1.60,34600,.96,'chrome'],['outlook','Avon Outlook',2.42,1.02,.90,11.0,1.81,43700,1.06,'rack'],
 ['lowland','Kauri Lowland',2.22,.97,.80,10.5,1.48,29200,.97,'plain'],['wetland','Korora Wetland',2.39,1.01,.88,10.9,1.75,41400,1.03,'rack'],
 ['skylinec','Aoraki Skyline Cross',2.46,1.03,.86,11.4,1.89,48900,1.00,'chrome'],['boulder','Rimu Boulder',2.33,.99,.84,10.7,1.64,36500,.99,'spare']]},
 {family:'ladder frame trail wagon',base:'fourby',lamp:'round',wb:.305,traffic:.09,shape:{cf:.065,cr:.025,hood:.56,deck:.65,cab:[-.47,.12],roof:[-.44,.055],cw:.97,rw:.91,wheel:.30,boxy:true,pill:3},rows:[
 ['wilderness','Kauri Wilderness',2.31,1.00,.94,9.4,1.95,34700,1.02,'spare','expedition',.7],['highpass','Aoraki Highpass',2.43,1.03,.98,9.8,2.17,45900,1.06,'rack','expedition',.85],
 ['bushman','Rimu Bushman',2.20,.98,.91,9.1,1.79,28900,.99,'spare','expedition',.6],['scree','Korora Scree',2.36,1.01,.95,9.7,2.04,39500,1.03,'work','expedition',.75],
 ['traverse4','Avon Traverse Four',2.51,1.05,1.01,10.0,2.39,56900,1.05,'rack','expedition',1],['rakaia','Kauri Rakaia',2.46,1.04,.97,9.6,2.27,49600,1.00,'spare','expedition',.9],
 ['snowline','Aoraki Snowline',2.57,1.06,1.03,10.3,2.51,64700,1.07,'rack','expedition',1.1],['escarpment','Rimu Escarpment',2.28,.99,.93,9.5,1.89,32300,1.01,'spare','expedition',.65],
 ['tarn','Korora Tarn',2.40,1.02,.96,9.9,2.12,42800,.98,'work','expedition',.8],['backcountry','Avon Backcountry',2.62,1.08,1.04,10.2,2.65,71900,1.04,'rack','expedition',1.2]]},
 {family:'working pickup tray',base:'pickup_single',lamp:'square',wb:.33,traffic:.13,shape:{cf:.09,cr:.015,hood:.52,deck:.54,cab:[-.12,.23],roof:[-.08,.10],cw:.92,rw:.85,wheel:.28,tray:true,boxy:true},rows:[
 ['stockman','Kauri Stockman',2.45,1.00,.84,9.8,1.58,28900,1.01,'work','timber',1.1],['fencer','Rimu Fencer',2.53,1.02,.87,10.0,1.73,32700,1.04,'work','equipment',1.25],
 ['shepherd','Aoraki Shepherd',2.61,1.04,.89,10.4,1.91,39500,1.02,'rack','equipment',1.4],['drover','Korora Drover',2.39,.99,.82,9.5,1.49,24700,.98,'plain','timber',1],
 ['boundary','Avon Boundary',2.68,1.05,.91,10.2,2.02,43900,1.05,'work','freight',1.5],['lineman','Kauri Lineman',2.57,1.03,.86,10.1,1.81,35900,1.00,'rack','roadwork',1.3],
 ['rural','Rimu Rural',2.48,1.01,.85,9.7,1.65,30100,.99,'spare','timber',1.15],['fieldhand','Aoraki Fieldhand',2.72,1.06,.93,10.5,2.14,48200,1.06,'work','equipment',1.6],
 ['posthole','Korora Posthole',2.64,1.04,.88,10.0,1.96,41200,1.03,'work','roadwork',1.45],['harvest','Avon Harvest',2.77,1.08,.94,10.6,2.25,53900,1.07,'rack','freight',1.75]]},
 {family:'high cube trades van',base:'panelvan',lamp:'bar',wb:.35,traffic:.10,shape:{cf:.12,cr:.025,hood:.32,deck:.56,cab:[-.49,.36],roof:[-.47,.24],cw:.98,rw:.94,wheel:.22,boxy:true,pill:2},rows:[
 ['artisan','Avon Artisan',2.48,1.00,1.02,9.3,1.85,29500,1.02,'work','equipment',1.1],['sparky','Kauri Sparky',2.56,1.02,1.06,9.6,1.99,33400,1.05,'rack','equipment',1.25],
 ['plumber','Rimu Plumber',2.63,1.04,1.09,9.4,2.12,36800,1.03,'work','equipment',1.4],['glazier','Korora Glazier',2.72,1.06,1.12,9.7,2.31,41900,1.06,'rack','equipment',1.55],
 ['joiner','Aoraki Joiner',2.43,.99,1.00,9.1,1.78,27200,.99,'work','timber',1],['toolbox','Avon Toolbox',2.80,1.08,1.15,9.9,2.49,47800,1.07,'work','equipment',1.7],
 ['roofer','Kauri Roofer',2.68,1.05,1.08,9.8,2.22,39700,1.00,'rack','timber',1.5],['workmate','Rimu Workmate',2.52,1.01,1.04,9.5,1.92,31600,1.01,'plain','equipment',1.2],
 ['welder','Korora Welder',2.85,1.09,1.16,10.0,2.61,51900,1.04,'work','equipment',1.85],['scaffolder','Aoraki Scaffolder',2.76,1.07,1.13,9.6,2.40,45200,1.08,'rack','timber',1.65]]},
 {family:'parcel box delivery',base:'stepvan',lamp:'square',wb:.355,traffic:.07,shape:{cf:.06,cr:.015,hood:.26,deck:.54,cab:[-.49,.41],roof:[-.48,.31],cw:.99,rw:.96,wheel:.20,boxy:true,pill:2},rows:[
 ['parcelpost','Avon Parcel Post',2.65,1.04,1.15,8.7,2.28,33900,1.03,'plain','freight',1.8],['courier','Korora Courier',2.74,1.06,1.18,9.0,2.44,37800,1.05,'stripe','freight',2],
 ['freshbox','Kauri Freshbox',2.84,1.08,1.22,8.9,2.68,42900,1.02,'work','refrigerated',2.2],['breadrun','Rimu Breadrun',2.57,1.02,1.12,8.5,2.14,30700,1.00,'chrome','freight',1.6],
 ['milkround','Aoraki Milkround',2.91,1.10,1.25,9.2,2.86,47700,1.06,'plain','refrigerated',2.4],['dispatch','Avon Dispatch',2.79,1.07,1.19,9.1,2.54,39800,1.01,'stripe','freight',2.1],
 ['coldchain','Korora Coldchain',3.02,1.12,1.28,9.4,3.08,55200,1.07,'work','refrigerated',2.8],['lastmile','Kauri Lastmile',2.61,1.03,1.14,8.8,2.21,32400,.99,'eco','electriccargo',1.7],
 ['pantry','Rimu Pantry',2.88,1.09,1.24,9.0,2.77,45100,1.04,'plain','refrigerated',2.3],['linehaul','Aoraki Linehaul',3.10,1.14,1.31,9.6,3.29,61900,1.08,'stripe','freight',3.1]]},
 {family:'municipal service chassis',base:'tradie',lamp:'quad',wb:.335,traffic:.035,shape:{cf:.08,cr:.02,hood:.46,deck:.57,cab:[-.20,.29],roof:[-.16,.14],cw:.95,rw:.88,wheel:.26,boxy:true,tray:true},rows:[
 ['recovery','Kauri Recovery',2.95,1.09,1.04,9.4,2.85,57900,1.02,'work','tow',1.8],['roadcrew','Avon Roadcrew',2.80,1.06,1.02,9.0,2.47,46100,1.05,'work','roadwork',1.4],
 ['rapidmedic','Aoraki Rapid Medic',2.72,1.04,1.13,11.5,2.39,78500,1.03,'stripe','ambulance',.65],['rescuepump','Rimu Rescue Pump',3.22,1.17,1.28,10.1,5.10,145000,1.06,'work','fire',2.6],
 ['drainmaster','Korora Drainmaster',3.04,1.12,1.16,8.4,3.61,83900,1.00,'work','tanker',3],['recycler','Kauri Recycler',3.31,1.18,1.35,8.0,5.80,162000,1.08,'work','refuse',3.5],
 ['powerline','Avon Powerline',3.01,1.10,1.08,9.2,3.08,72900,1.04,'rack','roadwork',1.9],['rangerpatrol','Aoraki Ranger Patrol',2.63,1.03,.98,11.4,2.19,69800,.99,'spare','police',.5],
 ['salvage','Rimu Salvage',3.16,1.14,1.11,9.5,3.72,96700,1.01,'work','tow',2.3],['parkskeeper','Korora Parkskeeper',2.69,1.05,1.01,8.9,2.31,41700,1.07,'rack','equipment',1.2]]},
 {family:'glazed passenger shuttle',base:'bus',lamp:'bar',wb:.37,traffic:.025,shape:{cf:.085,cr:.03,hood:.39,deck:.54,cab:[-.49,.46],roof:[-.47,.38],cw:.98,rw:.95,wheel:.19,pill:6,boxy:true},rows:[
 ['cityhopper','Avon Cityhopper',3.22,1.12,1.25,9.1,3.65,68500,1.02,'plain','passenger',1.7],['airportlink','Kauri Airport Link',3.48,1.17,1.31,9.8,4.21,85900,1.05,'stripe','passenger',2.1],
 ['schoolrunner','Rimu Schoolrunner',3.37,1.15,1.29,8.8,3.94,74700,1.03,'plain','passenger',1.9],['harbourcoach','Korora Harbour Coach',3.71,1.22,1.39,10.1,5.02,112000,1.06,'chrome','passenger',2.6],
 ['tramper','Aoraki Tramper',3.15,1.10,1.23,9.3,3.49,63900,1.00,'rack','passenger',1.5],['metrolink','Avon Metro Link',3.84,1.24,1.42,9.6,5.53,128000,1.08,'stripe','passenger',2.9],
 ['tourliner','Kauri Tourliner',3.60,1.20,1.35,10.4,4.67,102000,1.04,'chrome','passenger',2.4],['villagebus','Rimu Village Bus',3.29,1.13,1.27,8.9,3.78,70900,1.01,'plain','passenger',1.8],
 ['coastliner','Korora Coastliner',3.94,1.26,1.45,10.2,5.94,149000,1.07,'stripe','passenger',3.2],['quietlink','Aoraki Quiet Link',3.54,1.19,1.33,10.0,5.15,139000,.99,'eco','electricbus',2.2]]},
 {family:'heavy rigid commercial',base:'flatdeck',lamp:'square',wb:.355,traffic:.018,shape:{cf:.065,cr:.01,hood:.31,deck:.50,cab:[.02,.43],roof:[.06,.30],cw:.98,rw:.94,wheel:.23,boxy:true,tray:true},rows:[
 ['timberline','Kauri Timberline',3.35,1.17,1.17,8.8,4.18,73900,1.03,'work','timber',3.5],['gravelman','Rimu Gravelman',3.48,1.20,1.24,8.5,4.83,84900,1.05,'work','aggregate',4.2],
 ['watercart','Avon Watercart',3.62,1.23,1.31,8.2,5.47,105000,1.02,'plain','tanker',5],['freightmaster','Korora Freightmaster',3.78,1.25,1.29,9.3,5.88,119000,1.07,'stripe','freight',5.8],
 ['earthmover','Aoraki Earthmover',3.55,1.22,1.27,8.4,5.12,96800,1.04,'work','aggregate',4.7],['logcarrier','Kauri Logcarrier',3.92,1.28,1.33,9.0,6.41,137000,1.08,'rack','timber',6.5],
 ['fuelrunner','Rimu Fuelrunner',3.70,1.24,1.35,8.7,5.69,124000,1.06,'chrome','tanker',5.4],['liftcarrier','Avon Liftcarrier',3.41,1.19,1.21,8.9,4.52,79900,1.01,'work','equipment',3.8],
 ['bulkline','Korora Bulkline',4.05,1.30,1.38,9.5,7.02,159000,1.09,'stripe','freight',7],['quarry','Aoraki Quarry',3.85,1.27,1.36,8.3,6.18,142000,1.00,'work','aggregate',6.1]]},
] as const satisfies readonly Segment[];

export type ExpandedFleetClass=typeof SEGMENTS[number]['rows'][number][0];
export const EXPANSION_BODY_FAMILIES=SEGMENTS.map(s=>s.family);
const PAINTS=['#e1dccb','#354f60','#647b61','#925f50','#c0a67b','#525462'];
const ROLE_BASE:Partial<Record<UtilityKind,BaseVehicleClass>>={ambulance:'ambulance',fire:'fire',police:'police',tow:'tow',refuse:'bin',electriccargo:'deliveryev'};
export const EXPANDED_FLEET=Object.fromEntries(SEGMENTS.flatMap((segment:Segment)=>segment.rows.map(row=>{
 const [id,name,length,width,height,speed,mass,price,crown,trim,role,capacity]=row;
 const utility=role?{kind:role,capacity:capacity??.8,defaultLoad:role==='passenger'?.45:role==='expedition'?.25:.5,loadHeight:role==='tanker'?.68:role==='aggregate'?.32:.48,diesel:!['electriccargo','electricbus'].includes(role),beacon:['tow','roadwork','refuse','fire','ambulance','police'].includes(role)}:undefined;
 const shape={...segment.shape,rh:crown,roof:[segment.shape.roof[0],segment.shape.roof[1]+(crown-1)*.12] as [number,number]};
 return [id,{name,base:role&&ROLE_BASE[role]||segment.base,length,width,height,speed,mass,price,wb:segment.wb,lamp:segment.lamp,trim,traffic:segment.traffic,colors:role==='fire'?['#a82e2b','#b94f38']:role==='ambulance'?['#e4dfc3','#d8d9c6']:role==='police'?['#d7ded6','#c5d3db']:PAINTS,body:{family:segment.family,shape},utility} satisfies FleetModel];
}))) as unknown as Record<ExpandedFleetClass,FleetModel>;
