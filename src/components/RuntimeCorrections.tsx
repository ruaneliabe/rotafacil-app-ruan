import { useEffect } from 'react';
import { subscribeToMotoboys } from '../lib/firebase';

export function RuntimeCorrections() {
  useEffect(() => {
    let logoutInProgress = false;
    const clearMotoboySessionAndReturnToLogin = () => {
      if (logoutInProgress) return; logoutInProgress = true;
      try { localStorage.removeItem('rota_facil_session'); localStorage.removeItem('rota_facil_active_motoboy_id'); sessionStorage.removeItem('rota_facil_session'); sessionStorage.removeItem('rota_facil_active_motoboy_id'); } catch {}
      window.location.replace(`${window.location.origin}${window.location.pathname}?login=1&t=${Date.now()}`);
    };

    const style=document.createElement('style'); style.id='rota-facil-runtime-navigation'; style.textContent=`
      .runtime-inline-complete-delivery{width:100%;min-height:52px;margin:10px 0 8px;border-radius:10px;border:1px solid rgb(110 231 183);background:rgb(16 185 129);color:rgb(2 6 23);font-size:14px;font-weight:800;cursor:pointer}.runtime-inline-complete-delivery:active{transform:scale(.98)}
      /* Store workspace: less dashboard, more dispatch desk. */
      .runtime-store-clean main{max-width:1480px!important}
      .runtime-store-clean .runtime-hide-store-chrome{display:none!important}
      .runtime-store-clean .runtime-compact-storebar{padding-top:10px!important;padding-bottom:10px!important;min-height:auto!important}
      .runtime-store-clean .runtime-compact-storebar .runtime-secondary-copy{display:none!important}
      .runtime-store-clean .runtime-flat-nav{background:transparent!important;border-radius:6px!important;box-shadow:none!important;padding:0!important}
      .runtime-store-clean .runtime-flat-nav button{border-radius:5px!important;box-shadow:none!important}
      .runtime-store-clean .runtime-dispatch-root{gap:0!important}
      .runtime-store-clean .runtime-dispatch-root>div:first-child{padding:2px 0 12px!important;border-bottom:1px solid rgb(51 65 85)!important;margin-bottom:0!important}
      .runtime-store-clean .runtime-dispatch-root>div:first-child h2{font-size:16px!important;font-weight:700!important}
      .runtime-store-clean .runtime-dispatch-root>div:first-child h2+*{display:none!important}
      .runtime-store-clean .runtime-dispatch-summary{background:transparent!important;border:0!important;border-bottom:1px solid rgb(30 41 59)!important;border-radius:0!important;padding:8px 0!important;margin-bottom:0!important}
      .runtime-store-clean .runtime-dispatch-columns{gap:0!important;border:1px solid rgb(51 65 85)!important;border-radius:7px!important;overflow:hidden!important;margin-top:0!important}
      .runtime-store-clean .runtime-dispatch-column{border:0!important;border-right:1px solid rgb(51 65 85)!important;border-radius:0!important;background:#0d1016!important;min-height:430px!important}
      .runtime-store-clean .runtime-dispatch-column:last-child{border-right:0!important}
      .runtime-store-clean .runtime-dispatch-column>div:first-child{padding:12px!important;background:#0b0e13!important}
      .runtime-store-clean .runtime-dispatch-column>div:first-child p{display:none!important}
      .runtime-store-clean .runtime-dispatch-column>div:first-child h3{font-size:12px!important;font-weight:700!important}
      .runtime-store-clean .runtime-dispatch-card{border-radius:4px!important;box-shadow:none!important;background:#111318!important}
      @media(max-width:1279px){.runtime-store-clean .runtime-dispatch-columns{border:0!important;gap:8px!important;overflow:visible!important}.runtime-store-clean .runtime-dispatch-column{border:1px solid rgb(51 65 85)!important;border-radius:6px!important}}
    `; document.head.appendChild(style);

    const unsubscribeSessionGuard=subscribeToMotoboys((cloudMotoboys)=>{if(logoutInProgress)return;try{const raw=localStorage.getItem('rota_facil_session');if(!raw)return;const s=JSON.parse(raw) as {role?:string;motoboyId?:string};if(s.role!=='motoboy'||!s.motoboyId)return;const d=cloudMotoboys.find(m=>m.id===s.motoboyId) as any;if(!d||d.accessRevokedAt)clearMotoboySessionAndReturnToLogin()}catch(e){console.warn('Falha ao validar sessão global do motoboy:',e)}});

    const apply=()=>{
      const buttons=Array.from(document.querySelectorAll('button'));
      const dispatchTitle=Array.from(document.querySelectorAll('h1,h2,h3')).find(e=>e.textContent?.trim()==='Pedidos & Despacho');
      const dispatchRoot=dispatchTitle?.parentElement?.parentElement as HTMLElement|null;
      if(dispatchRoot){document.body.classList.add('runtime-store-clean');dispatchRoot.classList.add('runtime-dispatch-root');
        Array.from(dispatchRoot.children).forEach((c,i)=>{const el=c as HTMLElement;if(i===1&&el.classList.contains('bg-slate-900'))el.classList.add('runtime-dispatch-summary');if(el.classList.contains('grid')&&el.querySelector('section')){el.classList.add('runtime-dispatch-columns');Array.from(el.querySelectorAll(':scope > section')).forEach(s=>s.classList.add('runtime-dispatch-column'));Array.from(el.querySelectorAll(':scope > section > div:nth-child(2) > div')).forEach(card=>{if(!card.textContent?.includes('Nenhum pedido'))card.classList.add('runtime-dispatch-card')})}});
      }
      // Hide the duplicated large store dashboard above the navigation; keep the global header and operational controls.
      if(dispatchRoot){let node=dispatchRoot.parentElement?.firstElementChild as HTMLElement|null;while(node&&node!==dispatchRoot){if(node.querySelector?.('button')&&node.textContent?.includes('Rota Fácil')&&node.textContent?.includes('Novo Pedido'))node.classList.add('runtime-hide-store-chrome');node=node.nextElementSibling as HTMLElement|null}}
      // Make the remaining navigation compact and remove decorative helper copy.
      Array.from(document.querySelectorAll('nav,div')).forEach(el=>{const t=el.textContent||'';if(t.includes('Pedidos & Despacho')&&t.includes('Kanban')&&t.includes('Mapa ao Vivo')&&el.children.length<12)el.classList.add('runtime-flat-nav')});
      // Remove duplicated new-order action outside the dispatch toolbar.
      const newOrder=buttons.filter(b=>/novo pedido/i.test(b.textContent||''));if(newOrder.length>1)newOrder.slice(0,-1).forEach(b=>{const owner=b.closest('.runtime-hide-store-chrome');if(owner)(b as HTMLElement).style.display='none'});
      Array.from(document.querySelectorAll('p,span,div,h3')).forEach(el=>{if(el.children.length)return;if(el.textContent?.trim()==='Motoboy reservado')el.textContent='Pedidos vinculados a motoboy'});
      const arrival=buttons.filter(b=>b.textContent?.trim().toLowerCase()==='cheguei ao local');if(arrival.length>1)arrival.forEach(b=>{if(!b.closest('.fixed'))(b as HTMLElement).style.display='none'});
      const floating=buttons.find(b=>b.textContent?.trim().toLowerCase()==='concluir entrega'&&Boolean(b.closest('.fixed'))) as HTMLButtonElement|undefined;const inline=document.querySelector<HTMLButtonElement>('[data-runtime-inline-complete-delivery="1"]');if(floating){const fc=floating.closest('.fixed') as HTMLElement|null;if(fc)fc.style.display='none';const details=buttons.find(b=>{const t=b.textContent?.trim().toLowerCase()||'';return t.includes('ver detalhes')||t.includes('ocultar detalhes')});const wrap=details?.parentElement,content=wrap?.parentElement;if(content&&wrap&&!inline){const ib=document.createElement('button');ib.type='button';ib.dataset.runtimeInlineCompleteDelivery='1';ib.className='runtime-inline-complete-delivery';ib.innerHTML='✓ &nbsp; Concluir entrega';ib.onclick=()=>floating.click();content.insertBefore(ib,wrap)}}else if(inline)inline.remove();
      Array.from(document.querySelectorAll('span,p,div')).forEach(el=>{if(el.children.length)return;const t=el.textContent||'';if(/\b1 motoboys ativos\b/i.test(t))el.textContent=t.replace(/1 motoboys ativos/i,'1 motoboy em operação');else if(/\b(\d+) motoboys ativos\b/i.test(t))el.textContent=t.replace(/(\d+) motoboys ativos/i,'$1 motoboys em operação')});
    };
    apply();const observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true,characterData:true});const now=new Date(),next=new Date(now);next.setHours(24,0,2,0);const timer=window.setTimeout(()=>window.location.reload(),next.getTime()-now.getTime());return()=>{unsubscribeSessionGuard();observer.disconnect();window.clearTimeout(timer);style.remove();document.body.classList.remove('runtime-store-clean')};
  },[]);return null;
}
