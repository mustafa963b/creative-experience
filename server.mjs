import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const kinds = new Set(['rose','tulip','carnation','lily','gerbera','hydrangea']);
const colors = {white:'natural ivory white',pink:'muted blush pink',red:'deep natural burgundy',apricot:'soft natural apricot'};
const wraps = {paper:'matte ivory florist paper',green:'muted forest green paper with ivory lining',fabric:'off-white woven linen',pink:'dusty rose paper with ivory tissue',clear:'translucent clear cellophane',mesh:'fine sage mesh with ivory tissue'};
const ribbons = {forest:'forest green silk satin',ivory:'ivory silk satin',velvet:'burgundy velvet',organza:'champagne sheer organza'};
const extras = new Set(['ribbon','card','chocolate']);
const sizes = new Set(['small','medium','large']);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2','.pdf':'application/pdf'};
export const phoneNumber = value => { const n=String(value||'').replace(/[\s()+-]/g,'').replace(/^00/,''); return /^[1-9]\d{7,14}$/.test(n)?n:''; };

export function validateDesign(input) {
  if (!input || !Array.isArray(input.stems) || !input.stems.length || input.stems.length>36 || !Object.hasOwn(wraps,input.wrap) || !Number.isFinite(input.spread) || input.spread<.75 || input.spread>1.25 || !Array.isArray(input.extras) || input.extras.length>3 || !input.extras.every(e=>extras.has(e))) throw new Error('INVALID_DESIGN');
  const counts={};
  const stems=input.stems.map(p=>{
    if (!kinds.has(p.kind) || !Object.hasOwn(colors,p.color) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x<0 || p.x>600 || p.y<0 || p.y>600) throw new Error('INVALID_DESIGN');
    counts[p.kind]=(counts[p.kind]||0)+1;if(counts[p.kind]>24)throw new Error('INVALID_DESIGN');
    return {kind:p.kind,color:p.color,x:Math.round(p.x),y:Math.round(p.y),angle:Number.isFinite(p.angle)?Math.max(-.5,Math.min(.5,p.angle)):0};
  });
  const ribbon=input.ribbon||{style:'forest',size:'large'};
  if(!Object.hasOwn(ribbons,ribbon.style)||!sizes.has(ribbon.size))throw new Error('INVALID_DESIGN');
  const pose={x:ribbon.x??300,y:ribbon.y??445,rotation:ribbon.rotation??0};
  if(!Number.isFinite(pose.x)||!Number.isFinite(pose.y)||!Number.isFinite(pose.rotation)||pose.x<0||pose.x>600||pose.y<0||pose.y>600||pose.rotation< -60||pose.rotation>60)throw new Error('INVALID_DESIGN');
  return {stems,spread:input.spread,wrap:input.wrap,extras:[...new Set(input.extras)],ribbon:{style:ribbon.style,size:ribbon.size,...pose}};
}

export function imagePrompt(design) {
  const grouped=new Map();for(const p of design.stems){const k=p.kind+'|'+p.color;grouped.set(k,(grouped.get(k)||0)+1);}
  const names={rose:'garden roses',tulip:'tulips',carnation:'carnations',lily:'lily blooms',gerbera:'gerbera daisies',hydrangea:'hydrangea flower clusters'};
  const list=[...grouped].map(([key,n])=>{const [kind,color]=key.split('|');return `${n} ${colors[color]} ${names[kind]}`;}).join('; ');
  return `Turn the supplied customer's 600x600 bouquet composition into one physically plausible, photorealistic premium florist product photograph. The source is an arrangement reference, not an existing real product. Preserve its composition, each selected flower type, color, count and relative placement as closely as physically possible. Selected inventory: ${list}. Wrapping: ${wraps[design.wrap]}. Relative bouquet spread: ${Math.round(design.spread*100)} percent. ${design.extras.includes('ribbon')?`Include ONE ${design.ribbon.size} realistic tied bow of ${ribbons[design.ribbon.style]}, with generous loops and draping tails. Preserve the reference bow placement at (${design.ribbon.x}, ${design.ribbon.y}) in the 600x600 design and its ${design.ribbon.rotation} degree clockwise rotation; keep the tie physically plausible around the wrapper.`:'NO decorative ribbon or bow.'} ${design.extras.includes('card')?'Include one blank ivory gift card, no writing.':'NO gift card.'} ${design.extras.includes('chocolate')?'Place one small closed neutral chocolate gift box alongside, no visible branding.':'NO extra gifts.'} Use botanically plausible relative flower-head sizes: individual rose/tulip/carnation blooms smaller than an open lily or hydrangea cluster, never giant identical heads. Give wrapping believable paper or textile thickness, folds, overlap and contact shadows. Natural nuanced petal colors, softly lit neutral studio background, full bouquet in frame with margins, realistic stems tied within the wrap. No extra flowers, no invented filler, no vase, no people, no labels or writing, no diagram circle, no interface controls or arrows. Do not print the customer's private message. This is an approximate visual preview, not a guarantee of exact physical fulfillment.`;
}

function pngInput(value) {
  if(typeof value!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value))throw new Error('INVALID_IMAGE');
  const b=Buffer.from(value.slice(22),'base64');
  if(b.length<32||b.length>2500000||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.readUInt32BE(16)!==600||b.readUInt32BE(20)!==600)throw new Error('INVALID_IMAGE');
  return value;
}

export function createApp({ env=process.env, fetchImpl=globalThis.fetch }={}) {
  async function currentSettings(){
    let settings=env;
    if(env===process.env){
      try{
        const text=await readFile(path.join(root,'.env'),'utf8'),local={};
        for(const line of text.split(/\r?\n/)){
          const match=line.match(/^\s*(OPENAI_API_KEY|OPENAI_IMAGE_MODEL|IMAGE_GENERATION_ENABLED|IMAGE_PROVIDER|FLUX_SERVICE_URL|FLUX_SERVICE_TOKEN|WHATSAPP_NUMBER)\s*=\s*(.*?)\s*$/);
          if(match){let value=match[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);local[match[1]]=value;}
        }
        settings={...env,...local};
      }catch(error){if(error.code!=='ENOENT')throw error;}
    }
    const provider=settings.IMAGE_PROVIDER||'openai';
    const key=settings.OPENAI_API_KEY||'';
    const fluxUrl=settings.FLUX_SERVICE_URL||'';
    const fluxToken=settings.FLUX_SERVICE_TOKEN||'';
    let validFluxUrl=false;
    try {
      const target=new URL(fluxUrl);
      validFluxUrl=target.pathname==='/v1/preview' && !target.username && !target.password &&
        (target.protocol==='https:' || (target.protocol==='http:' && ['127.0.0.1','localhost'].includes(target.hostname)));
    } catch {}
    const configured=provider==='flux_local' ? validFluxUrl && Boolean(fluxToken) : provider==='openai' && Boolean(key);
    return {provider,key,fluxUrl,fluxToken,enabled:configured&&settings.IMAGE_GENERATION_ENABLED!=='false',model:settings.OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst',number:phoneNumber(settings.WHATSAPP_NUMBER)};
  }
  const rateMax=Math.max(1,Math.min(20,Number(env.PREVIEWS_PER_HOUR)||4));
  const attempts=new Map();let active=0;
  const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  return http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      const {provider,key,fluxUrl,fluxToken,enabled,model,number}=url.pathname.startsWith('/api/')?await currentSettings():{};
      if(req.headers.origin && ![`http://${req.headers.host}`,`https://${req.headers.host}`,env.PUBLIC_ORIGIN].filter(Boolean).includes(req.headers.origin))return json(res,403,{error:'هذا الطلب غير مسموح من هذا الموقع.'});
      if(url.pathname==='/api/config'&&req.method==='GET')return json(res,200,{imageEnabled:enabled,whatsappNumber:number});
      if(url.pathname==='/api/preview'){
        if(req.method!=='POST')return json(res,405,{error:'طريقة الطلب غير مدعومة.'});
        if(!enabled)return json(res,503,{error:'خدمة الصورة الواقعية لم تُفعّل بعد. يمكنك متابعة تصميم باقتك وحفظها.'});
        if(req.headers['x-bouquet-request']!=='1'||!String(req.headers['content-type']).startsWith('application/json'))return json(res,415,{error:'صيغة الطلب غير مدعومة.'});
        const now=Date.now(),ip=req.socket.remoteAddress||'local';
        for(const [id,record] of attempts)if(now-record.time>3600000)attempts.delete(id);
        const record=attempts.get(ip)||{time:now,count:0};
        if(record.count>=rateMax||active>=2)return json(res,429,{error:'وصلنا للحد المتاح من المعاينات مؤقتًا. جرّب لاحقًا.'});
        let bytes=0,chunks=[];
        for await(const chunk of req){bytes+=chunk.length;if(bytes>4000000){json(res,413,{error:'حجم المعاينة كبير. جرّب تصميمًا أبسط.'});return;}chunks.push(chunk);}
        let design,image;try{const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));design=validateDesign(body.design);image=pngInput(body.image);}catch{return json(res,400,{error:'تفاصيل الباقة أو صورة المعاينة غير مكتملة. أعد المحاولة من التصميم.'});}
        record.count++;attempts.set(ip,record);active++;
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),180000);
        res.once('close',()=>{if(!res.writableEnded)controller.abort();});
        try {
          const isFlux=provider==='flux_local';
          const upstream=await fetchImpl(isFlux?fluxUrl:'https://api.openai.com/v1/images/edits',{
            method:'POST',
            headers:{Authorization:`Bearer ${isFlux?fluxToken:key}`,'Content-Type':'application/json'},
            signal:controller.signal,
            body:JSON.stringify(isFlux?{image,prompt:imagePrompt(design)}:{model,images:[{image_url:image}],prompt:imagePrompt(design),n:1,size:'1024x1024',quality:'medium',output_format:'png',background:'opaque'})
          });
          if(!upstream.ok){
            let code='';
            try {const failure=JSON.parse(await upstream.text());code=failure?.error?.code||'';} catch {}
            const exhausted=!isFlux && code==='credit_balance_exhausted';
            return json(res,upstream.status===429?429:502,{error:exhausted?'رصيد خدمة الصور غير كافٍ. تواصل مع المتجر أو حاول لاحقًا.':upstream.status===429?'خدمة الصور مشغولة الآن. جرّب لاحقًا.':'تعذّر توليد الصورة. راجع إعداد الخدمة أو حاول لاحقًا.'});
          }
          const output=await upstream.json(),b64=isFlux?output.image?.replace(/^data:image\/png;base64,/, ''):output.data?.[0]?.b64_json;
          if(typeof b64!=='string'||b64.length>20000000||!/^[A-Za-z0-9+/=]+$/.test(b64))return json(res,502,{error:'لم تُعد الخدمة صورة قابلة للعرض. حاول مجددًا.'});
          return json(res,200,{image:`data:image/png;base64,${b64}`,designHash:createHash('sha256').update(JSON.stringify(design)).digest('hex'),disclaimer:'صورة مولّدة تقريبية؛ يراجع المتجر التوفّر وإمكانية التنفيذ قبل تأكيد الطلب.'});
        }catch(error){if(!res.destroyed)return json(res,error.name==='AbortError'?504:502,{error:error.name==='AbortError'?'استغرق التوليد وقتًا أطول من المتوقع. حاول لاحقًا.':'تعذّر الاتصال بخدمة الصور. حاول لاحقًا.'});}
        finally{clearTimeout(timeout);active--;}
      }
      if(url.pathname.startsWith('/api/'))return json(res,404,{error:'الخدمة غير موجودة.'});
      if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'طريقة الطلب غير مدعومة.'});
      let relative;try{relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';}catch{return json(res,400,{error:'المسار غير صالح.'});}
      if(!(relative==='index.html'||relative==='La_Basil_Green_Care_Cards.pdf'||relative.startsWith('assets/'))||relative.split(/[\\/]/).some(s=>s==='..'||s.startsWith('.'))||!mime[path.extname(relative)])return json(res,404,{error:'الملف غير موجود.'});
      const target=path.resolve(root,relative);if(!target.startsWith(root+path.sep))return json(res,404,{error:'الملف غير موجود.'});
      const info=await stat(target);if(!info.isFile())return json(res,404,{error:'الملف غير موجود.'});
      res.writeHead(200,{'Content-Type':mime[path.extname(target)],'Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
      res.end(req.method==='HEAD'?undefined:await readFile(target));
    }catch(error){if(!res.headersSent)json(res,error.code==='ENOENT'?404:500,{error:error.code==='ENOENT'?'الملف غير موجود.':'تعذّر إكمال العملية. حاول مجددًا.'});else res.end();}
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.loadEnvFile(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const port=Number(process.env.PORT)||4177,host=process.env.HOST||'127.0.0.1';
  createApp().listen(port,host,()=>console.log(`La Basil preview: http://${host}:${port}`));
}
