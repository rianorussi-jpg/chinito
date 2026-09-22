import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChefHat, Clock3, Flame, LogOut, Printer, RotateCcw, ShoppingBag } from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'

const orderSelect='id,order_number,customer_name,customer_phone,pickup_label,total,status,created_at,order_items(id,item_type,name,quantity,unit_price,base_name,guisados,extras,variant)'

export default function App(){
 const [orders,setOrders]=useState([])
 const [filter,setFilter]=useState('Todos')
 const [session,setSession]=useState(null)
 const [authReady,setAuthReady]=useState(false)
 const [authError,setAuthError]=useState('')
 const [loading,setLoading]=useState(false)

 const validateSession=useCallback(async(nextSession)=>{
   if(!nextSession || !supabase){setSession(null);setAuthReady(true);return}
   const {data,error}=await supabase.from('staff_users').select('role,active').eq('user_id',nextSession.user.id).maybeSingle()
   if(error || !data?.active || !['admin','kitchen'].includes(data.role)){
     setAuthError('Esta cuenta no tiene acceso a Cocina.')
     await supabase.auth.signOut()
     setSession(null)
   }else{
     setAuthError('')
     setSession(nextSession)
   }
   setAuthReady(true)
 },[])

 useEffect(()=>{
   if(!supabaseConfigured){setAuthReady(true);return}
   supabase.auth.getSession().then(({data})=>validateSession(data.session))
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>validateSession(next),0)})
   return ()=>subscription.unsubscribe()
 },[validateSession])

 const loadOrders=useCallback(async()=>{
   if(!supabase || !session)return
   setLoading(true)
   const start=new Date(); start.setHours(0,0,0,0)
   const {data}=await supabase.from('orders').select(orderSelect).gte('created_at',start.toISOString()).in('status',['Nuevo','Preparando','Listo']).order('created_at',{ascending:true})
   if(data)setOrders(data)
   setLoading(false)
 },[session])

 useEffect(()=>{loadOrders()},[loadOrders])
 useEffect(()=>{
   if(!supabase || !session)return
   const channel=supabase.channel('kitchen-live')
     .on('postgres_changes',{event:'*',schema:'public',table:'orders'},loadOrders)
     .on('postgres_changes',{event:'*',schema:'public',table:'order_items'},loadOrders)
     .subscribe()
   return ()=>{supabase.removeChannel(channel)}
 },[session,loadOrders])

 const visible=useMemo(()=>filter==='Todos'?orders:orders.filter(o=>o.status===filter),[filter,orders])
 const advance=async(order)=>{
   const next=order.status==='Nuevo'?'Preparando':order.status==='Preparando'?'Listo':'Entregado'
   const {error}=await supabase.from('orders').update({status:next}).eq('id',order.id)
   if(!error){
     if(next==='Entregado')setOrders(prev=>prev.filter(o=>o.id!==order.id))
     else setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:next}:o))
   }
 }

 if(!supabaseConfigured)return <SetupMissing/>
 if(!authReady)return <div className="k-auth"><div className="k-auth-card">Conectando con Supabase…</div></div>
 if(!session)return <KitchenLogin error={authError}/>

 return <div className="kitchen"><header><div className="brand"><img src="/logo.jpg" alt="Chi-nito"/><div><span>KITCHEN MODE</span><b>CHI-NITO</b></div></div><div className="header-right"><div className="online"><i/> {loading?'Actualizando…':'Cocina conectada'}</div><button onClick={loadOrders} aria-label="Actualizar"><RotateCcw size={17}/></button><button onClick={()=>supabase.auth.signOut()} aria-label="Cerrar sesión"><LogOut size={17}/></button></div></header>
  <main><section className="k-head"><div><span className="eyebrow">PEDIDOS EN TIEMPO REAL</span><h1>Cola de cocina</h1></div><div className="counters"><Counter label="Nuevos" n={orders.filter(o=>o.status==='Nuevo').length}/><Counter label="Preparando" n={orders.filter(o=>o.status==='Preparando').length}/><Counter label="Listos" n={orders.filter(o=>o.status==='Listo').length}/></div></section>
  <div className="filters">{['Todos','Nuevo','Preparando','Listo'].map(x=><button onClick={()=>setFilter(x)} className={filter===x?'active':''} key={x}>{x}</button>)}</div>
  <section className="orders-grid">{visible.map(o=><Ticket key={o.id} order={o} advance={()=>advance(o)}/>)}</section>
  {visible.length===0&&<div className="empty"><ChefHat size={50}/><h2>No hay pedidos en esta vista</h2><p>Los nuevos pedidos aparecerán aquí automáticamente.</p></div>}
  </main>
 </div>
}
function Counter({label,n}){return <div><span>{label}</span><b>{n}</b></div>}
function Ticket({order,advance}){
 const next=order.status==='Nuevo'?'Aceptar pedido':order.status==='Preparando'?'Marcar como listo':'Entregar pedido'
 const elapsed=Math.max(0,Math.floor((Date.now()-new Date(order.created_at).getTime())/60000))
 return <article className={`ticket ${order.status.toLowerCase()}`}><div className="ticket-top"><div><span>{order.order_number}</span><b>{order.customer_name}</b></div><em>{order.status}</em></div><div className="pickup"><ShoppingBag size={18}/><div><b>{order.pickup_label}</b><span>Hace {elapsed} min · {order.customer_phone}</span></div><Clock3 size={18}/></div><div className="items">{(order.order_items||[]).map(i=><KitchenItem item={i} key={i.id}/>)}</div><div className="ticket-actions"><button className="print" onClick={()=>window.print()}><Printer size={18}/> Imprimir</button><button className="advance" onClick={advance}>{order.status==='Listo'?<Check size={18}/>:<Flame size={18}/>} {next}</button></div></article>
}
function KitchenItem({item}){
 const extras=(item.extras||[]).map(e=>`${e.quantity>1?`${e.quantity}× `:''}${e.name}`).join(', ')
 const guisados=Array.isArray(item.guisados)?item.guisados.join(' · '):''
 return <div className="item"><strong>{item.quantity>1?`${item.quantity} × `:''}{item.name}</strong>{item.base_name&&<span>BASE · {item.base_name}</span>}{item.variant&&<span>{item.variant}</span>}{guisados&&<p>{guisados}</p>}{extras&&<p><b>Extras:</b> {extras}</p>}</div>
}

function KitchenLogin({error}){
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState(error||'')
 useEffect(()=>setMessage(error||''),[error])
 const login=async(e)=>{e.preventDefault();setBusy(true);setMessage('');const {error:loginError}=await supabase.auth.signInWithPassword({email,password});if(loginError)setMessage(loginError.message);setBusy(false)}
 return <div className="k-auth"><form className="k-auth-card" onSubmit={login}><img src="/logo.jpg" alt="Chi-nito"/><span className="eyebrow">ACCESO DE PERSONAL</span><h1>Kitchen Mode</h1><label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{message&&<p className="k-auth-error">{message}</p>}<button disabled={busy}>{busy?'Entrando…':'Entrar a cocina'}</button></form></div>
}
function SetupMissing(){return <div className="k-auth"><div className="k-auth-card"><img src="/logo.jpg" alt="Chi-nito"/><h1>Kitchen Mode</h1><p>Faltan <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> en Vercel.</p></div></div>}
