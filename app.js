const COLORS = ["#7dd3fc","#fbbf24","#c084fc","#34d399"];
const CITIES = ["Centennial","Littleton","Greenwood Village"];
const COORDS = {
  "shell-5901": [39.6095, -104.9596],
  "shell-2410": [39.5953, -104.9588],
  "murphy-12022": [39.5954, -104.8470],
  "exxon-6556": [39.5980, -104.9879],
  "711-5898": [39.6102, -104.9879],
  "ks-holly": [39.5714, -104.9223],
  "711-dayton": [39.5994, -104.8753],
  "murphy-briarwood": [39.5938, -104.8580]
};
const FALLBACK = { observations: [] };
const KEYS = { hist: "wazegas-hist", cities: "wazegas-cities", coach: "wazegas-coach", places: "wazegas-places", lastTap: "wazegas-last" };
let grade = "regular", hist = FALLBACK, here = null, lastTap = localStorage.getItem(KEYS.lastTap);
let onCities = JSON.parse(localStorage.getItem(KEYS.cities) || '["Centennial","Littleton","Greenwood Village"]');

function toast(t){ const el=document.getElementById("toast"); el.textContent=t; el.style.display="block"; setTimeout(()=>el.style.display="none",1800); }
function isKroger(s){ const n=(s.name||"").toLowerCase(); return n.indexOf("king soopers")!==-1 || n.indexOf("kroger")!==-1; }
function rawPrice(s){ const v=s[grade]; return (v==null||v==="")?null:+v; }
function priceOf(s){ const v=rawPrice(s); if(v==null) return null; return isKroger(s)?+(v-0.03).toFixed(2):v; }
function haversine(a,b){
  const R=3958.8, toR=d=>d*Math.PI/180;
  const dLat=toR(b[0]-a[0]), dLon=toR(b[1]-a[1]);
  const x=Math.sin(dLat/2)**2+Math.cos(toR(a[0]))*Math.cos(toR(b[0]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}
function miles(s){
  if(!here || !COORDS[s.id]) return null;
  return haversine(here, COORDS[s.id]);
}
function latest(){ return (hist.observations||[])[(hist.observations||[]).length-1]; }
function filtered(){
  const o=latest(); if(!o) return [];
  return (o.stations||[]).filter(s=>onCities.indexOf(s.city)!==-1);
}
function pricedList(){
  return filtered().filter(s=>priceOf(s)!=null).slice().sort((a,b)=>{
    const dp=priceOf(a)-priceOf(b); if(Math.abs(dp)>0.0001) return dp;
    const ma=miles(a), mb=miles(b);
    if(ma!=null && mb!=null) return ma-mb;
    return 0;
  });
}
function ageLabel(iso){
  if(!iso) return "crawl time unknown";
  const ms=Date.now()-new Date(iso).getTime();
  const h=Math.max(0, Math.round(ms/3600000));
  if(h<1) return "crawled just now";
  if(h<24) return "crawled "+h+"h ago";
  return "crawled "+Math.round(h/24)+"d ago";
}
function openWaze(s){
  lastTap=s.id; localStorage.setItem(KEYS.lastTap,s.id);
  const q=encodeURIComponent((s.addr||"")+" "+(s.city||"")+" CO");
  const native="waze://?q="+q+"&navigate=yes";
  const web="https://waze.com/ul?q="+q+"&utm_source=wazegas";
  setTimeout(()=>{ location.href=web; }, 700);
  location.href=native;
  render();
}
function renderCities(){
  const root=document.getElementById("cities"); root.innerHTML="";
  CITIES.forEach(c=>{
    const b=document.createElement("button"); b.className="chip"+(onCities.indexOf(c)!==-1?" on":""); b.type="button"; b.textContent=c;
    b.onclick=()=>{
      if(onCities.indexOf(c)!==-1){ if(onCities.length===1) return; onCities=onCities.filter(x=>x!==c); }
      else onCities=onCities.concat(c);
      localStorage.setItem(KEYS.cities, JSON.stringify(onCities)); render();
    };
    root.appendChild(b);
  });
}
function renderGlance(list){
  const root=document.getElementById("glance"); root.innerHTML="";
  const top=list.slice(0,3);
  const box=document.createElement("div"); box.className="g3";
  if(!top.length){ box.innerHTML="<div><em>No prices</em><b>—</b></div>"; root.appendChild(box); return; }
  top.forEach(s=>{
    const d=document.createElement("div");
    const mi=miles(s);
    d.innerHTML="<em></em><b></b>";
    d.querySelector("em").textContent=s.name;
    d.querySelector("b").textContent="$"+priceOf(s).toFixed(2)+(mi!=null?" · "+mi.toFixed(1)+"mi":"");
    d.onclick=()=>openWaze(s);
    box.appendChild(d);
  });
  root.appendChild(box);
}
function last10(){
  const out=[], end=new Date();
  for(let i=9;i>=0;i--){ const d=new Date(end.getFullYear(),end.getMonth(),end.getDate()-i); out.push(d.toISOString().slice(0,10)); }
  return out;
}
function drawChart(list){
  const ids=list.slice(0,3).map(s=>s.id);
  if(lastTap && ids.indexOf(lastTap)===-1) ids.push(lastTap);
  const obs=(hist.observations||[]).slice().sort((a,b)=>(a.crawled_at||a.date).localeCompare(b.crawled_at||b.date));
  const by={}; obs.forEach(o=>by[o.date]=o);
  const days=last10();
  const series=ids.map(id=> filtered().concat(obs.flatMap(o=>o.stations||[])).find(s=>s.id===id) || {id:id,name:id,city:""});
  const canvas=document.getElementById("chart"), ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h);
  const vals=[];
  days.forEach(d=>{ const o=by[d]; if(!o) return; (o.stations||[]).forEach(s=>{ if(ids.indexOf(s.id)===-1) return; const v=priceOf(s); if(v!=null) vals.push(v); }); });
  const min=(vals.length?Math.min.apply(null,vals):3.5)-0.08;
  const max=(vals.length?Math.max.apply(null,vals):5.2)+0.08;
  const padL=64,padR=16,padT=14,padB=34;
  const x=i=>padL+i*(w-padL-padR)/Math.max(days.length-1,1);
  const y=v=>padT+(1-(v-min)/(max-min))*(h-padT-padB);
  ctx.strokeStyle="#2a3650"; ctx.fillStyle="#9aa8bd"; ctx.font="20px -apple-system,sans-serif";
  for(let i=0;i<4;i++){ const v=min+(max-min)*i/3; ctx.beginPath(); ctx.moveTo(padL,y(v)); ctx.lineTo(w-padR,y(v)); ctx.stroke(); ctx.fillText("$"+v.toFixed(2),8,y(v)+6); }
  days.forEach((d,i)=>{ if(i%2===0||i===days.length-1) ctx.fillText(d.slice(5),x(i)-20,h-8); });
  series.forEach((s,idx)=>{
    const color=COLORS[idx%COLORS.length]; ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=2;
    let started=false; ctx.beginPath();
    days.forEach((d,i)=>{ const o=by[d]; const hit=o&&(o.stations||[]).find(r=>r.id===s.id); const v=hit?priceOf(hit):null; if(v==null){ started=false; return; } if(!started){ ctx.moveTo(x(i),y(v)); started=true; } else ctx.lineTo(x(i),y(v)); }); ctx.stroke();
    days.forEach((d,i)=>{ const o=by[d]; const hit=o&&(o.stations||[]).find(r=>r.id===s.id); const v=hit?priceOf(hit):null; if(v==null) return; ctx.beginPath(); ctx.arc(x(i),y(v),5,0,Math.PI*2); ctx.fill(); });
  });
  document.getElementById("legend").innerHTML=series.map((s,i)=>'<span><i class="sw" style="background:'+COLORS[i]+'"></i>'+s.name+"</span>").join("");
}
function renderPlaces(){
  const raw=JSON.parse(localStorage.getItem(KEYS.places)||"[]");
  const root=document.getElementById("placeList"); root.innerHTML="";
  raw.forEach((p)=>{
    const row=document.createElement("div"); row.className="station";
    row.innerHTML="<div><strong></strong><div class='addr'></div></div>";
    row.querySelector("strong").textContent=p.label; row.querySelector(".addr").textContent=p.query;
    row.onclick=()=>{ const q=encodeURIComponent(grade+" gas "+p.query); location.href="waze://?q="+q; setTimeout(()=>{location.href="https://waze.com/ul?q="+q;},700); };
    root.appendChild(row);
  });
}
function render(){
  renderCities();
  const list=pricedList();
  const o=latest();
  document.getElementById("stamp").textContent=ageLabel(o&&o.crawled_at)+" · next 7:15am MDT"+(o&&o.note?" · "+o.note:"");
  const missing=filtered().filter(s=>rawPrice(s)==null).length;
  document.getElementById("emptyNote").textContent=grade==="premium" && missing? missing+" station"+(missing===1?"":"s")+" have no premium report." : "";
  renderGlance(list);
  const root=document.getElementById("stations"); root.innerHTML="";
  const crawled=o&&o.crawled_at? (Date.now()-new Date(o.crawled_at).getTime())/3600000 : 0;
  list.forEach((s,i)=>{
    const el=document.createElement("div");
    el.className="station"+(i===0?" best":"")+(crawled>20?" stale":"");
    const copy=document.createElement("div");
    const name=document.createElement("strong"); name.textContent=s.name;
    const addr=document.createElement("div"); addr.className="addr";
    const mi=miles(s);
    addr.textContent=s.addr+" · "+s.city+(mi!=null?" · "+mi.toFixed(1)+" mi":"")+(s.source?" · "+s.source:"");
    copy.appendChild(name); copy.appendChild(addr);
    const right=document.createElement("div");
    const pr=document.createElement("div"); pr.className="price"; pr.textContent=s.conflict ? s.conflict : "$"+priceOf(s).toFixed(2);
    right.appendChild(pr);
    if(isKroger(s) && rawPrice(s)!=null){
      const b=document.createElement("span"); b.className="board"; b.textContent="$"+rawPrice(s).toFixed(2)+" − 3¢";
      right.appendChild(b);
    }
    el.appendChild(copy); el.appendChild(right);
    el.onclick=()=>openWaze(s);
    root.appendChild(el);
  });
  drawChart(list);
  renderPlaces();
}
document.getElementById("btnReg").onclick=()=>{ grade="regular"; document.getElementById("btnReg").classList.add("on"); document.getElementById("btnPrem").classList.remove("on"); render(); };
document.getElementById("btnPrem").onclick=()=>{ grade="premium"; document.getElementById("btnPrem").classList.add("on"); document.getElementById("btnReg").classList.remove("on"); render(); };
document.getElementById("editBtn").onclick=()=>document.getElementById("editBox").classList.toggle("on");
document.getElementById("addPlace").onclick=()=>{
  const label=document.getElementById("label").value.trim();
  const query=document.getElementById("query").value.trim();
  if(!label||!query) return;
  const raw=JSON.parse(localStorage.getItem(KEYS.places)||"[]");
  raw.push({label,query}); localStorage.setItem(KEYS.places, JSON.stringify(raw));
  document.getElementById("label").value=""; document.getElementById("query").value=""; renderPlaces();
};
document.getElementById("locBtn").onclick=()=>{
  if(!navigator.geolocation){ toast("Location not available"); return; }
  navigator.geolocation.getCurrentPosition(p=>{ here=[p.coords.latitude,p.coords.longitude]; toast("Sorted by price, then distance"); render(); }, ()=>toast("Location denied"));
};
document.getElementById("shareBtn").onclick=()=>{
  const list=pricedList(); if(!list.length) return;
  const s=list[0];
  const text=s.name+" "+s.addr+" · "+grade+" $"+priceOf(s).toFixed(2);
  if(navigator.share) navigator.share({text}).catch(()=>{});
  else if(navigator.clipboard) navigator.clipboard.writeText(text).then(()=>toast("Copied"));
  else toast(text);
};
document.getElementById("coachOk").onclick=()=>{ localStorage.setItem(KEYS.coach,"1"); document.getElementById("coach").classList.remove("on"); };
if(!localStorage.getItem(KEYS.coach) && !window.navigator.standalone) document.getElementById("coach").classList.add("on");

let startY=null;
document.getElementById("scroller").addEventListener("touchstart",e=>{ if(window.scrollY<=0) startY=e.touches[0].clientY; }, {passive:true});
document.getElementById("scroller").addEventListener("touchmove",e=>{
  if(startY==null) return;
  if(e.touches[0].clientY-startY>56) document.getElementById("pullMsg").classList.add("on");
}, {passive:true});
document.getElementById("scroller").addEventListener("touchend",()=>{
  if(document.getElementById("pullMsg").classList.contains("on")) load(true);
  startY=null; document.getElementById("pullMsg").classList.remove("on");
});

function apply(j){
  if(j && j.observations){ hist=j; localStorage.setItem(KEYS.hist, JSON.stringify(j)); }
  render();
}
function load(toastOn){
  fetch("gas-history.json?t="+Date.now()).then(r=>r.ok?r.json():null).then(j=>{
    if(j) apply(j); else {
      const cached=localStorage.getItem(KEYS.hist);
      apply(cached?JSON.parse(cached):FALLBACK);
    }
    if(toastOn) toast("Updated");
  }).catch(()=>{
    const cached=localStorage.getItem(KEYS.hist);
    apply(cached?JSON.parse(cached):FALLBACK);
    if(toastOn) toast("Showing last saved list");
  });
}
load(false);
