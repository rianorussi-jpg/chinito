import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, Clock3, Flame, LayoutDashboard, LogOut, PackageOpen, Search, Settings, ShoppingBag, ToggleLeft, ToggleRight, UtensilsCrossed, Plus, Pencil, X, ImagePlus } from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'

const orderSelect='id,order_number,customer_name,customer_phone,pickup_label,payment_method,payment_status,total,status,created_at,order_items(id,item_type,name,quantity,unit_price,base_name,guisados,extras,variant)'

const itemSummary=(o)=>(o.order_items||[]).map(i=>`${i.quantity>1?`${i.quantity}× `:''}${i.name}`).join(' + ') || 'Sin productos'
const pickupShort=(label='')=>label.replace('Hoy, ','').replace('Lo antes posible · ','ASAP · ')
const money=(n)=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0})

export default function App(){
 const [section,setSection]=useState('Resumen')
 const [orders,setOrders]=useState([])
 const [menu,setMenu]=useState([])
 const [settings,setSettings]=useState(null)
 const [q,setQ]=useState('')
 const [session,setSession]=useState(null)
 const [authReady,setAuthReady]=useState(false)
 const [authError,setAuthError]=useState('')
 const [loading,setLoading]=useState(true)

 const validateSession=useCallback(async(nextSession)=>{
   if(!nextSession || !supabase){ setSession(null); setAuthReady(true); return }
   const {data,error}=await supabase.from('staff_users').select('role,active').eq('user_id',nextSession.user.id).maybeSingle()
   if(error || !data?.active || data.role!=='admin'){
     setAuthError('Esta cuenta no tiene acceso de administrador.')
     await supabase.auth.signOut()
     setSession(null)
   } else {
     setAuthError('')
     setSession(nextSession)
   }
   setAuthReady(true)
 },[])

 useEffect(()=>{
   if(!supabaseConfigured){ setAuthReady(true); return }
   supabase.auth.getSession().then(({data})=>validateSession(data.session))
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>validateSession(next),0)})
   return ()=>subscription.unsubscribe()
 },[validateSession])

 const loadData=useCallback(async()=>{
   if(!supabase || !session) return
   setLoading(true)
   const start=new Date(); start.setHours(0,0,0,0)
   const [ordersRes,menuRes,settingsRes]=await Promise.all([
     supabase.from('orders').select(orderSelect).gte('created_at',start.toISOString()).order('created_at',{ascending:false}),
     supabase.from('menu_items').select('*').order('sort_order',{ascending:true}),
     supabase.from('store_settings').select('*').eq('id',1).maybeSingle(),
   ])
   if(ordersRes.data) setOrders(ordersRes.data)
   if(menuRes.data) setMenu(menuRes.data)
   if(settingsRes.data) setSettings(settingsRes.data)
   setLoading(false)
 },[session])

 useEffect(()=>{loadData()},[loadData])
 useEffect(()=>{
   if(!supabase || !session) return
   const channel=supabase.channel('panel-live')
     .on('postgres_changes',{event:'*',schema:'public',table:'orders'},loadData)
     .on('postgres_changes',{event:'*',schema:'public',table:'order_items'},loadData)
     .on('postgres_changes',{event:'*',schema:'public',table:'menu_items'},loadData)
     .on('postgres_changes',{event:'*',schema:'public',table:'store_settings'},loadData)
     .subscribe()
   return ()=>{supabase.removeChannel(channel)}
 },[session,loadData])

 const active=useMemo(()=>menu.filter(x=>x.active).length,[menu])
 const nav=[['Resumen',LayoutDashboard],['Pedidos',ShoppingBag],['Menú',UtensilsCrossed],['Disponibilidad',Flame],['Configuración',Settings]]

 if(!supabaseConfigured) return <SetupMissing app="Panel" />
 if(!authReady) return <div className="auth-screen"><div className="auth-card"><p>Conectando con Supabase…</p></div></div>
 if(!session) return <StaffLogin title="Panel de administración" error={authError} />

 return <div className="admin-shell">
  <aside><div className="logo-wrap"><img src="/logo.jpg" alt="Chi-nito"/><div><b>CHI-NITO</b><span>Panel</span></div></div><nav>{nav.map(([n,I])=><button key={n} onClick={()=>setSection(n)} className={section===n?'active':''}><I size={19}/>{n}</button>)}</nav><div className="aside-foot"><span>Sucursal</span><b>{settings?.store_name||'Chi-nito Centro'}</b><small>Solo pickup</small><button className="logout-btn" onClick={()=>supabase.auth.signOut()}><LogOut size={15}/> Cerrar sesión</button></div></aside>
  <main><header><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>{section}</h1></div><div className="live"><i/> {loading?'Actualizando…':'Supabase conectado'}</div></header>
   {section==='Resumen'&&<Dashboard orders={orders} active={active} settings={settings} setSection={setSection}/>} 
   {section==='Pedidos'&&<Orders orders={orders} onAdvance={advanceOrder}/>} 
   {section==='Menú'&&<Menu menu={menu} q={q} setQ={setQ} onToggle={toggleMenu} onSaved={loadData}/>} 
   {section==='Disponibilidad'&&<Availability menu={menu} onToggle={toggleMenu}/>} 
   {section==='Configuración'&&<SettingsPage settings={settings} setSettings={setSettings}/>} 
  </main>
 </div>

 async function advanceOrder(order){
   const next=order.status==='Nuevo'?'Preparando':order.status==='Preparando'?'Listo':order.status==='Listo'?'Entregado':order.status
   if(next===order.status) return
   const {error}=await supabase.from('orders').update({status:next}).eq('id',order.id)
   if(!error) setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:next}:o))
 }
 async function toggleMenu(item){
   const next=!item.active
   const {error}=await supabase.from('menu_items').update({active:next}).eq('id',item.id)
   if(!error) setMenu(prev=>prev.map(m=>m.id===item.id?{...m,active:next}:m))
 }
}

function Dashboard({orders,active,settings,setSection}){
 const sales=orders.reduce((s,o)=>s+Number(o.total||0),0)
 const avg=orders.length?sales/orders.length:0
 const pending=orders.filter(o=>!['Entregado','Cancelado'].includes(o.status)).length
 return <>
 <section className="stats"><Stat icon={ShoppingBag} label="Pedidos hoy" value={orders.length} note={`${pending} activos`}/><Stat icon={BarChart3} label="Venta del día" value={money(sales)} note={`Ticket prom. ${money(avg)}`}/><Stat icon={Clock3} label="Pedidos pendientes" value={pending} note="Pickup"/><Stat icon={PackageOpen} label="Productos activos" value={active} note="Disponibles ahora"/></section>
 <div className="two-col"><section className="card"><div className="card-head"><div><span className="eyebrow">EN TIEMPO REAL</span><h2>Pedidos recientes</h2></div><button onClick={()=>setSection('Pedidos')}>Ver todos</button></div>{orders.slice(0,6).map(o=><OrderRow key={o.id} o={o}/>)}</section>
 <section className="card accent"><span className="eyebrow">OPERACIÓN</span><h2>{settings?.store_open?'Todo listo para recibir pedidos':'Tienda marcada como cerrada'}</h2><p>Cliente, Panel y Kitchen Mode comparten la misma operación en Supabase.</p><div className="mini-status"><CheckCircle2/><div><b>{settings?.store_open?'Tienda abierta':'Tienda cerrada'}</b><span>{settings?.opening_time||'11:00 a.m.'} – {settings?.closing_time||'9:00 p.m.'}</span></div></div><div className="mini-status"><Flame/><div><b>Cocina conectable</b><span>Pedidos sincronizados por Realtime</span></div></div></section></div>
 </>
}
function Stat({icon:I,label,value,note}){return <div className="stat"><i><I/></i><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function OrderRow({o}){return <div className="order-row"><div><b>{o.order_number}</b><span>{o.customer_name}</span></div><p>{itemSummary(o)}</p><span>{pickupShort(o.pickup_label)}</span><strong>{money(o.total)}</strong><em className={`status ${o.status.toLowerCase()}`}>{o.status}</em></div>}

function Orders({orders,onAdvance}){return <section className="card"><div className="card-head"><div><span className="eyebrow">PICKUP</span><h2>Pedidos de hoy</h2></div></div><div className="table-head"><span>Pedido</span><span>Contenido</span><span>Hora</span><span>Total</span><span>Estado</span></div>{orders.map(o=><div className="order-row clickable" key={o.id} onClick={()=>onAdvance(o)}><div><b>{o.order_number}</b><span>{o.customer_name}</span></div><p>{itemSummary(o)}</p><span>{pickupShort(o.pickup_label)}</span><strong>{money(o.total)}</strong><em className={`status ${o.status.toLowerCase()}`}>{o.status}</em></div>)}{!orders.length&&<p className="hint">Todavía no hay pedidos de hoy.</p>}<p className="hint">Haz clic en un pedido para avanzar su estado.</p></section>}

const DEFAULT_IMAGES={Base:'/img/product/arroz-frito.jpg',Guisado:'/img/product/orange-chicken.jpg',Bebida:'/img/product/refresco.jpg',Complemento:'/img/product/chinito-bites.jpg',Extra:'/img/product/arroz-frito.jpg'}
const EDIT_CATEGORIES=['Base','Guisado','Bebida','Complemento','Extra']
const editableDefaults=(item=null)=>({
  name:item?.name||'',category:item?.category||'Base',price:String(item?.price??0),
  description:item?.description||'',weight:item?.metadata?.weight||(item?.category==='Extra'?'125 g':''),image:item?.image||'',active:item?.active??true,
  sort_order:String(item?.sort_order??0),
  sell_by_volume:item?.metadata?.sell_by_volume??(Number(item?.metadata?.half_price)>0&&Number(item?.metadata?.liter_price)>0),
  half_price:item?.metadata?.half_price == null?'':String(item.metadata.half_price),
  liter_price:item?.metadata?.liter_price == null?'':String(item.metadata.liter_price),
  max_guisados:item?.metadata?.max_guisados??({ 'chi-nito-1':1,'chi-nito-2':2,'chi-nito-3':3 }[item?.slug]||1),
})
const slugify=(text)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)

function Menu({menu,q,setQ,onToggle,onSaved}){
 const [editing,setEditing]=useState(undefined)
 const [categoryFilter,setCategoryFilter]=useState('Todas')
 const visible=menu.filter(m=>(categoryFilter==='Todas'||m.category===categoryFilter)&&`${m.name} ${m.description||''}`.toLowerCase().includes(q.toLowerCase()))
 return <section className="card menu-management">
   <div className="card-head menu-manager-head"><div><span className="eyebrow">CATÁLOGO SUPABASE</span><h2>Menú</h2><p className="hint">Edita nombres, precios, descripciones, imágenes, orden y disponibilidad.</p></div><button className="primary menu-new-btn" onClick={()=>setEditing(null)}><Plus size={16}/> Nuevo producto</button></div>
   <div className="menu-filterbar"><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar producto..."/></div><select aria-label="Filtrar categoría" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>{['Todas','Chi-nito',...EDIT_CATEGORIES].map(c=><option key={c}>{c}</option>)}</select></div>
   <div className="menu-grid">{visible.map(m=><article className="menu-card" key={m.id}>
     <div className="food-icon">{m.image?<img src={m.image} alt=""/>:'🥡'}</div>
     <div className="menu-card-copy"><small>{m.category}</small><h3>{m.name}</h3>{m.description&&<p title={m.description}>{m.description}</p>}{Number(m.price)>0&&<strong>{money(m.price)}</strong>}{m.category==='Guisado'&&m.metadata?.sell_by_volume!==false&&Number(m.metadata?.half_price)>0&&<small>½ L {money(m.metadata.half_price)} · 1 L {money(m.metadata.liter_price)}</small>}</div>
     <div className="menu-card-actions"><button className="edit-menu-btn" onClick={()=>setEditing(m)} aria-label={`Editar ${m.name}`} title="Editar"><Pencil size={17}/></button><button onClick={()=>onToggle(m)} title={m.active?'Agotar':'Activar'} aria-label={`${m.active?'Agotar':'Activar'} ${m.name}`} className={m.active?'on':''}>{m.active?<ToggleRight/>:<ToggleLeft/>}</button></div>
   </article>)}</div>
   {!visible.length&&<p className="hint">No hay productos con ese filtro.</p>}
   {editing!==undefined&&<MenuEditor key={editing?.id||'new'} item={editing} menu={menu} onClose={()=>setEditing(undefined)} onSaved={async()=>{setEditing(undefined);await onSaved()}}/>}
 </section>
}

function MenuEditor({item,menu,onClose,onSaved}){
 const [draft,setDraft]=useState(()=>editableDefaults(item))
 const [file,setFile]=useState(null)
 const [preview,setPreview]=useState(item?.image||'')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const isBowl=item?.category==='Chi-nito'
 const category=isBowl?'Chi-nito':draft.category
 const update=(field,value)=>setDraft(prev=>({...prev,[field]:value}))
 const onFile=(event)=>{
   const next=event.target.files?.[0]||null
   if(!next){setFile(null);setPreview(item?.image||'');return}
   if(!['image/jpeg','image/png','image/webp'].includes(next.type)||next.size>5*1024*1024){setError('Usa JPG, PNG o WebP de máximo 5 MB.');setFile(null);setPreview(item?.image||'');event.target.value='';return}
   setError('');setFile(next)
   const reader=new FileReader();reader.onload=()=>setPreview(String(reader.result||''));reader.readAsDataURL(next)
 }
 const save=async(event)=>{
   event.preventDefault();setError('')
   const name=draft.name.trim(),slug=item?.slug||slugify(name)
   if(!name||!slug){setError('Escribe un nombre válido.');return}
   const price=Number(draft.price)
   if(!Number.isFinite(price)||price<0){setError('El precio no es válido.');return}
   let half=0,liter=0
   if(category==='Guisado'&&draft.sell_by_volume){
     half=Number(draft.half_price);liter=Number(draft.liter_price)
     if(!Number.isFinite(half)||half<=0||!Number.isFinite(liter)||liter<=0){setError('Ingresa precios válidos para medio litro y litro.');return}
   }
   if(!item&&menu.some(m=>m.slug===slug)){setError('Ya existe un producto con ese nombre. Modifica su nombre o edita el existente.');return}
   setBusy(true)
   try{
     let image=item?.image||DEFAULT_IMAGES[category]||null
     if(file){
       const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'
       const imagePath=`${slug}/${crypto.randomUUID()}.${ext}`
       const uploaded=await supabase.storage.from('chinito-menu').upload(imagePath,file,{contentType:file.type,cacheControl:'3600',upsert:false})
       if(uploaded.error)throw uploaded.error
       image=supabase.storage.from('chinito-menu').getPublicUrl(imagePath).data.publicUrl
     }
     const meta={...(item?.metadata||{})}
     if(category==='Guisado'){
       meta.sell_by_volume=Boolean(draft.sell_by_volume)
       meta.half_price=draft.sell_by_volume?half:null
       meta.liter_price=draft.sell_by_volume?liter:null
     }
     if(category==='Chi-nito')meta.max_guisados=Number(draft.max_guisados)||1
     if(category==='Extra')meta.weight=draft.weight.trim()
     const payload={name,category,price,image,description:draft.description.trim()||null,active:Boolean(draft.active),sort_order:Number(draft.sort_order)||0,metadata:meta}
     const result=item?await supabase.from('menu_items').update(payload).eq('id',item.id).select('id').single():await supabase.from('menu_items').insert({...payload,slug}).select('id').single()
     if(result.error)throw result.error
     await onSaved()
   }catch(err){setError(err.message||'No se pudo guardar el producto.')}finally{setBusy(false)}
 }
 return <div className="menu-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
   <div className="menu-dialog" role="dialog" aria-modal="true" aria-label={item?`Editar ${item.name}`:'Agregar producto'}>
    <div className="menu-dialog-head"><div><span className="eyebrow">ADMINISTRACIÓN DE MENÚ</span><h2>{item?'Editar producto':'Nuevo producto'}</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar"><X size={20}/></button></div>
    <form onSubmit={save} className="menu-editor-form">
     <label>Nombre<input required maxLength={110} value={draft.name} onChange={e=>update('name',e.target.value)} placeholder="Nombre en el menú"/></label>
     <label>Categoría<select required disabled={isBowl} value={category} onChange={e=>update('category',e.target.value)}>{isBowl&&<option value="Chi-nito">Chi-nito</option>}{EDIT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
     <label className="menu-field-wide">Descripción<textarea rows={3} maxLength={600} value={draft.description} onChange={e=>update('description',e.target.value)} placeholder="Ingredientes, porciones y descripción del producto"/></label>
     {category==='Extra'&&<label>Porción o presentación<input maxLength={50} value={draft.weight} onChange={e=>update('weight',e.target.value)} placeholder="125 g"/></label>}
     {category==='Chi-nito'&&<label>Máximo de guisados<select value={draft.max_guisados} onChange={e=>update('max_guisados',Number(e.target.value))}>{[1,2,3].map(n=><option value={n} key={n}>{n}</option>)}</select></label>}
     {category!=='Guisado'&&<label>{category==='Base'?'Recargo por esta base (MXN)':'Precio (MXN)'}<input type="number" inputMode="decimal" min="0" step="0.01" required value={draft.price} onChange={e=>update('price',e.target.value)}/></label>}
     {category==='Guisado'&&<><label>Recargo por elegir este guisado en un Chi-nito (MXN)<input type="number" inputMode="decimal" min="0" step="0.01" value={draft.price} onChange={e=>update('price',e.target.value)}/></label>
       <label className="menu-field-wide menu-volume-toggle"><input type="checkbox" checked={Boolean(draft.sell_by_volume)} onChange={e=>update('sell_by_volume',e.target.checked)}/><span>¿Se vende también por ½ litro y 1 litro?</span></label>
       {draft.sell_by_volume&&<><label>Precio de ½ litro (MXN)<input type="number" required min="0.01" step="0.01" value={draft.half_price} onChange={e=>update('half_price',e.target.value)}/></label><label>Precio de 1 litro (MXN)<input type="number" required min="0.01" step="0.01" value={draft.liter_price} onChange={e=>update('liter_price',e.target.value)}/></label></>}
     </>}
     <label>Orden de aparición<input type="number" step="1" value={draft.sort_order} onChange={e=>update('sort_order',e.target.value)}/></label>
     <label className="menu-field-wide menu-volume-toggle"><input type="checkbox" checked={Boolean(draft.active)} onChange={e=>update('active',e.target.checked)}/><span>Producto disponible en la app</span></label>
     <div className="menu-field-wide menu-image-upload"><div className="menu-image-preview">{preview?<img src={preview} alt="Imagen del producto"/>:<ImagePlus size={32}/>}</div><div><b>Imagen del producto</b><p className="hint">Opcional. Si no subes otra, se conserva la imagen actual. JPG/PNG/WebP, máximo 5 MB.</p><input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile}/>{file&&<small>{file.name}</small>}</div></div>
     {error&&<p className="menu-editor-error menu-field-wide" role="alert">{error}</p>}
     <div className="menu-field-wide menu-editor-actions"><button type="button" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy?'Guardando…':item?'Guardar cambios':'Agregar producto'}</button></div>
    </form>
   </div>
 </div>
}

function Availability({menu,onToggle}){return <section className="card"><div className="card-head"><div><span className="eyebrow">CONTROL RÁPIDO</span><h2>Disponibilidad</h2></div></div><p className="lead">Activa o agota productos al instante. El cambio se refleja en la app del cliente.</p><div className="availability">{menu.map(m=><button key={m.id} onClick={()=>onToggle(m)} className={m.active?'available':'sold'}><span>{m.active?'●':'○'}</span><div><b>{m.name}</b><small>{m.category}</small></div><em>{m.active?'Disponible':'Agotado'}</em></button>)}</div></section>}

function SettingsPage({settings,setSettings}){
 const [draft,setDraft]=useState(settings||{store_name:'Chi-nito Centro',store_open:true,pickup_enabled:true,opening_time:'11:00 a.m.',closing_time:'9:00 p.m.'})
 useEffect(()=>{if(settings)setDraft(settings)},[settings])
 const save=async()=>{const {data,error}=await supabase.from('store_settings').update({store_name:draft.store_name,store_open:draft.store_open,pickup_enabled:draft.pickup_enabled,opening_time:draft.opening_time,closing_time:draft.closing_time}).eq('id',1).select().single(); if(!error)setSettings(data)}
 return <div className="two-col"><section className="card"><span className="eyebrow">SUCURSAL</span><h2>Datos generales</h2><label>Nombre<input value={draft.store_name||''} onChange={e=>setDraft({...draft,store_name:e.target.value})}/></label><label>Modalidad<input value="Solo pickup" disabled/></label><label>Horario de apertura<input value={draft.opening_time||''} onChange={e=>setDraft({...draft,opening_time:e.target.value})}/></label><label>Horario de cierre<input value={draft.closing_time||''} onChange={e=>setDraft({...draft,closing_time:e.target.value})}/></label><button className="primary" onClick={save}>Guardar cambios</button></section><section className="card"><span className="eyebrow">OPERACIÓN</span><h2>Estado de la tienda</h2><button className={`setting-toggle ${draft.store_open?'enabled':''}`} onClick={()=>setDraft({...draft,store_open:!draft.store_open})}><div><b>Tienda {draft.store_open?'abierta':'cerrada'}</b><span>Controla el estado operativo</span></div>{draft.store_open?<ToggleRight/>:<ToggleLeft/>}</button><button className={`setting-toggle ${draft.pickup_enabled?'enabled':''}`} onClick={()=>setDraft({...draft,pickup_enabled:!draft.pickup_enabled})}><div><b>Pickup {draft.pickup_enabled?'habilitado':'deshabilitado'}</b><span>Única modalidad de Chi-nito</span></div>{draft.pickup_enabled?<ToggleRight/>:<ToggleLeft/>}</button></section></div>
}

function StaffLogin({title,error}){
 const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(error||'')
 useEffect(()=>setMessage(error||''),[error])
 const login=async(e)=>{e.preventDefault();setBusy(true);setMessage('');const {error:loginError}=await supabase.auth.signInWithPassword({email,password});if(loginError)setMessage(loginError.message);setBusy(false)}
 return <div className="auth-screen"><form className="auth-card" onSubmit={login}><img src="/logo.jpg" alt="Chi-nito"/><span className="eyebrow">ACCESO DE PERSONAL</span><h1>{title}</h1><label>Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{message&&<p className="auth-error">{message}</p>}<button className="primary auth-submit" disabled={busy}>{busy?'Entrando…':'Iniciar sesión'}</button></form></div>
}
function SetupMissing({app}){return <div className="auth-screen"><div className="auth-card"><img src="/logo.jpg" alt="Chi-nito"/><h1>{app}</h1><p>Faltan <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> en Vercel.</p></div></div>}
