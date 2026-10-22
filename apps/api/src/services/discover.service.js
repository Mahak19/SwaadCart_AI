import { env } from '../config/env.js';
import { dishImages } from '../data/dishImages.js';
import { chatJSON, aiEnabled } from './ai.service.js';

function withTimeout(ms){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return{signal:c.signal,done:()=>clearTimeout(t)};}
function yt(q){return 'https://www.youtube.com/results?search_query='+encodeURIComponent((q||'recipe')+' recipe');}

async function fetchMealDBMulti(qs, limit=15){
  const results=[];
  for(const q of qs){
    const {signal,done}=withTimeout(7000);
    try{
      const res=await fetch('https://www.themealdb.com/api/json/v1/1/search.php?s='+encodeURIComponent(q),{signal});
      if(res.ok){const json=await res.json();(json.meals||[]).forEach(m=>results.push(m));}
    }catch(e){}
    finally{done();}
  }
  const seen=new Set();
  return results.slice(0,60).filter(m=>{const k=m.idMeal; if(seen.has(k)) return false; seen.add(k); return true;}).map(m=>{
    const ing=[];for(let i=1;i<=20;i++){const x=m['strIngredient'+i];if(x&&x.trim()) ing.push(x.trim());}
    const steps=(m.strInstructions||'').split(/\r?\n+/).map(s=>s.trim()).filter(s=>s.length>5).slice(0,6);
    const area=(m.strArea||'').toLowerCase();
    const name=m.strMeal||'';
    const isNonveg=/chicken|beef|pork|fish|prawn|lamb|shrimp|meat|egg/i.test(name+' '+ing.join(' '));
    let mood='international';
    if(area.includes('indian')) mood=Math.random()>0.5?'regional':'street';
    else if(['mexican','thai','vietnamese','chinese','japanese','korean','turkish'].some(x=>area.includes(x))) mood='international';
    return {name, cuisine:m.strArea||'International', region:area.includes('indian')?'India':m.strArea||'World', diet:isNonveg?'nonveg':'veg', mood, prepMinutes:25+Math.floor(Math.random()*30), description:steps[0]?steps[0].slice(0,150):'Popular recipe', ingredients:ing.slice(0,10), steps, thumbnail:m.strMealThumb||null, youtubeUrl:m.strYoutube||yt(name), source:'themealdb'};
  });
}

async function fetchAI(mood,state){
  const prompts=[
    state?('Give 10 unique '+state+' dishes India. JSON only.'):mood&&mood!=='all'?('Give 12 unique '+mood+' dishes from India, Pakistan, Bangladesh. Include lesser known. JSON only.'):('Give 15 unique Indian dishes from ALL states: street, regional, festival, tribal. JSON only.')
  ];
  const parsed=await chatJSON([{role:'system',content:'Return ONLY JSON: {"dishes":[{"name":"","description":"","ingredients":[],"steps":[],"cuisine":"","region":"","diet":"veg|nonveg|eggetarian","prepMinutes":30,"mood":"regional|street|festival|quick|international"}]}'},{role:'user',content:prompts[0]}],{perModelTimeoutMs:20000,totalTimeoutMs:60000});
  if(!parsed) return [];
  return (parsed.dishes||[]).map(d=>({name:d.name,cuisine:d.cuisine||'Indian',region:d.region||state||'India',diet:d.diet||'veg',mood:d.mood||mood||'regional',prepMinutes:d.prepMinutes||30,description:d.description||'Unique dish',ingredients:d.ingredients||[],steps:d.steps||[],thumbnail:dishImages[d.name]||null,youtubeUrl:yt(d.name),source:'ai'}));
}

async function fetchYT(q){
  const qs=[q||'Indian food recipe', 'street food India recipe', 'regional India recipe', 'desi food recipe'];
  if(!env.YOUTUBE_API_KEY){
    return qs.map(x=>({title:x,channel:'YouTube',videoId:'',thumbnail:null,url:yt(x),source:'youtube'}));
  }
  const {signal,done}=withTimeout(9000);
  try{
    const url='https://www.googleapis.com/youtube/v3/search?part=snippet&q='+encodeURIComponent(qs[Math.floor(Math.random()*qs.length)])+'&type=video&maxResults=12&order=date&key='+env.YOUTUBE_API_KEY;
    const res=await fetch(url,{signal});
    if(!res.ok) throw new Error('yt');
    const json=await res.json();
    return (json.items||[]).map(v=>({title:v.snippet.title,channel:v.snippet.channelTitle,videoId:v.id.videoId,thumbnail:v.snippet.thumbnails?.medium?.url||null,url:'https://www.youtube.com/watch?v='+v.id.videoId,source:'youtube'}));
  }catch{return [];}finally{done();}
}

export async function discoverUniqueDishes({q,mood,state,household}={}){
  const qs=state?[state+' recipe',state+' food','indian '+state]:mood&&mood!=='all'?[mood+' food india','india '+mood]:['indian','curry','rice','chicken','fish','vegetable','dessert','bread'];
  const [ai,meal,videos]=await Promise.all([fetchAI(mood,state),fetchMealDBMulti(qs,60),fetchYT(q||state||mood)]);
  let dishes=[...ai,...meal];
  const vegOnly=household?.members?.every(m=>m.diet==='veg')?'veg':null;
  if(vegOnly==='veg') dishes=dishes.filter(d=>d.diet!=='nonveg');
  if(mood&&mood!=='all') dishes=dishes.filter(d=>d.mood===mood);
  if(state&&state!=='All') dishes=dishes.filter(d=>(d.region||'').toLowerCase().includes(state.toLowerCase())||(d.cuisine||'').toLowerCase().includes(state.toLowerCase()));
  const seen=new Set();
  dishes=dishes.filter(d=>{const k=(d.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(!k||seen.has(k))return false;seen.add(k);return true;});
  for(let i=dishes.length-1;i>0;i--){const j=Math.floor(Math.random()*((i+1)));[dishes[i],dishes[j]]=[dishes[j],dishes[i]];}
  return {aiEnabled:aiEnabled(),youtubeEnabled:Boolean(env.YOUTUBE_API_KEY),dishes:dishes.slice(0,80),videos:videos.slice(0,16)};
}
