export const TOMATOES = [
  {id:'serious', name:'Serious', mood:'Just hanging', cents:0, expression:'serious'},
  {id:'grumpy', name:'Grumpy', mood:'Don’t bother me today', cents:0, expression:'grumpy'},
  {id:'formal', name:'Formal', mood:'Let’s get this bread', cents:100, expression:'formal'},
  {id:'bday', name:'Birthday Boy', mood:'Time to celebrate!', cents:100, expression:'bday'},
];
export const TOMATO_SIZES = [
  {id:'regular', name:'Regular', scale:1, cents:1049, dimensions:null, weight:null},
  {id:'small', name:'Small', scale:.82, cents:399, dimensions:null, weight:null},
  {id:'mini', name:'Mini', scale:.68, cents:550, dimensions:null, weight:null},
];
export const COLORS = [
  {id:'poppy',name:'Tomato red',hex:'#db4b3f'},
  {id:'pink',name:'Petal pink',hex:'#f2b8c5'},
  {id:'cream',name:'Buttercream',hex:'#f4dfab'},
  {id:'green',name:'Basil green',hex:'#79915d'},
  {id:'blue',name:'Sky blue',hex:'#a1bed7'},
  {id:'lavender',name:'Lilac',hex:'#b9a6cf'}
];
export const TYPES = [
  {id:'round',name:'Round',label:'Round',cents:75,dimensions:null},
  {id:'star',name:'Star',label:'Stars',cents:125,dimensions:null},
  {id:'flower',name:'Flower',label:'Flowers',cents:125,dimensions:null},
  {id:'heart',name:'Heart',label:'Hearts',cents:125,dimensions:null},
  {id:'bow',name:'Bow',label:'Bows',cents:125,dimensions:null},
  {id:'butterfly',name:'Butterfly',label:'Butterflies',cents:150,dimensions:null},
  {id:'misc',name:'Miscellaneous',label:'Misc.',cents:100,dimensions:null}
];
export const beadName = (colorId,typeId) =>
  colorId==='cream' && typeId==='bow'
    ? 'White star bow'
    : `${COLORS.find(color=>color.id===colorId).name} ${TYPES.find(type=>type.id===typeId).name}`;
export const ARTWORK = {
  includedStar: './assets/beads/stars/silver-star.png',
  tomatoes: {
    ...Object.fromEntries(TOMATOES.map(({id})=>[id,''])),
    serious: './assets/test.png'
  },
  beads: {
    ...Object.fromEntries(COLORS.flatMap(({id:color})=>TYPES.map(({id:type})=>[color+'-'+type,'']))),
    'cream-bow': './assets/beads/stars/white-star-bow-small.png'
  },
  beadGallery: {'cream-bow':'./assets/beads/stars/white-star-bow-big.png'},
  beadFit: {'cream-bow':'contain'}
};
export const CLASPS = [
  {id:'ring',name:'Key ring',detail:'A classic circular ring',dimensions:null,cents:250,tomatoSize:'regular',maxBeads:5,includedStrands:1,includedBeadsPerStrand:3},
  {id:'lobster',name:'Lobster clasp',detail:'Clip onto bags and everyday things',dimensions:null,cents:250,tomatoSize:'regular',maxBeads:5,includedStrands:1,includedBeadsPerStrand:3},
  {id:'phone',name:'Loop',detail:'A cord loop for a compatible attachment',dimensions:null,cents:250,tomatoSize:'regular',maxBeads:5,includedStrands:1,includedBeadsPerStrand:3},
  {id:'dust-usbc',name:'Dust plug · USB-C',detail:'Seals a USB-C port · fit must be confirmed',dimensions:null,cents:150,tomatoSize:'small',maxBeads:3,includedStrands:1,includedBeadsPerStrand:3},
  {id:'dust-lightning',name:'Dust plug · Lightning',detail:'Seals a Lightning port · fit must be confirmed',dimensions:null,cents:150,tomatoSize:'small',maxBeads:3,includedStrands:1,includedBeadsPerStrand:3}
];
export const BASE = {cents:300,name:'Assembly'};
export const STRAND = {cents:150,name:'Strand'};
export const bead = (color,type='round')=>({color,type});
export const defaultDesign = ()=>({tomato:'serious',tomatoSize:'regular',clasp:'ring',strands:[
  [bead('pink'),bead('cream','flower'),bead('green')]
]});
export const PRODUCTS = [
  {id:'garden-party',name:'Garden Party',tag:'The original',description:'Sunny tomato, soft pinks & a little basil green.',background:'pink',cents:2200,design:defaultDesign()},
  {id:'sweet-thing',name:'Sweet Thing',tag:'A little extra love',description:'Soft lilacs, pretty pinks & a tiny star moment.',background:'lavender',cents:2400,design:{tomato:'formal',tomatoSize:'regular',clasp:'phone',strands:[[bead('lavender','round'),bead('pink','star'),bead('cream','round'),bead('lavender')],[bead('pink'),bead('cream','flower'),bead('lavender','round')]]}},
  {id:'cherry-on-top',name:'Cherry on Top',tag:'Pocket-sized joy',description:'Bright cherry reds & a little buttercream.',background:'yellow',cents:2600,design:{tomato:'bday',tomatoSize:'regular',clasp:'lobster',strands:[[bead('poppy'),bead('cream','flower'),bead('poppy'),bead('cream')],[bead('cream','star'),bead('poppy'),bead('cream')],[bead('poppy'),bead('pink'),bead('cream','star')]]}}
];
export const catalogEntries = ()=>[
  ['assembly',BASE], ['strand',STRAND],
  ...TOMATO_SIZES.filter(size=>CLASPS.some(clasp=>clasp.tomatoSize===size.id)).map(x=>['tomato-size-'+x.id,{name:x.name+' tomato base',cents:x.cents}]),
  ...TOMATOES.map(x=>['tomato-'+x.id,{...x,name:x.name+' personality extra'}]),
  ...CLASPS.map(x=>['clasp-'+x.id,x]),
  ...COLORS.flatMap(c=>TYPES.map(t=>['bead-'+c.id+'-'+t.id,{name:beadName(c.id,t.id),cents:t.cents}])),
  ...PRODUCTS.map(p=>['product-'+p.id,p])
];
