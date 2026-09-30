import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChefHat, Clock3, Flame, LogOut, Minus, Phone, Plus, Printer, RotateCcw, ShoppingBag, UserRound, X } from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'

const orderSelect='id,order_number,customer_name,customer_phone,pickup_label,payment_method,payment_status,total,status,created_at,order_items(id,item_type,name,quantity,unit_price,base_name,guisados,extras,variant)'
const activeStatuses=['Nuevo','Preparando','Listo']
const isScheduledPickup=(label='')=>/^\d{2}:\d{2}$/.test(String(label||'').trim())
const scheduledPickupAt=(order)=>{
  if(!isScheduledPickup(order?.pickup_label))return null
  const [hours,minutes]=String(order.pickup_label).split(':').map(Number)
  const scheduled=new Date(order.created_at)
  scheduled.setHours(hours,minutes,0,0)
  return scheduled
}
const minutesUntilPickup=(order,now=Date.now())=>{
  const scheduled=scheduledPickupAt(order)
  return scheduled?Math.ceil((scheduled.getTime()-now)/60000):null
}
const isWaitingScheduledOrder=(order,now=Date.now())=>{
  if(order?.status==='Listo'||!isScheduledPickup(order?.pickup_label))return false
  const scheduled=scheduledPickupAt(order)
  return Boolean(scheduled&&scheduled.getTime()-now>15*60*1000)
}

export default function App(){
 const [orders,setOrders]=useState([])
 const [menu,setMenu]=useState([])
 const [session,setSession]=useState(null)
 const [authReady,setAuthReady]=useState(false)
 const [authError,setAuthError]=useState('')
 const [loading,setLoading]=useState(false)
 const [newOrderOpen,setNewOrderOpen]=useState(false)
 const [scheduledOpen,setScheduledOpen]=useState(false)
 const [clock,setClock]=useState(()=>Date.now())

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
   const {data,error}=await supabase.from('orders').select(orderSelect).in('status',activeStatuses).or('payment_method.eq.pickup,payment_status.eq.paid').order('created_at',{ascending:true})
   if(!error&&data)setOrders(data)
   setLoading(false)
 },[session])

 const loadMenu=useCallback(async()=>{
   if(!supabase || !session)return
   const {data,error}=await supabase.from('menu_items').select('*').eq('active',true).order('sort_order',{ascending:true})
   if(!error&&data)setMenu(data)
 },[session])

 useEffect(()=>{loadOrders();loadMenu()},[loadOrders,loadMenu])
 useEffect(()=>{
   const timer=window.setInterval(()=>setClock(Date.now()),30000)
   return ()=>window.clearInterval(timer)
 },[])

 useEffect(()=>{
   if(!supabase || !session)return
   const channel=supabase.channel('kitchen-live')
     .on('postgres_changes',{event:'*',schema:'public',table:'orders'},loadOrders)
     .on('postgres_changes',{event:'*',schema:'public',table:'order_items'},loadOrders)
     .on('postgres_changes',{event:'*',schema:'public',table:'menu_items'},loadMenu)
     .subscribe()
   return ()=>{supabase.removeChannel(channel)}
 },[session,loadOrders,loadMenu])

 const scheduled=useMemo(()=>orders.filter(o=>isWaitingScheduledOrder(o,clock)).sort((a,b)=>scheduledPickupAt(a)-scheduledPickupAt(b)),[orders,clock])
 const scheduledIds=useMemo(()=>new Set(scheduled.map(o=>o.id)),[scheduled])
 const preparing=useMemo(()=>orders.filter(o=>(o.status==='Nuevo'||o.status==='Preparando')&&!scheduledIds.has(o.id)),[orders,scheduledIds])
 const ready=useMemo(()=>orders.filter(o=>o.status==='Listo'),[orders])

 const advance=async(order)=>{
   const next=order.status==='Listo'?'Entregado':'Listo'
   const {error}=await supabase.from('orders').update({status:next}).eq('id',order.id)
   if(!error){
     if(next==='Entregado')setOrders(prev=>prev.filter(o=>o.id!==order.id))
     else setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:next}:o))
   }
 }

 if(!supabaseConfigured)return <SetupMissing/>
 if(!authReady)return <div className="k-auth"><div className="k-auth-card">Conectando con Supabase…</div></div>
 if(!session)return <KitchenLogin error={authError}/>

 return <div className="kitchen">
  <header><div className="brand"><img src="/logo.jpg" alt="Chi-nito"/><div><span>KITCHEN MODE</span><b>CHI-NITO</b></div></div><div className="header-right"><div className="online"><i/> {loading?'Actualizando…':'Cocina conectada'}</div><button onClick={loadOrders} aria-label="Actualizar"><RotateCcw size={17}/></button><button onClick={()=>supabase.auth.signOut()} aria-label="Cerrar sesión"><LogOut size={17}/></button></div></header>
  <main>
    <section className="k-head"><div><span className="eyebrow">PEDIDOS EN TIEMPO REAL</span><h1>Kitchen Mode</h1><p>Prepara, libera y entrega pedidos desde una sola vista.</p></div><div className="k-head-actions"><div className="counters"><Counter label="Preparando" n={preparing.length}/><Counter label="Listos" n={ready.length}/></div><button className="scheduled-orders-button" onClick={()=>setScheduledOpen(true)}><Clock3 size={18}/> Pedidos programados <b>{scheduled.length}</b></button><button className="new-order-button" onClick={()=>setNewOrderOpen(true)}><Plus size={19}/> Nuevo pedido</button></div></section>

    <section className="k-board">
      <OrderLane title="Preparando" subtitle="Todos los pedidos activos en preparación" count={preparing.length} tone="prep">
        {preparing.length?preparing.map(o=><Ticket key={o.id} order={o} advance={()=>advance(o)}/>):<LaneEmpty icon={<Flame size={34}/>} title="Sin pedidos preparando" text="Los pedidos activos aparecerán aquí automáticamente, aunque sean de días anteriores."/>}
      </OrderLane>
      <OrderLane title="Listos para recoger" subtitle="Esperando al cliente" count={ready.length} tone="ready">
        {ready.length?ready.map(o=><Ticket key={o.id} order={o} advance={()=>advance(o)}/>):<LaneEmpty icon={<Check size={34}/>} title="Nada listo todavía" text="Cuando marques un pedido como listo aparecerá en esta columna."/>}
      </OrderLane>
    </section>
  </main>
  {scheduledOpen&&<ScheduledOrdersModal orders={scheduled} now={clock} onClose={()=>setScheduledOpen(false)}/>}
  {newOrderOpen&&<NewOrderModal menu={menu} onClose={()=>setNewOrderOpen(false)} onCreated={()=>{setNewOrderOpen(false);loadOrders()}}/>}
 </div>
}

function Counter({label,n}){return <div><span>{label}</span><b>{n}</b></div>}

function OrderLane({title,subtitle,count,tone,children}){
 return <section className={`order-lane ${tone}`}><div className="lane-head"><div><span>{title}</span><small>{subtitle}</small></div><b>{count}</b></div><div className="lane-list">{children}</div></section>
}

function LaneEmpty({icon,title,text}){return <div className="lane-empty">{icon}<h3>{title}</h3><p>{text}</p></div>}

function Ticket({order,advance}){
 const next=order.status==='Listo'?'Entregar pedido':'Marcar como listo'
 const elapsed=Math.max(0,Math.floor((Date.now()-new Date(order.created_at).getTime())/60000))
 return <article className={`ticket ${order.status.toLowerCase()}`}>
   <div className="ticket-top"><div><span>{order.order_number}</span><b>{order.customer_name}</b></div><em>{order.status==='Listo'?'Listo':'Preparando'}</em></div>
   <div className="pickup"><ShoppingBag size={18}/><div><b>{order.pickup_label}</b><span>Hace {elapsed} min · {order.customer_phone}</span></div><Clock3 size={18}/></div>
   <div className="items">{(order.order_items||[]).map(i=><KitchenItem item={i} key={i.id}/>)}</div>
   <div className="ticket-actions"><button className="print" onClick={()=>window.print()}><Printer size={18}/> Imprimir</button><button className="advance" onClick={advance}>{order.status==='Listo'?<Check size={18}/>:<Flame size={18}/>} {next}</button></div>
 </article>
}

function ScheduledOrdersModal({orders,now,onClose}){
 return <div className="scheduled-orders-overlay" onMouseDown={onClose}>
   <section className="scheduled-orders-modal" onMouseDown={e=>e.stopPropagation()}>
     <header><div><span>PEDIDOS PROGRAMADOS</span><h2>Próximos pickups</h2><p>Se moverán automáticamente a Preparando 15 minutos antes de la hora elegida.</p></div><button onClick={onClose} aria-label="Cerrar"><X size={21}/></button></header>
     <div className="scheduled-orders-list">
       {orders.length===0?<div className="scheduled-orders-empty"><Clock3 size={34}/><h3>No hay pedidos programados</h3><p>Los pedidos con horario futuro aparecerán aquí hasta 15 minutos antes de su pickup.</p></div>:orders.map(order=>{
         const minutes=minutesUntilPickup(order,now)
         return <article className="scheduled-order-card" key={order.id}>
           <div className="scheduled-order-time"><Clock3 size={18}/><strong>{order.pickup_label}</strong><span>{minutes>60?`en ${Math.floor(minutes/60)} h ${minutes%60} min`:`en ${Math.max(0,minutes)} min`}</span></div>
           <div className="scheduled-order-main"><div className="scheduled-order-title"><span>{order.order_number}</span><b>{order.customer_name}</b></div><p>{(order.order_items||[]).map(i=>`${i.quantity>1?`${i.quantity}× `:''}${i.name}`).join(' · ')}</p><small>{order.customer_phone||'Sin teléfono'} · ${Number(order.total||0).toFixed(2)}</small></div>
         </article>
       })}
     </div>
   </section>
 </div>
}

function KitchenItem({item}){
 const extras=(item.extras||[]).map(e=>`${e.quantity>1?`${e.quantity}× `:''}${e.name}`).join(', ')
 const guisados=Array.isArray(item.guisados)?item.guisados.join(' · '):''
 return <div className="item"><strong>{item.quantity>1?`${item.quantity} × `:''}{item.name}</strong>{item.base_name&&<span>BASE · {item.base_name}</span>}{item.variant&&<span>{item.variant}</span>}{guisados&&<p>{guisados}</p>}{extras&&<p><b>Extras:</b> {extras}</p>}</div>
}

const maxGuisadosFor=(product)=>Math.max(1,Math.min(10,Number(product?.metadata?.max_guisados||({'chi-nito-1':1,'chi-nito-2':2,'chi-nito-3':3}[product?.slug])||1)))
const money=(n)=>Number(n||0).toFixed(2)

function NewOrderModal({menu,onClose,onCreated}){
 const active=useMemo(()=>menu.filter(x=>x.active!==false),[menu])
 const products=useMemo(()=>active.filter(x=>x.category==='Chi-nito'),[active])
 const bases=useMemo(()=>active.filter(x=>x.category==='Base'),[active])
 const guisados=useMemo(()=>active.filter(x=>x.category==='Guisado'),[active])
 const extras=useMemo(()=>active.filter(x=>['Bebida','Complemento','Extra'].includes(x.category)),[active])
 const complements=useMemo(()=>active.filter(x=>x.category==='Complemento'),[active])
 const drinks=useMemo(()=>active.filter(x=>x.category==='Bebida'),[active])
 const takeaway=useMemo(()=>guisados.filter(x=>x.metadata?.sell_by_volume!==false&&(Number(x.metadata?.half_price)>0||Number(x.metadata?.liter_price)>0)),[guisados])
 const [customerName,setCustomerName]=useState('')
 const [customerPhone,setCustomerPhone]=useState('')
 const [pickup,setPickup]=useState('Lo antes posible · 20–30 min')
 const [product,setProduct]=useState(null)
 const [base,setBase]=useState(null)
 const [selectedGuisados,setSelectedGuisados]=useState([])
 const [extraQty,setExtraQty]=useState({})
 const [cart,setCart]=useState([])
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')

 useEffect(()=>{if(!base&&bases.length)setBase(bases[0])},[bases,base])

 const chooseProduct=(p)=>{setProduct(p);setBase(bases[0]||null);setSelectedGuisados([]);setExtraQty({})}
 const toggleGuisado=(g)=>{
   if(!product)return
   const max=maxGuisadosFor(product)
   setSelectedGuisados(prev=>prev.some(x=>x.slug===g.slug)?prev.filter(x=>x.slug!==g.slug):prev.length<max?[...prev,g]:prev)
 }
 const changeExtra=(item,delta)=>setExtraQty(prev=>{
   const next=Math.max(0,Math.min(20,Number(prev[item.slug]||0)+delta))
   const clone={...prev}; if(next)clone[item.slug]=next;else delete clone[item.slug]; return clone
 })
 const builderTotal=product?Number(product.price||0)+Number(base?.price||0)+selectedGuisados.reduce((s,g)=>s+Number(g.price||0),0)+Object.entries(extraQty).reduce((s,[slug,qty])=>s+(Number(extras.find(x=>x.slug===slug)?.price||0)*qty),0):0
 const addConfigured=()=>{
   setError('')
   if(!product||!base||!selectedGuisados.length){setError('Selecciona Chi-nito, base y al menos un guisado.');return}
   const chosenExtras=Object.entries(extraQty).map(([slug,quantity])=>({item:extras.find(x=>x.slug===slug),quantity})).filter(x=>x.item)
   const row={
     key:`cfg-${Date.now()}-${Math.random()}`,
     label:product.name,
     detail:`${base.name} · ${selectedGuisados.map(g=>g.name).join(', ')}${chosenExtras.length?` · Extras: ${chosenExtras.map(x=>`${x.quantity>1?`${x.quantity}× `:''}${x.item.name}`).join(', ')}`:''}`,
     unit:builderTotal,
     payload:{kind:'configured',catalog_slug:product.slug,quantity:1,base_slug:base.slug,guisado_slugs:selectedGuisados.map(g=>g.slug),extras:chosenExtras.map(x=>({catalog_slug:x.item.slug,quantity:x.quantity}))},
   }
   setCart(prev=>[...prev,row]);setSelectedGuisados([]);setExtraQty({})
 }
 const addSimple=(item,kind,variant=null,priceOverride=null)=>{
   const unit=Number((priceOverride ?? item.price) || 0)
   setCart(prev=>[...prev,{key:`simple-${Date.now()}-${Math.random()}`,label:item.name,detail:variant||item.category,unit,payload:{kind,catalog_slug:item.slug,quantity:1,variant}}])
 }
 const changeCartQty=(key,delta)=>setCart(prev=>prev.flatMap(row=>{
   if(row.key!==key)return [row]
   const quantity=Math.max(0,Math.min(20,Number(row.payload.quantity||1)+delta))
   return quantity?[{...row,payload:{...row.payload,quantity}}]:[]
 }))
 const total=cart.reduce((s,row)=>s+row.unit*Number(row.payload.quantity||1),0)
 const submit=async()=>{
   setError('')
   if(!cart.length){setError('Agrega al menos un producto al pedido.');return}
   setBusy(true)
   const {error:rpcError}=await supabase.rpc('create_staff_order',{p_customer_name:customerName,p_customer_phone:customerPhone,p_pickup_label:pickup,p_items:cart.map(row=>row.payload)})
   setBusy(false)
   if(rpcError){setError(rpcError.message||'No se pudo crear el pedido.');return}
   onCreated()
 }

 return <div className="manual-order-overlay" onMouseDown={onClose}>
   <section className="manual-order-modal" onMouseDown={e=>e.stopPropagation()}>
     <header className="manual-order-head"><div><span>NUEVO PEDIDO</span><h2>Captura desde cocina</h2><p>Arma el pedido igual que en la app y envíalo directo a Preparando.</p></div><button onClick={onClose} aria-label="Cerrar"><X size={22}/></button></header>
     <div className="manual-order-body">
       <div className="manual-order-builder">
         <section className="manual-customer"><label><UserRound size={16}/><span>Nombre del cliente</span><input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Mostrador"/></label><label><Phone size={16}/><span>Teléfono</span><input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="Opcional"/></label><label className="wide"><Clock3 size={16}/><span>Pickup</span><select value={pickup} onChange={e=>setPickup(e.target.value)}><option>Lo antes posible · 20–30 min</option><option>En 15 minutos</option><option>En 30 minutos</option><option>En 45 minutos</option></select></label></section>

         <section className="manual-section"><div className="manual-section-title"><span>1</span><div><h3>Elige un Chi-nito</h3><p>Después selecciona base, guisados y extras.</p></div></div><div className="manual-product-grid">{products.map(p=><button key={p.slug} className={product?.slug===p.slug?'selected':''} onClick={()=>chooseProduct(p)}><img src={p.image||'/logo.jpg'} alt=""/><b>{p.name}</b><span>${money(p.price)}</span></button>)}</div></section>

         {product&&<section className="manual-section configured"><div className="manual-config-head"><div><span>PERSONALIZANDO</span><h3>{product.name}</h3></div><strong>${money(builderTotal)}</strong></div><h4>Base</h4><div className="manual-choice-grid compact">{bases.map(b=><button key={b.slug} className={base?.slug===b.slug?'selected':''} onClick={()=>setBase(b)}><b>{b.name}</b>{Number(b.price)>0&&<span>+${money(b.price)}</span>}</button>)}</div><h4>Guisados <small>{selectedGuisados.length}/{maxGuisadosFor(product)}</small></h4><div className="manual-choice-grid">{guisados.map(g=><button key={g.slug} className={selectedGuisados.some(x=>x.slug===g.slug)?'selected':''} onClick={()=>toggleGuisado(g)}><b>{g.name}</b>{Number(g.price)>0&&<span>+${money(g.price)}</span>}</button>)}</div><h4>Extras</h4><div className="manual-extra-grid">{extras.map(item=>{const qty=Number(extraQty[item.slug]||0);return <div key={item.slug}><div><b>{item.name}</b><span>${money(item.price)}</span></div><div className="manual-qty"><button onClick={()=>changeExtra(item,-1)} disabled={!qty}><Minus size={13}/></button><strong>{qty}</strong><button onClick={()=>changeExtra(item,1)}><Plus size={13}/></button></div></div>})}</div><button className="manual-add-configured" onClick={addConfigured}><Plus size={17}/> Agregar {product.name} · ${money(builderTotal)}</button></section>}

         <section className="manual-section"><div className="manual-section-title"><span>2</span><div><h3>Complementos y bebidas</h3><p>Agrégalos directamente al pedido.</p></div></div><div className="manual-simple-grid">{[...complements,...drinks].map(item=><button key={item.slug} onClick={()=>addSimple(item,item.category==='Bebida'?'drink':'addon')}><img src={item.image||'/logo.jpg'} alt=""/><div><b>{item.name}</b><span>${money(item.price)}</span></div><Plus size={16}/></button>)}</div></section>

         {takeaway.length>0&&<section className="manual-section"><div className="manual-section-title"><span>3</span><div><h3>Guisados para llevar</h3><p>Agrega medio litro o un litro.</p></div></div><div className="manual-takeaway-grid">{takeaway.map(item=><div key={item.slug}><b>{item.name}</b><div>{Number(item.metadata?.half_price)>0&&<button onClick={()=>addSimple(item,'takeaway','1/2 litro',item.metadata.half_price)}>1/2 L · ${money(item.metadata.half_price)}</button>}{Number(item.metadata?.liter_price)>0&&<button onClick={()=>addSimple(item,'takeaway','1 litro',item.metadata.liter_price)}>1 L · ${money(item.metadata.liter_price)}</button>}</div></div>)}</div></section>}
       </div>

       <aside className="manual-cart"><div className="manual-cart-head"><div><span>PEDIDO</span><h3>Resumen</h3></div><b>{cart.reduce((s,r)=>s+Number(r.payload.quantity||1),0)}</b></div><div className="manual-cart-items">{cart.length===0?<div className="manual-cart-empty"><ShoppingBag size={30}/><p>Agrega productos para comenzar.</p></div>:cart.map(row=><div className="manual-cart-row" key={row.key}><div><b>{row.label}</b><span>{row.detail}</span><strong>${money(row.unit*Number(row.payload.quantity||1))}</strong></div><div className="manual-cart-qty"><button onClick={()=>changeCartQty(row.key,-1)}><Minus size={13}/></button><b>{row.payload.quantity||1}</b><button onClick={()=>changeCartQty(row.key,1)}><Plus size={13}/></button></div></div>)}</div><div className="manual-cart-total"><span>Total</span><strong>${money(total)}</strong></div>{error&&<p className="manual-order-error">{error}</p>}<button className="manual-submit" disabled={busy||!cart.length} onClick={submit}>{busy?'Creando pedido…':<>Enviar a Preparando <Flame size={17}/></>}</button></aside>
     </div>
   </section>
 </div>
}

function KitchenLogin({error}){
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState(error||'')
 useEffect(()=>setMessage(error||''),[error])
 const login=async(e)=>{e.preventDefault();setBusy(true);setMessage('');const {error:loginError}=await supabase.auth.signInWithPassword({email,password});if(loginError)setMessage(loginError.message);setBusy(false)}
 return <div className="k-auth"><form className="k-auth-card" onSubmit={login}><img src="/logo.jpg" alt="Chi-nito"/><span className="eyebrow">ACCESO DE PERSONAL</span><h1>Kitchen Mode</h1><label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{message&&<p className="k-auth-error">{message}</p>}<button disabled={busy}>{busy?'Entrando…':'Entrar a cocina'}</button></form></div>
}
function SetupMissing(){return <div className="k-auth"><div className="k-auth-card"><img src="/logo.jpg" alt="Chi-nito"/><h1>Kitchen Mode</h1><p>Faltan <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> en Vercel.</p></div></div>}
