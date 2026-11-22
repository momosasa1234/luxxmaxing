import express from "express";
import path from "node:path";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
const app=express(); app.use(cors()); app.use(express.json({limit:"20mb"}));
const port=Number(process.env.PORT||8787), key=process.env.GEMINI_API_KEY;
const ai=key?new GoogleGenAI({apiKey:key}):null;
// Gemini 3.8 Flash is the supported default for new API users.
const analysisModel=process.env.GEMINI_ANALYSIS_MODEL||"gemini-3.8-flash";
const imageModel=process.env.GEMINI_IMAGE_MODEL||"gemini-2.0-flash-preview-image-generation";
const judgeModel=process.env.GEMINI_JUDGE_MODEL||analysisModel;
function requireAI(_req:express.Request,res:express.Response,next:express.NextFunction){if(!ai)return res.status(503).json({error:"יש להגדיר GEMINI_API_KEY במשתני הסביבה של השרת."});next();}
function imagePart(dataUrl:string){const m=/^data:(image\/[\w.+-]+);base64,(.+)$/.exec(dataUrl||"");if(!m)throw new Error("קובץ התמונה אינו תקין.");return {inlineData:{mimeType:m[1],data:m[2]}};}
function textFrom(r:any){return r.text||r.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";}
function parseJson(s:string){const t=s.replace(/```json|```/g,"").trim(),a=t.indexOf("{"),b=t.lastIndexOf("}");return JSON.parse(a>=0&&b>a?t.slice(a,b+1):t);}
const identity=`שמור על זהות האדם שבתמונה. אין לשנות מבנה פנים, עצמות, אף, שפתיים, עיניים, צבע עיניים, גוון עור, גיל או מאפיין מזהה. מותר שיפור טיפוח עדין בלבד תוך שמירה על סוג, מרקם וצבע שיער קיימים. התוצאה צילום אמיתי של אותו אדם.`;
const calibration=(r:string[])=>r.length?"כללי כיול שאינם סותרים נעילת זהות:\n"+r.join("\n"):"";
app.get("/api/health",(_q,s)=>s.json({ok:true,configured:!!ai,models:{analysisModel,imageModel,judgeModel}}));
app.post("/api/glowup/generate",requireAI,async(req,res)=>{try{
 const {image,focus="כל הרכיבים",calibrationRules=[]}=req.body as {image:string;focus?:string;calibrationRules?:string[]};if(!image)return res.status(400).json({error:"יש להעלות תמונת פורטרט."});
 const src=imagePart(image);
 const a=await ai!.models.generateContent({model:analysisModel,contents:[{role:"user",parts:[src,{text:`נתח את התמונה לשיפור טיפוח טבעי. מיקוד: ${focus}. ${identity}\n${calibration(calibrationRules)}\nהחזר JSON בלבד במבנה: {"hairProfile":"...","skinProfile":"...","browProfile":"...","beardProfile":"...","lockedFeatures":["..."],"editPrompt":"...","barberInstructions":["..."],"skincareRoutine":["..."],"browAndBeardPlan":["..."],"actionChecklist":["..."]}. אל תנחש רכיבים שאינם נראים.` }]}]});
 const plan=parseJson(textFrom(a));
 const edited=await ai!.models.generateContent({model:imageModel,contents:[{role:"user",parts:[src,{text:`Edit this exact portrait and return one edited image. Preserve identity. ${identity}\n${plan.editPrompt}\n${calibration(calibrationRules)}`}]}],config:{responseModalities:["IMAGE","TEXT"]}});
 const out=edited.candidates?.[0]?.content?.parts?.find((p:any)=>p.inlineData?.data);if(!out)throw new Error("מודל התמונה לא החזיר תמונה. בדוק שהמודל תומך ביצירת תמונות.");
 res.json({plan,image:`data:${out.inlineData.mimeType||"image/png"};base64,${out.inlineData.data}`});
 }catch(e:any){console.error(e);res.status(500).json({error:e.message||"שגיאה ביצירת הדמיה."});}});
app.post("/api/benchmark/evaluate",requireAI,async(req,res)=>{try{
 const {before,prediction,realAfter}=req.body as {before:string;prediction:string;realAfter:string};if(!before||!prediction||!realAfter)return res.status(400).json({error:"נדרשות שלוש תמונות."});
 const r=await ai!.models.generateContent({model:judgeModel,contents:[{role:"user",parts:[{text:"השווה תחזית AI לתוצאה האמיתית לפי שמירת זהות, דיוק שיער וזקן, ריאליזם ודמיון. החזר JSON בלבד: {identityLockScore:0-100,hairBeardAccuracyScore:0-100,realismScore:0-100,overallSimilarityScore:0-100,critique:string}. סדר תמונות: לפני, תחזית, אחרי אמיתי."},imagePart(before),imagePart(prediction),imagePart(realAfter)]}]});
 res.json(parseJson(textFrom(r)));
 }catch(e:any){console.error(e);res.status(500).json({error:e.message||"שגיאה בשיפוט."});}});
app.post("/api/benchmark/calibrate",requireAI,async(req,res)=>{try{
 const {examples}=req.body as {examples:any[]};if(!examples?.length)return res.status(400).json({error:"אין דוגמאות לכיול."});
 const r=await ai!.models.generateContent({model:analysisModel,contents:`הפק עד 8 כללי הנחיה קצרים מדוגמאות אלה. שמור על נעילת זהות. החזר JSON בלבד: {"rules":[{"title":"...","instruction":"..."}]}. דוגמאות: ${JSON.stringify(examples).slice(0,14000)}`});
 res.json(parseJson(textFrom(r)));
 }catch(e:any){console.error(e);res.status(500).json({error:e.message||"שגיאה בכיול."});}});
const dist=path.resolve(process.cwd(),"dist");app.use(express.static(dist));
app.get("*",(req,res,next)=>{if(req.path.startsWith("/api/"))return next();res.sendFile(path.join(dist,"index.html"),e=>{if(e)next(e);});});
app.listen(port,()=>console.log("App listening on port "+port));
