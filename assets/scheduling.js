/* Flower delivery: a rolling three-hour lead time, Asia/Riyadh. */
(()=>{
'use strict';
if(window.LA_BASIL_SCHEDULE)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const ar=!window.LA_BASIL_REBUILD||document.documentElement.lang.startsWith('ar'),t=(a,b)=>ar?a:b;
const LEAD=3*60*60*1000,STEP=15*60*1000;
const parts=epoch=>{const values=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(epoch).map(p=>[p.type,p.value]));return {date:values.year+'-'+values.month+'-'+values.day,time:values.hour+':'+values.minute};};
const minimum=()=>{const epoch=Math.ceil((Date.now()+LEAD)/STEP)*STEP;return {...parts(epoch),epoch};};
const label=epoch=>new Intl.DateTimeFormat(ar?'ar-SA-u-ca-gregory':'en-GB',{timeZone:'Asia/Riyadh',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(epoch);
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
function bind(root,date,time,required){
 const originalMin=/^\d{4}-\d{2}-\d{2}$/.test((date.getAttribute('min')||'').replaceAll('/','-'))?(date.getAttribute('min')||'').replaceAll('/','-'):'';
 const originalTimeMin=/^\d{2}:\d{2}$/.test(time.min)?time.min:'';
 date.required=time.required=required;date.setAttribute('aria-required',String(required));time.setAttribute('aria-required',String(required));time.step='900';
 const help=node('p','lb-slot-help',t('نحتاج ٣ ساعات على الأقل لتجهيز طلب الورد. الأوقات بتوقيت الرياض.','Flower orders need at least 3 hours of preparation. Times are in Riyadh.'));
 const first=node('p','lb-slot-earliest');first.setAttribute('aria-live','polite');
 const error=node('p','lb-slot-error');error.setAttribute('role','alert');error.id='lb-slot-error-'+Math.random().toString(36).slice(2,9);
 [date,time].forEach(input=>input.setAttribute('aria-describedby',((input.getAttribute('aria-describedby')||'')+' '+error.id).trim()));
 const pick=node('button','lb-slot-pick',t('اختَر أقرب وقت مسموح','Choose the earliest allowed time'));pick.type='button';
 root.append(help,first,pick,error);
 function refresh(){const min=minimum();date.min=originalMin>min.date?originalMin:min.date;time.min=date.value===min.date?(originalTimeMin>min.time?originalTimeMin:min.time):originalTimeMin;first.textContent=t('أول وقت ممكن حسب مهلة التجهيز: ','Earliest time after preparation: ')+label(min.epoch)+t(' — الموعد النهائي حسب توفر المتجر.',' — subject to store availability.');return min;}
 function validate(report=false){refresh();date.setCustomValidity('');time.setCustomValidity('');error.textContent='';date.removeAttribute('aria-invalid');time.removeAttribute('aria-invalid');
  if(!required&&!date.value&&!time.value)return {date:'',time:''};
  let invalid=null,message='';
  if(!date.value){invalid=date;message=t('اختَر تاريخ التوصيل أولًا.','Choose a delivery date first.');}
  else if(!time.value){invalid=time;message=t('اختَر وقت التوصيل. نحتاج ٣ ساعات على الأقل للتجهيز.','Choose a delivery time at least 3 hours from now.');}
  else if(!date.checkValidity()){invalid=date;message=t('اختَر تاريخًا يوافق الحد الأدنى الظاهر.','Choose a date that meets the displayed minimum.');}
  else{const requested=Date.parse(date.value+'T'+time.value.slice(0,5)+':00+03:00');if(!Number.isFinite(requested)||requested<Date.now()+LEAD){invalid=time;message=t('هذا الموعد قريب جدًا. اختَر موعدًا بعد ٣ ساعات على الأقل من الآن.','That time is too soon. Choose a time at least 3 hours from now.');}else if(!time.checkValidity()){invalid=time;message=t('اختَر وقتًا مسموحًا بفواصل ربع ساعة.','Choose an allowed time in 15-minute steps.');}}
  if(invalid){invalid.setCustomValidity(message);invalid.setAttribute('aria-invalid','true');error.textContent=message;if(report){invalid.focus();invalid.reportValidity();}return false;}
  return {date:date.value,time:time.value.slice(0,5)};
 }
 [date,time].forEach(input=>{input.addEventListener('input',()=>{input.setCustomValidity('');input.removeAttribute('aria-invalid');error.textContent='';refresh();});input.addEventListener('blur',()=>{if(date.value||time.value)validate(false);});input.addEventListener('focus',refresh);input.addEventListener('change',refresh);});
 pick.addEventListener('click',()=>{const min=refresh();date.value=date.min;time.value=date.value===min.date?(time.min||min.time):(originalTimeMin||'00:00');[date,time].forEach(input=>{input.setCustomValidity('');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});validate(false);});refresh();return {validate,refresh,date,time};
}
let productSlot=null,cartSlot=null;
function createPanel(id,title){const panel=node('fieldset','lb-slot-panel');panel.id=id;const legend=node('legend','',title),grid=node('div','lb-slot-grid');const dLabel=node('label','',t('تاريخ التوصيل *','Delivery date *')),d=node('input','field-input');d.type='date';d.id=id+'-date';dLabel.htmlFor=d.id;dLabel.append(d);const tmLabel=node('label','',t('وقت التوصيل *','Delivery time *')),tm=node('input','field-input');tm.type='time';tm.id=id+'-time';tmLabel.htmlFor=tm.id;tmLabel.append(tm);grid.append(dLabel,tmLabel);panel.append(legend,grid);return {panel,date:d,time:tm};}
function mountPreview(p,saved){productSlot=null;if(p.category!=='flowers')return;const fields=createPanel('lb-flower-slot',t('موعد توصيل الورد','Flower delivery time'));const before=$('.message-label',$('#product-content'));if(!before)return;before.before(fields.panel);productSlot=bind(fields.panel,fields.date,fields.time,true);fields.date.value=saved?.deliveryDate||'';fields.time.value=saved?.deliveryTime||'';productSlot.refresh();}
function readPreview(p){return p.category==='flowers'?(productSlot?.validate(true)||false):{date:'',time:''};}
function mountCart(lines){const needs=lines.some(line=>(window.LA_BASIL_CATALOGUE||[]).find(p=>p.id===line.id)?.category==='flowers');const date=$('#requested-date');if(!date)return;let root=$('#lb-cart-slot');if(!needs){if(root)root.hidden=true;date.required=false;date.setCustomValidity('');date.min=parts(Date.now()).date;const previousTime=$('#requested-time');if(previousTime){previousTime.required=false;previousTime.setCustomValidity('');}return;}if(!root){root=node('div','lb-cart-slot');root.id='lb-cart-slot';const timeLabel=node('label','',t('وقت توصيل الورد *','Flower delivery time *')),time=node('input','field-input');time.type='time';time.id='requested-time';timeLabel.htmlFor=time.id;timeLabel.append(time);root.append(timeLabel);date.closest('.order-fields').append(root);cartSlot=bind(root,date,time,true);}else{root.hidden=false;const tm=$('#requested-time');date.required=tm.required=true;if(!cartSlot)cartSlot=bind(root,date,tm,true);}
 const saved=lines.find(x=>x.deliveryDate&&x.deliveryTime);if(saved&&!date.value){date.value=saved.deliveryDate;$('#requested-time').value=saved.deliveryTime;}cartSlot.refresh();}
function readCart(lines){const needs=lines.some(line=>(window.LA_BASIL_CATALOGUE||[]).find(p=>p.id===line.id)?.category==='flowers');return needs?(cartSlot?.validate(true)||false):{date:$('#requested-date')?.value||'',time:''};}
window.LA_BASIL_SCHEDULE={minimum,parts,mountPreview,readPreview,mountCart,readCart,label,bindFields:bind};
function native(){
 if(!window.LA_BASIL_REBUILD)return;const form=$('#product-form');if(!form)return;
 const products=$$('script[type="application/ld+json"]').flatMap(script=>{try{const json=JSON.parse(script.textContent);return json['@graph']||(Array.isArray(json)?json:[json]);}catch{return [];}});
 const product=products.find(p=>p['@type']==='Product'||Array.isArray(p['@type'])&&p['@type'].includes('Product'));
 if(!product||!/ورد|flower|floral|bouquet/i.test(String(product.category||'')))return;
 const date=$('input[data-type="DATE"]',form),time=$('input[data-type="TIME"]',form);if(!date||!time)return;
 const root=$('.lb-delivery',form)||time.parentElement;const slot=bind(root,date,time,true);
 document.addEventListener('click',e=>{const target=e.target.closest?.('#product-view-add-to-cart,#product-form .btn-buy-now,[onclick*="productAddToCart("],[onclick*="productBuyNow("]');if(target&&!slot.validate(true)){e.preventDefault();e.stopImmediatePropagation();}},true);
 form.addEventListener('submit',e=>{if(!slot.validate(true)){e.preventDefault();e.stopImmediatePropagation();}},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',native,{once:true});else native();
})();
