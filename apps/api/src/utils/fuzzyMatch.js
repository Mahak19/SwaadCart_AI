export function fuzzyMatch(a,b){
  if(!a||!b)return 0;
  a=a.toLowerCase(); b=b.toLowerCase();
  if(a===b)return 1;
  if(a.includes(b)||b.includes(a))return 0.8;
  return 0;
}
