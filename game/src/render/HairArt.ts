import { hairVariant } from '../content/hair';

/** Vector hair anchored to the same head ellipse as the existing Mosaics. */
export function drawCatalogueHair(g: CanvasRenderingContext2D, id: string, x: number, y: number, rx: number, ry: number, color: string, ink: string): boolean {
  const h = hairVariant(id); if (!h) return false;
  const { family: f, length: l, volume: v, part: p, strands: n } = h;
  g.save(); g.translate(x, y); g.scale(rx, ry); g.lineCap = 'round'; g.lineJoin = 'round';
  g.fillStyle = color; g.strokeStyle = ink; g.lineWidth = .065;
  const oval = (x: number, y: number, a: number, b: number) => { g.beginPath(); g.ellipse(x,y,a,b,0,0,Math.PI*2);g.fill();g.stroke(); };
  const cap = (height: number, fringe: number, bias = p) => {
    g.beginPath(); g.moveTo(-.96,-.32); g.bezierCurveTo(-1.1,-height,bias-.4,-height-.24,0,-height-.17);
    g.bezierCurveTo(.7,-height-.28,1.08,-height+.2,.97,-.32);
    g.quadraticCurveTo(.5+bias,-.8+fringe,bias,-.52+fringe);g.quadraticCurveTo(-.5,-.7+fringe,-.96,-.32);g.closePath();g.fill();g.stroke();
  };
  const strand = (sx: number, sy: number, ex: number, ey: number, width: number, curl = 0) => {
    g.strokeStyle = ink;g.lineWidth = width+.07;g.beginPath();g.moveTo(sx,sy);g.bezierCurveTo(sx+curl,sy+.35,ex-curl,ey-.35,ex,ey);g.stroke();
    g.strokeStyle=color;g.lineWidth=width;g.stroke();
  };
  if (f <= 4) {
    const height = f===0?.86+v*.2:f===1?1+v*.3:f===2?1.12+v*.4:f===3?1.2+l*.65:1+l*.3;
    if (f===3) { g.beginPath();g.moveTo(-.88,-.35);g.lineTo(-.78-v*.2,-height);g.lineTo(.78+v*.2,-height-p*.2);g.lineTo(.88,-.35);g.closePath();g.fill();g.stroke(); }
    else cap(height, f===4?l*.17:-.12);
    g.strokeStyle='#c8bda980';g.lineWidth=.035;
    for(let i=0;i<n;i++){const a=-.8+i*1.6/(n-1);g.beginPath();g.moveTo(a,-.62);g.lineTo(a+p*.15,-height+.09+(i%2)*.09);g.stroke();}
  } else if (f <= 9) {
    if(f===8){oval(-.91,-.23,.1,.34);oval(.91,-.23,.1,.34);}
    cap(1+v+l*(f===5?.72:.26),f===6?.12:f===9?.03:-.1);
    g.strokeStyle='#dbc9aa70';g.lineWidth=.03;
    for(let i=0;i<n;i++){const q=i/(n-1);g.beginPath();g.moveTo(-.86+q*1.72,-.55+Math.sin(q*6+p)*.08);g.quadraticCurveTo(p,-1.1-l*.4,.85-q*.25,-1-v*.5);g.stroke();}
    if(f===9)for(let i=0;i<3;i++){g.strokeStyle=ink;g.lineWidth=.055;g.beginPath();g.ellipse(p,-.77-i*.15,.48+l*.2,.11,0,.1,Math.PI);g.stroke();}
  } else if (f <= 12) {
    const outer=f===11?1.15+l*.5:1+l*.18;
    const curls=f===10?n+8:f===11?n+5:n;
    if(f===11){
      // A continuous mass of coiled hair, with an irregular edge rather than a string of beads.
      g.beginPath();g.moveTo(-.98,-.18);g.bezierCurveTo(-outer-.3,-.5,-outer-.15,-1.5-v,0,-1.5-v*.65-l*.3);
      g.bezierCurveTo(outer+.15,-1.5-v,outer+.3,-.5,.98,-.18);g.quadraticCurveTo(.7,-.5,p,-.66);g.quadraticCurveTo(-.7,-.5,-.98,-.18);g.closePath();g.fill();g.stroke();
      g.strokeStyle='#cabca64d';g.lineWidth=.035;
      for(let i=0;i<n*2;i++){const col=(i%7)/6, row=Math.floor(i/7);g.beginPath();g.arc(-1+col*2,-.95-row*.15-Math.sin(i*2.3+h.variation)*.04,.055+l*.035,.3,Math.PI*1.7);g.stroke();}
    }else{
      for(let i=0;i<=curls;i++){const a=Math.PI*(.96+i/curls*1.08),jitter=Math.sin(i*2.37+h.variation)*.055;oval(Math.cos(a)*(outer+jitter),Math.sin(a)*(1+v*.6)-.05,.14+v*.22+(f===12?.09:0)+jitter,.16+l*.12);}
      cap(.96+v*.35,-.12);
    }
    g.strokeStyle='#cabca650';g.lineWidth=.035;
    for(let i=0;i<n;i++){const a=Math.PI*(1.08+i/n*.84);g.beginPath();g.arc(Math.cos(a)*(.88+v*.4),Math.sin(a)*(.9+v*.4),.08+l*.025,0,Math.PI*1.7);g.stroke();}
  } else if (f <= 17) {
    cap(1.02+v*.2,-.05);
    for(let i=0;i<n;i++){
      const q=i/(n-1), sx=f===16?-.65+q*1.3+p*.4:-.86+q*1.72;
      if(f===14){strand(sx,-.48,p+(q-.5)*.8,-1.1-v*.45,.07);continue;}
      const side=i<n/2?-1:1, ex=side*(.97+v*.3)+(q-.5)*.22, ey=.12+l*(f===13?1.75:1.4)+(i%3)*.1;
      strand(sx,-.75,ex,ey,f===13?.13:f===17?.11:.075,(f===17?.17:.05)*side);
      g.strokeStyle=f===16?'#bca675':ink;g.lineWidth=.035;
      for(let j=1;j<6;j++){const t=j/6, xx=sx+(ex-sx)*t, yy=-.75+(ey+.75)*t;g.beginPath();g.moveTo(xx-.06,yy-.025);g.lineTo(xx+.06,yy+.025);g.stroke();}
    }
  } else {
    const drop=f===18?.4+l*.35:f===19||f===20?.5+l*1.65:.4;
    if(f===18||f===19||f===20){
      for(const side of [-1,1]){g.beginPath();g.moveTo(side*.7,-1);g.quadraticCurveTo(side*(1.25+v*.5),-.1,side*(1+v*.2),drop);g.lineTo(side*.78,drop+(f===18?0:.12));g.lineTo(side*.8,-.35);g.closePath();g.fill();g.stroke();}
    }
    if(f===21||f===22){for(const side of(f===21?[1]:[-1,1])){oval(side*.83,-.82,.22,.23);strand(side*.91,-.65,side*(1.15+v*.4),.25+l*1.8,.28+v*.1,side*.22);}}
    if(f===23||f===24)for(const side of(f===23?[0]:[-1,1]))oval(side*.7,-1.04-l*.22,.24+v*.4,.22+l*.32);
    cap(1.02+v*.24,.08+l*.1);
    g.strokeStyle='#d9c8a15c';g.lineWidth=.03;
    for(let i=0;i<n;i++){const q=i/(n-1);g.beginPath();g.moveTo(-.87+q*1.74,-.5);g.quadraticCurveTo(p,-1.1-v*.2,p+(q-.5)*.6,-1.08);g.stroke();}
    if(f===20)for(const side of[-1,1])for(let i=0;i<4;i++){g.beginPath();g.ellipse(side*(.98+v*.2),-.05+i*drop/4,.08+l*.07,.16,0,-Math.PI/2,Math.PI/2);g.stroke();}
  }
  g.restore(); return true;
}
