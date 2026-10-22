export function startOfWeek(d=new Date()){
  const date=new Date(d);
  const day=date.getDay();
  const diff=date.getDate()-day+(day===0?-6:1);
  date.setHours(0,0,0,0);
  date.setDate(diff);
  return date;
}

export function daysLeftInWeek(d=new Date()){
  const end=startOfWeek(d);
  end.setDate(end.getDate()+7);
  const now=new Date(d);
  now.setHours(0,0,0,0);
  return Math.max(0, Math.ceil((end-now)/(1000*60*60*24)));
}
