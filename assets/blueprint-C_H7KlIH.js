(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const l of i.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&r(l)}).observe(document,{childList:!0,subtree:!0});function o(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function r(n){if(n.ep)return;n.ep=!0;const i=o(n);fetch(n.href,i)}})();const b=["U","D","C"],d=10,A={U:1,D:10,C:100},h={U:"D",D:"C"},v={D:"U",C:"D"},U=(a={})=>({U:0,D:0,C:0,...a}),T=a=>b.reduce((t,o)=>t+a[o]*A[o],0),P=(a,t)=>t in h&&a[t]>=d,S=(a,t)=>t in v&&a[t]>=1;function R(a,t){if(!P(a,t))throw new Error(`No se puede componer ${t}`);return{...a,[t]:a[t]-d,[h[t]]:a[h[t]]+1}}function x(a,t){if(!S(a,t))throw new Error(`No se puede descomponer ${t}`);return{...a,[t]:a[t]-1,[v[t]]:a[v[t]]+d}}const H=(a,t)=>Object.entries(t).every(([o,r])=>a[o]>=r);function I(a,t){if(!H(a,t))throw new Error("Inventario insuficiente");const o={...a};for(const[r,n]of Object.entries(t))o[r]-=n;return o}function k(a){let t=a;const o=new Set;return{get:()=>t,set(r){t=r,o.forEach(n=>n(t))},subscribe(r){return o.add(r),()=>o.delete(r)}}}const M={U:"Unidad",D:"Decena",C:"Centena"},j=["C","D","U"],N='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';function z(a,{forcedLayout:t=null,store:o=k(U()),goal:r={},onClose:n=null,resetTo:i={}}={}){const l=typeof n=="function";let D=r,p=o.get(),m=null,$=!1;const E=window.matchMedia("(orientation: portrait)"),L=()=>{const e=t??(E.matches?"v":"h");a.classList.toggle("layout-v",e==="v"),a.classList.toggle("layout-h",e==="h")};L(),t||E.addEventListener("change",L);const g=e=>`
    <section class="card card-${e}" data-type="${e}" aria-label="${M[e]}">
      <div class="gem gem-${e}" aria-hidden="true"></div>
      <div class="meta"><span class="count" data-count="${e}">0</span><span class="name"><b>${e}</b> ${M[e]}</span></div>
    </section>`,y=(e,s)=>`
    <div class="link">
      <button class="btn compose" data-act="compose" data-type="${s}" aria-label="Componer ${d} ${s} en 1 ${e}">
        ${N}<span>${d}→1</span>
      </button>
      <button class="btn decompose" data-act="decompose" data-type="${e}" aria-label="Descomponer 1 ${e} en ${d} ${s}">
        ${N}<span>1→${d}</span>
      </button>
    </div>`,O=e=>Object.entries(e).filter(([,s])=>s>0).map(([s,c])=>`<span class="chip"><i class="gem gem-${s} mini"></i>${c} ${s}</span>`).join("")||'<span class="goal-label">—</span>';a.innerHTML=`
    <section class="bpwin" role="dialog" aria-label="Mezclador de gemas">
      <header class="bp-head">
        <h1>Mezclador</h1>
        <div class="goal"><span class="goal-label">Piden</span><span class="chips" data-chips>${O(D)}</span></div>
        ${l?'<button class="btn ghost" data-act="close" aria-label="Cerrar">✕</button>':'<button class="btn ghost" data-act="reset" aria-label="Reiniciar">↺</button>'}
      </header>
      <main class="board">
        ${g("C")}${y("C","D")}${g("D")}${y("D","U")}${g("U")}
      </main>
      <footer class="bp-foot">
        <div class="sigma" aria-live="polite"><span class="sg">Σ</span><b data-sigma>0</b><small data-eq></small></div>
        <div class="net" data-net aria-live="polite"></div>
      </footer>
    </section>`;const u=e=>a.querySelector(e),C=Object.fromEntries(b.map(e=>[e,u(`[data-count="${e}"]`)])),q=e=>e?`${j.filter(c=>e[c]!==0).map(c=>`<span class="dl ${e[c]>0?"pos":"neg"}">${e[c]>0?"+":"−"}${Math.abs(e[c])} ${c}</span>`).join("")}<em>Σ se conserva</em>`:"<em>Toca una flecha para mezclar</em>";function f(){const e=o.get();for(const s of b)if(C[s].textContent=e[s],e[s]!==p[s]){const c=C[s].closest(".card");c.classList.remove("bump"),c.offsetWidth,c.classList.add("bump")}$&&(m=Object.fromEntries(b.map(s=>[s,e[s]-p[s]])),$=!1),p=e,u("[data-sigma]").textContent=T(e),u("[data-eq]").textContent=j.map(s=>`${e[s]}${s}`).join(" + "),u("[data-net]").innerHTML=q(m),a.querySelectorAll('[data-act="compose"]').forEach(s=>s.disabled=!P(e,s.dataset.type)),a.querySelectorAll('[data-act="decompose"]').forEach(s=>s.disabled=!S(e,s.dataset.type))}return a.addEventListener("click",e=>{if(l&&e.target===a)return n();const s=e.target.closest("[data-act]");if(!s||s.disabled)return;const{act:c,type:w}=s.dataset;c==="compose"||c==="decompose"?($=!0,o.set(c==="compose"?R(o.get(),w):x(o.get(),w))):c==="close"?n():c==="reset"&&(m=null,o.set(U(i)))}),l&&addEventListener("keydown",e=>{e.key==="Escape"&&!a.closest("[hidden]")&&n()}),o.subscribe(f),f(),{render:f,setGoal(e){D=e,u("[data-chips]").innerHTML=O(e)},clearNet(){m=null,p=o.get(),f()}}}export{b as T,U as a,H as b,k as c,z as m,I as s};
