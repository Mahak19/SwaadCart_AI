import { env } from '../config/env.js';
import { dishImages } from '../data/dishImages.js';
import { chatJSON, aiEnabled } from './ai.service.js';

function withTimeout(ms){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return{signal:c.signal,done:()=>clearTimeout(t)};}
function yt(q){return 'https://www.youtube.com/results?search_query='+encodeURIComponent((q||'recipe')+' recipe');}

const MOODS=['regional','street','festival','quick','international'];
const STREET_RE=/chaat|samosa|pakora|bhaji|vada|bhel|pani puri|chaat|jalebi|kulfi|lassi|puri|chole|chana|pani|wada|momos/i;
const FESTIVAL_RE=/festival|diwali|holi|christmas|eid|puja|pongal|onam|navratri|ganpati|dussehra|celebration|wedding|mehndi/i;

async function fetchMealDBMulti(qs,state){
  const results=[];
  for(const q of qs){
    const {signal,done}=withTimeout(7000);
    try{
      const res=await fetch('https://www.themealdb.com/api/json/v1/1/search.php?s='+encodeURIComponent(q),{signal});
      if(res.ok){const json=await res.json();(json.meals||[]).forEach(m=>results.push(m));}
    }catch{ /* ignore individual query failures */ }
    finally{done();}
  }
  const seen=new Set();
  return results.slice(0,60).filter(m=>{const k=m.idMeal; if(seen.has(k)) return false; seen.add(k); return true;}).map(m=>{
    const ing=[];for(let i=1;i<=20;i++){const x=m['strIngredient'+i];if(x&&x.trim()) ing.push(x.trim());}
    const steps=(m.strInstructions||'').split(/\r?\n+/).map(s=>s.trim()).filter(s=>s.length>5).slice(0,6);
    const area=(m.strArea||'').toLowerCase();
    const name=m.strMeal||'';
    const text=name+' '+(m.strCategory||'')+' '+ing.join(' ');
    const isNonveg=/chicken|beef|pork|fish|prawn|lamb|shrimp|meat|egg/i.test(text);
    const isIndian=area.includes('indian');
    let mood='international';
    if(isIndian){
      if(FESTIVAL_RE.test(text)) mood='festival';
      else if(STREET_RE.test(text)) mood='street';
      else mood='regional';
    }
    const prepMinutes=20+Math.floor(Math.random()*35);
    const region=state||(isIndian?'India':(m.strArea||'World'));
    return {name,cuisine:m.strArea||'International',region,diet:isNonveg?'nonveg':'veg',mood,prepMinutes,description:steps[0]?steps[0].slice(0,150):'Popular recipe',ingredients:ing.slice(0,10),steps,thumbnail:m.strMealThumb||null,youtubeUrl:m.strYoutube||yt(name),source:'themealdb'};
  });
}

async function fetchAI(mood,state){
  let instruction;
  if(state){
    instruction='Give 14 unique '+state+' dishes from India, including home style and speciality dishes. JSON only.';
  }else if(mood&&mood!=='all'){
    instruction='Give 14 unique '+mood+' dishes from India, Pakistan and Bangladesh. Include lesser known and homestyle dishes. JSON only.';
  }else{
    instruction='Give 16 unique Indian dishes from ALL states: street, regional, festival and tribal specialities. JSON only.';
  }
  const parsed=await chatJSON([
    {role:'system',content:'Return ONLY JSON: {"dishes":[{"name":"","description":"","ingredients":[],"steps":[],"cuisine":"","region":"","diet":"veg|nonveg|eggetarian","prepMinutes":30,"mood":"'+MOODS.join('|')+'"}]}'},
    {role:'user',content:instruction+(mood&&mood!=='all'?' Every dish must use mood exactly "'+mood+'".':'')+(state?' Every dish must belong to '+state+'.':'')}
  ],{perModelTimeoutMs:25000,totalTimeoutMs:60000});
  if(!parsed) return [];
  return (parsed.dishes||[]).map(d=>({
    name:d.name,
    cuisine:d.cuisine||'Indian',
    region:d.region||state||'India',
    diet:d.diet||'veg',
    mood:MOODS.includes(d.mood)?d.mood:(mood&&mood!=='all'&&MOODS.includes(mood)?mood:'regional'),
    prepMinutes:d.prepMinutes||30,
    description:d.description||'Unique dish',
    ingredients:d.ingredients||[],
    steps:d.steps||[],
    thumbnail:dishImages[d.name]||null,
    youtubeUrl:yt(d.name),
    source:'ai'
  }));
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

function matchesMood(d,mood){
  if(!mood||mood==='all') return true;
  if(d.mood===mood) return true;
  const text=(d.name||'')+' '+(d.description||'');
  if(mood==='street') return STREET_RE.test(text);
  if(mood==='festival') return FESTIVAL_RE.test(text);
  if(mood==='quick') return (d.prepMinutes||0)<=25;
  if(mood==='regional') return /india|indian|pakistan|bangladesh/i.test((d.region||'')+' '+(d.cuisine||''));
  if(mood==='international') return !/india|indian|pakistan|bangladesh/i.test((d.region||'')+' '+(d.cuisine||''));
  return true;
}

function matchesState(d,state){
  if(!state||state==='All') return true;
  const hay=((d.region||'')+' '+(d.cuisine||'')+' '+(d.description||'')).toLowerCase();
  return hay.includes(state.toLowerCase());
}

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*((i+1)));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return arr;
}

export async function discoverUniqueDishes({q,mood,state,household}={}){
  const qs=state?[state+' recipe',state+' food','indian '+state]:mood&&mood!=='all'?[mood+' food india','india '+mood]:['indian','curry','rice','chicken','fish','vegetable','dessert','bread'];
  const [ai,meal,videos]=await Promise.all([fetchAI(mood,state),fetchMealDBMulti(qs,state),fetchYT(q||state||mood)]);
  let pool=[...ai,...meal];
  const vegOnly=household?.members?.every(m=>m.diet==='veg');
  if(vegOnly) pool=pool.filter(d=>d.diet!=='nonveg');
  const seen=new Set();
  pool=pool.filter(d=>{const k=(d.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(!k||seen.has(k))return false;seen.add(k);return true;});
  let matched=pool.filter(d=>matchesMood(d,mood)&&matchesState(d,state));
  const chosen=new Set(matched.map(d=>d.name));
  if(matched.length<12){
    for(const d of pool){
      if(chosen.has(d.name)) continue;
      chosen.add(d.name);
      matched.push(d);
      if(matched.length>=80) break;
    }
  }
  const primary=matched.filter(d=>matchesMood(d,mood)&&matchesState(d,state));
  const secondary=matched.filter(d=>!primary.includes(d));
  const dishes=shuffle(primary).concat(shuffle(secondary)).slice(0,80);
  return {aiEnabled:aiEnabled(),youtubeEnabled:Boolean(env.YOUTUBE_API_KEY),dishes,videos:videos.slice(0,16)};
}
