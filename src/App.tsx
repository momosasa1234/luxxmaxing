import {useEffect,useMemo,useState} from "react";
import {all,put,remove} from "./db";
import type {CaseItem,Plan,Rule,Session} from "./types";

type Page="studio"|"lab"|"history"|"rules";
const uid=()=>crypto.randomUUID();
async function toDataUrl(file:File):Promise<string>{
  if(!file.type.startsWith("image/")) throw new Error("יש לבחור קובץ תמונה.");
  const bmp=await createImageBitmap(file), scale=Math.min(1,1280/Math.max(bmp.width,bmp.height));
  const canvas=document.createElement("canvas"); canvas.width=Math.round(bmp.width*scale); canvas.height=Math.round(bmp.height*scale);
  canvas.getContext("2d")!.drawImage(bmp,0,0,canvas.width,canvas.height); return canvas.toDataURL("image/jpeg",.88);
}
async function api(path:string,body?:unknown){
  const r=await fetch(path,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:undefined);
  const d=await r.json(); if(!r.ok) throw new Error(d.error||"הבקשה נכשלה"); return d;
}
function ImageInput({label,value,onChange}:{label:string;value:string;onChange:(s:string)=>void}){
  return <label className="upload">{value?<img src={value} alt={label}/>:<><b>＋ {label}</b><small>לחץ לבחירת תמונה</small></>}
    <input type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];if(f)try{onChange(await toDataUrl(f))}catch(err){alert((err as Error).message)}}}/>
  </label>;
}
export default function App(){
  const [page,setPage]=useState<Page>("studio"),[source,setSource]=useState(""),[result,setResult]=useState(""),[plan,setPlan]=useState<Plan|null>(null);
  const [focus,setFocus]=useState("כל הרכיבים"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[configured,setConfigured]=useState<boolean|null>(null);
  const [sessions,setSessions]=useState<Session[]>([]),[cases,setCases]=useState<CaseItem[]>([]),[rules,setRules]=useState<Rule[]>([]);
  const [before,setBefore]=useState(""),[realAfter,setRealAfter]=useState(""),[caseName,setCaseName]=useState(""),[activeCase,setActiveCase]=useState<CaseItem|null>(null);
  const activeRules=useMemo(()=>rules.filter(r=>r.enabled).map(r=>r.instruction),[rules]);
  async function refresh(){setSessions((await all<Session>("sessions")).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));setCases(await all<CaseItem>("cases"));setRules(await all<Rule>("rules"));}
  useEffect(()=>{refresh();api("/api/health").then(d=>setConfigured(d.configured)).catch(()=>setConfigured(false));},[]);
  async function generate(image=source){
    if(!image)return;setBusy(true);setError("");
    try{const d=await api("/api/glowup/generate",{image,focus,calibrationRules:activeRules});setResult(d.image);setPlan(d.plan);
      const s:Session={id:uid(),createdAt:new Date().toISOString(),original:image,result:d.image,plan:d.plan};await put("sessions",s);await refresh();
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function saveCase(){if(!before||!realAfter)return;const c:CaseItem={id:uid(),name:caseName||"מקרה חדש",before,realAfter,notes:""};await put("cases",c);setBefore("");setRealAfter("");setCaseName("");await refresh();}
  async function runBlind(c:CaseItem){
    setBusy(true);setError("");
    try{const g=await api("/api/glowup/generate",{image:c.before,focus:"כל הרכיבים",calibrationRules:activeRules});
      const partial={...c,prediction:g.image,plan:g.plan};await put("cases",partial);
      const scores=await api("/api/benchmark/evaluate",{before:c.before,prediction:g.image,realAfter:c.realAfter});
      const done={...partial,scores};await put("cases",done);setActiveCase(done);await refresh();
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function calibrate(){
    const gold=cases.filter(c=>c.isGoldenExample||(c.userScore??0)>=75);if(!gold.length){setError("סמן מקרה כדוגמת זהב או תן ציון 75 ומעלה.");return}
    setBusy(true);try{const d=await api("/api/benchmark/calibrate",{examples:gold.map(c=>({critique:c.scores?.critique,userFeedback:c.userFeedback,plan:c.plan}))});
      for(const r of d.rules||[])await put("rules",{id:uid(),title:r.title,instruction:r.instruction,enabled:true,source:"דוגמאות זהב"});await refresh();
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function patchCase(c:CaseItem,patch:Partial<CaseItem>){const n={...c,...patch};await put("cases",n);setActiveCase(n);await refresh();}
  return <div className="shell" dir="rtl">
    <header><div className="brand" onClick={()=>setPage("studio")}>מראה טבעי <small>סטודיו הדמיה ומעבדת טיפוח</small></div>
      <nav>{([["studio","סטודיו"],["lab","מעבדת בדיקה"],["history","היסטוריה"],["rules","כללי כיול"]] as [Page,string][]).map(([id,t])=><button className={page===id?"active":""} onClick={()=>setPage(id)} key={id}>{t}</button>)}</nav>
    </header>
    {configured===false&&<p className="notice">שרת ה-AI אינו מוגדר. יש להוסיף GEMINI_API_KEY במשתני הסביבה של Render.</p>}
    {error&&<p className="notice">{error}<button onClick={()=>setError("")}>×</button></p>}
    {page==="studio"&&<><h1>שיפור טבעי. זהות נשמרת.</h1><p className="muted">העלה תמונת פורטרט לקבלת הדמיה ומדריך ביצוע אישי.</p>
      <section className="grid"><article className="panel"><h2>תמונת מקור</h2><ImageInput label="העלה תמונה" value={source} onChange={setSource}/>
        <label>מיקוד<select value={focus} onChange={e=>setFocus(e.target.value)}>{["כל הרכיבים","שיער","עור","גבות","זקן"].map(x=><option key={x}>{x}</option>)}</select></label>
        <button className="primary" disabled={!source||busy} onClick={()=>generate()}>{busy?"יוצר...":"נתח וצור הדמיה"}</button></article>
        <article className="panel"><h2>תוצאה</h2>{result?<img className="result" src={result} alt="תוצאה"/>:<div className="empty">התוצאה תופיע כאן</div>}</article></section>
      {plan&&<section className="panel"><h2>מדריך ביצוע</h2><p><b>פרופיל שיער:</b> {plan.hairProfile}</p><p><b>פרופיל עור:</b> {plan.skinProfile}</p><div className="guide">{[["מה לבקש מהספר",plan.barberInstructions],["שגרת טיפוח",plan.skincareRoutine],["גבות ושיער פנים",plan.browAndBeardPlan],["רשימת פעולות",plan.actionChecklist]].map(([t,a])=><div key={String(t)}><h3>{t}</h3><ul>{(a as string[]||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>)}</div></section>}</>}
    {page==="lab"&&<><h1>מעבדת בדיקה עיוורת</h1><p className="muted">התחזית נוצרת מתמונת הלפני בלבד; תמונת האמת נשלחת לשופט רק לאחר מכן.</p>
      <section className="panel"><div className="grid"><ImageInput label="תמונת לפני" value={before} onChange={setBefore}/><ImageInput label="אחרי אמיתי" value={realAfter} onChange={setRealAfter}/></div>
        <input placeholder="שם המקרה" value={caseName} onChange={e=>setCaseName(e.target.value)}/><button className="primary" disabled={!before||!realAfter} onClick={saveCase}>שמור מקרה</button></section>
      <section className="panel"><h2>מקרים שמורים ({cases.length})</h2><button onClick={calibrate} disabled={busy}>הפק כללי כיול מדוגמאות זהב</button>
        {cases.map(c=><div className="case" key={c.id}><img src={c.before} alt="לפני"/><b>{c.name}</b><button onClick={()=>runBlind(c)} disabled={busy}>הרץ בדיקה</button><button onClick={()=>setActiveCase(c)}>פרטים</button><button onClick={async()=>{await remove("cases",c.id);await refresh()}}>מחק</button></div>)}</section>
      {activeCase&&<section className="panel"><h2>{activeCase.name}</h2><div className="grid">{[activeCase.before,activeCase.prediction,activeCase.realAfter].map((x,i)=>x?<img className="result" src={x} key={i} alt={["לפני","תחזית","אחרי"][i]}/>:<div key={i}>טרם נוצרה תחזית</div>)}</div>
        {activeCase.scores&&<p>{activeCase.scores.critique} · דמיון: {activeCase.scores.overallSimilarityScore}/100</p>}
        <label>ציון משתמש: {activeCase.userScore??50}<input type="range" min="1" max="100" value={activeCase.userScore??50} onChange={e=>patchCase(activeCase,{userScore:+e.target.value})}/></label>
        <label><input type="checkbox" checked={!!activeCase.isGoldenExample} onChange={e=>patchCase(activeCase,{isGoldenExample:e.target.checked})}/> דוגמת זהב</label>
        <textarea placeholder="הערות" value={activeCase.userFeedback||""} onChange={e=>patchCase(activeCase,{userFeedback:e.target.value})}/></section>}</>}
    {page==="history"&&<><h1>היסטוריה ומאגר מקומי</h1><section className="panel">{sessions.map(s=><div className="case" key={s.id}><img src={s.result} alt="הדמיה"/><span>{new Date(s.createdAt).toLocaleString("he-IL")}</span><button onClick={()=>{setSource(s.original);setResult(s.result);setPlan(s.plan);setPage("studio")}}>פתח</button><button onClick={async()=>{await remove("sessions",s.id);await refresh()}}>מחק</button></div>)}</section></>}
    {page==="rules"&&<><h1>כללי כיול</h1><section className="panel"><h2>כללי בסיס</h2><ul><li>אין לשנות תווי פנים או מבנה עצמות.</li><li>אין לשנות גוון עור או צבע עיניים.</li><li>שיפור טיפוח בלבד תוך שמירה על זהות המקור.</li></ul><h2>כללים נלמדים</h2>{rules.map(r=><div className="case" key={r.id}><label><input type="checkbox" checked={r.enabled} onChange={async e=>{await put("rules",{...r,enabled:e.target.checked});await refresh()}}/>{r.title} — {r.instruction}</label><button onClick={async()=>{await remove("rules",r.id);await refresh()}}>מחק</button></div>)}</section></>}
    <footer>עיבוד AI דרך השרת · היסטוריה ומאגר נשמרים ב-IndexedDB בדפדפן</footer>
  </div>;
}
