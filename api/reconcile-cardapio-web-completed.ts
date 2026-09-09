import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const normalize=(v:any)=>String(v||'').trim().toLowerCase();
const terminal=['closed','delivered','finalized','concluded','completed','finished','done'];
const active=['picked_up','dispatched','in_transit'];

function db(){
 const config={apiKey:process.env.VITE_FIREBASE_API_KEY||process.env.FIREBASE_API_KEY,authDomain:process.env.VITE_FIREBASE_AUTH_DOMAIN||process.env.FIREBASE_AUTH_DOMAIN,projectId:process.env.VITE_FIREBASE_PROJECT_ID||process.env.FIREBASE_PROJECT_ID||'rotafcildelivery',storageBucket:process.env.VITE_FIREBASE_STORAGE_BUCKET||process.env.FIREBASE_STORAGE_BUCKET,messagingSenderId:process.env.VITE_FIREBASE_MESSAGING_SENDER_ID||process.env.FIREBASE_MESSAGING_SENDER_ID,appId:process.env.VITE_FIREBASE_APP_ID||process.env.FIREBASE_APP_ID};
 const app=getApps().length?getApp():initializeApp(config);
 return getFirestore(app,process.env.VITE_FIRESTORE_DATABASE_ID||process.env.FIRESTORE_DATABASE_ID||'ai-studio-rotafcildelivery-495fd3be-5974-4310-960a-26a794361d3b');
}

function statusOf(o:any){return normalize(o?.status??o?.order_status??o?.state??o?.current_status??o?.data?.status??o?.order?.status)}
async function detail(id:string,key:string){
 try{const r=await fetch(`https://integracao.cardapioweb.com/api/partner/v1/orders/${encodeURIComponent(id)}`,{headers:{'X-API-KEY':key}});if(!r.ok)return null;return await r.json()}catch{return null}
}

export default async function handler(req:any,res:any){
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method==='OPTIONS')return res.status(200).end();
 try{
  const store=db(); const snap=await getDocs(collection(store,'orders')); let checked=0,completed=0;
  for(const row of snap.docs){
   const o=row.data() as any;
   if(o.originChannel!=='cardapio_web'||!active.includes(o.status))continue;
   const key=o.cardapioWebApiKey||o.integrationApiKey||o.sourceApiKey;
   if(!key)continue;
   const id=String(o.externalOrderId||row.id.replace(/^cw_/,''));
   const remote=await detail(id,key); checked++;
   if(!remote||!terminal.includes(statusOf(remote)))continue;
   const now=Date.now();
   await setDoc(doc(store,'orders',row.id),{status:'delivered',cardapioWebStatus:statusOf(remote),closedInCardapioWeb:true,lastCardapioWebSyncAt:now,routeCompletedAt:o.routeCompletedAt||now,deliveredTimestamp:o.deliveredTimestamp||now,deliveredAt:o.deliveredAt||new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),closedAt:o.closedAt||new Date().toISOString()},{merge:true});
   completed++;
  }
  return res.status(200).json({success:true,checked,completed});
 }catch(e:any){return res.status(500).json({error:e?.message||String(e)})}
}
