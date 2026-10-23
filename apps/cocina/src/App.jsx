import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChefHat, Clock3, Eye, Flame, LogOut, Minus, Phone, Plus, Printer, RotateCcw, ShoppingBag, UserRound, X } from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'

const orderSelect='id,order_number,customer_name,customer_phone,pickup_label,payment_method,payment_status,total,status,cashback_used,first_order_discount,kitchen_acknowledged_at,created_at,order_items(id,item_type,name,quantity,unit_price,base_name,guisados,extras,variant)'
const activeStatuses=['Nuevo','Preparando','Listo']
const PICKUP_DAY_INDEX={domingo:0,lunes:1,martes:2,'miércoles':3,miercoles:3,jueves:4,viernes:5,'sábado':6,sabado:6}
const isScheduledPickup=(label='')=>/^(?:(?:Mañana|Domingo|Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado)\s*·\s*)?\d{2}:\d{2}$/i.test(String(label||'').trim())
const displayPickupLabel=(label='')=>String(label||'').replace(/Lo antes posible\s*·\s*20[–-]30 min/i,'Lo antes posible · 10–15 min')
const scheduledPickupAt=(order)=>{
  if(!isScheduledPickup(order?.pickup_label))return null
  const raw=String(order.pickup_label||'').trim()
  const prefixMatch=raw.match(/^([^·]+)\s*·\s*/i)
  const prefix=prefixMatch?.[1]?.trim().toLocaleLowerCase('es-MX')||''
  const time=prefixMatch?raw.slice(prefixMatch[0].length):raw
  const [hours,minutes]=time.split(':').map(Number)
  const scheduled=new Date(order.created_at)
  scheduled.setHours(hours,minutes,0,0)

  if(prefix==='mañana'){
    scheduled.setDate(scheduled.getDate()+1)
  }else if(prefix&&Object.prototype.hasOwnProperty.call(PICKUP_DAY_INDEX,prefix)){
    const target=PICKUP_DAY_INDEX[prefix]
    const current=scheduled.getDay()
    let daysAhead=(target-current+7)%7
    if(daysAhead===0&&scheduled.getTime()<=new Date(order.created_at).getTime())daysAhead=7
    scheduled.setDate(scheduled.getDate()+daysAhead)
  }
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


const RECEIPT_COLS=36
const thermalPlain=value=>String(value??'')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[“”]/g,'"')
  .replace(/[‘’]/g,"'")
  .replace(/·/g,'-')
  .replace(/…/g,'...')
  .replace(/[^\x20-\x7E\n]/g,'')
const escapeHtml=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]))
const thermalWrap=(value,width=RECEIPT_COLS)=>{
  const text=thermalPlain(value).replace(/\s+/g,' ').trim()
  if(!text)return []
  const words=text.split(' '),lines=[]
  let line=''
  for(const word of words){
    if(word.length>width){
      if(line){lines.push(line);line=''}
      for(let i=0;i<word.length;i+=width)lines.push(word.slice(i,i+width))
    }else if(!line)line=word
    else if(line.length+1+word.length<=width)line+=` ${word}`
    else{lines.push(line);line=word}
  }
  if(line)lines.push(line)
  return lines
}
const thermalCenter=value=>{
  const text=thermalPlain(value).trim().slice(0,RECEIPT_COLS)
  return `${' '.repeat(Math.max(0,Math.floor((RECEIPT_COLS-text.length)/2)))}${text}`
}
const thermalRule=(char='-')=>char.repeat(RECEIPT_COLS)
const thermalPair=(left,right)=>{
  const l=thermalPlain(left).trim(),r=thermalPlain(right).trim()
  if(!r)return thermalWrap(l)
  if(l.length+r.length+1<=RECEIPT_COLS)return [`${l}${' '.repeat(RECEIPT_COLS-l.length-r.length)}${r}`]
  return [...thermalWrap(l),...thermalWrap(r).map(x=>x.padStart(RECEIPT_COLS))]
}
const thermalMoney=value=>`$${Number(value||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const thermalDate=value=>new Date(value).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
const paymentLabel=order=>{
  const method=String(order?.payment_method||'').toLowerCase()
  if(['card','stripe','online','online_card'].includes(method))return 'Tarjeta en linea'
  if(['cash','efectivo'].includes(method))return 'Efectivo'
  if(['terminal','pos'].includes(method))return 'Terminal'
  if(method==='pickup')return 'Pago al recoger'
  return method?method:'No especificado'
}
const paymentStatusLabel=order=>order?.payment_status==='paid'?'PAGADO':'PENDIENTE'
const orderSubtotal=order=>Number(order?.total||0)+Number(order?.cashback_used||0)+Number(order?.first_order_discount||0)

function kitchenProductLines(order){
  const lines=[]
  for(const item of (order.order_items||[])){
    const qty=Math.max(1,Number(item.quantity||1))
    lines.push(...thermalWrap(`${qty}x ${item.name||'Producto'}`))
    if(item.base_name)lines.push(...thermalWrap(`  BASE: ${item.base_name}`))
    if(item.variant)lines.push(...thermalWrap(`  ${item.variant}`))
    if(Array.isArray(item.guisados)&&item.guisados.length){
      lines.push(...thermalWrap('  GUISADOS:'))
      item.guisados.forEach(g=>lines.push(...thermalWrap(`    - ${g}`)))
    }
    if(Array.isArray(item.extras)&&item.extras.length){
      lines.push(...thermalWrap('  EXTRAS:'))
      item.extras.forEach(extra=>{
        const extraQty=Math.max(1,Number(extra?.quantity||1))
        lines.push(...thermalWrap(`    - ${extraQty>1?`${extraQty}x `:''}${extra?.name||'Extra'}`))
      })
    }
    lines.push(thermalRule('-'))
  }
  return lines
}

function saleProductLines(order){
  const lines=[]
  for(const item of (order.order_items||[])){
    const qty=Math.max(1,Number(item.quantity||1))
    const unit=Number(item.unit_price||0)
    lines.push(...thermalPair(`${qty}x ${item.name||'Producto'}`,thermalMoney(unit*qty)))
    if(item.base_name)lines.push(...thermalWrap(`  Base: ${item.base_name}`))
    if(item.variant)lines.push(...thermalWrap(`  ${item.variant}`))
    if(Array.isArray(item.guisados)&&item.guisados.length)lines.push(...thermalWrap(`  Guisados: ${item.guisados.join(', ')}`))
    if(Array.isArray(item.extras)&&item.extras.length){
      const extras=item.extras.map(extra=>`${Number(extra?.quantity||1)>1?`${extra.quantity}x `:''}${extra?.name||'Extra'}`).join(', ')
      lines.push(...thermalWrap(`  Extras: ${extras}`))
    }
  }
  return lines
}

const thermalStyles=`
  @page{margin:2mm 3mm 5mm}
  html,body{margin:0!important;padding:0!important;background:#fff!important;color:#000!important}
  body{font-family:"Courier New",Courier,monospace!important}
  .receipt{box-sizing:border-box!important;width:70mm!important;max-width:70mm!important;margin:0!important;padding:0!important}
  .ticket-line{display:block!important;box-sizing:border-box!important;width:100%!important;min-height:3.3mm!important;margin:0!important;padding:0!important;white-space:pre-wrap!important;word-break:normal!important;overflow-wrap:break-word!important;font-family:"Courier New",Courier,monospace!important;font-size:8.2pt!important;line-height:1.25!important;font-weight:600!important;letter-spacing:0!important;color:#000!important;clear:both!important;break-inside:avoid!important}
  .ticket-line.blank{height:3.3mm!important;min-height:3.3mm!important}
  @media print{
    html,body{width:auto!important;max-width:none!important}
    .receipt{width:70mm!important;max-width:70mm!important}
    body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  }
`

function openThermalPrint(order,lines,title){
  const popup=window.open('','_blank','width=480,height=820')
  if(!popup){window.alert('Permite ventanas emergentes para imprimir el ticket.');return}
  const htmlLines=lines.map(line=>line.length?`<div class="ticket-line">${escapeHtml(line)}</div>`:'<div class="ticket-line blank">&nbsp;</div>').join('')
  popup.document.open()
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} ${escapeHtml(order.order_number||'')}</title><style>${thermalStyles}</style></head><body><main class="receipt">${htmlLines}</main><script>window.onload=()=>setTimeout(()=>{window.print();window.onafterprint=()=>window.close()},350)<\/script></body></html>`)
  popup.document.close()
}

function printKitchenTicket(order){
  const lines=[
    thermalCenter('CHI-NITO'),
    thermalCenter('TICKET COCINA'),
    thermalRule('='),
    ...thermalWrap(`PEDIDO: ${order.order_number||''}`),
    ...thermalWrap(`PICKUP: ${displayPickupLabel(order.pickup_label)||'Lo antes posible'}`),
    ...thermalWrap(`HORA PEDIDO: ${new Date(order.created_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`),
    thermalRule('='),
    ...kitchenProductLines(order),
    '', '', ''
  ]
  openThermalPrint(order,lines,'Ticket cocina')
}

function printSaleTicket(order){
  const lines=[
    thermalCenter('CHI-NITO'),
    thermalCenter('TICKET DE VENTA'),
    thermalRule('='),
    ...thermalWrap(`PEDIDO: ${order.order_number||''}`),
    ...thermalWrap(`FECHA: ${thermalDate(order.created_at)}`),
    ...thermalWrap(`CLIENTE: ${order.customer_name||'Mostrador'}`)
  ]
  if(order.customer_phone)lines.push(...thermalWrap(`TEL: ${order.customer_phone}`))
  lines.push(
    ...thermalWrap(`PICKUP: ${displayPickupLabel(order.pickup_label)||'Lo antes posible'}`),
    ...thermalWrap(`PAGO: ${paymentLabel(order)} - ${paymentStatusLabel(order)}`),
    thermalRule('='),
    ...saleProductLines(order),
    thermalRule('='),
    ...thermalPair('SUBTOTAL',thermalMoney(orderSubtotal(order)))
  )
  if(Number(order.first_order_discount||0)>0)lines.push(...thermalPair('REGALO PRIMER PEDIDO',`-${thermalMoney(order.first_order_discount)}`))
  if(Number(order.cashback_used||0)>0)lines.push(...thermalPair('CASHBACK',`-${thermalMoney(order.cashback_used)}`))
  lines.push(
    ...thermalPair('TOTAL',thermalMoney(order.total)),
    thermalRule('='),
    '',
    thermalCenter('GRACIAS POR SU COMPRA'),
    thermalCenter('ESTE TICKET NO ES COMPROBANTE FISCAL'),
    '', '', ''
  )
  openThermalPrint(order,lines,'Ticket de venta')
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
 const [detailOrder,setDetailOrder]=useState(null)
 const [clock,setClock]=useState(()=>Date.now())
 const [realtimeState,setRealtimeState]=useState(typeof navigator!=='undefined'&&!navigator.onLine?'offline':'connecting')
 const [lastSyncAt,setLastSyncAt]=useState(null)
 const [syncError,setSyncError]=useState('')
 const loadRequestRef=useRef(0)

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

 const loadOrders=useCallback(async({silent=false}={})=>{
   if(!supabase || !session)return false
   const requestId=++loadRequestRef.current
   if(!silent)setLoading(true)
   try{
     const {data,error}=await supabase.from('orders').select(orderSelect).in('status',activeStatuses).or('payment_method.eq.pickup,payment_status.eq.paid').order('created_at',{ascending:true})
     if(error)throw error
     if(requestId!==loadRequestRef.current)return false
     const nextOrders=data||[]
     setOrders(nextOrders)
     setDetailOrder(current=>current?nextOrders.find(o=>String(o.id)===String(current.id))||current:current)
     setLastSyncAt(new Date())
     setSyncError('')
     return true
   }catch(error){
     if(requestId===loadRequestRef.current){
       console.error('Kitchen orders load error',error)
       setSyncError('No se pudo actualizar la lista de pedidos. Se reintentará automáticamente.')
     }
     return false
   }finally{
     if(requestId===loadRequestRef.current&&!silent)setLoading(false)
   }
 },[session])

 const loadMenu=useCallback(async()=>{
   if(!supabase || !session)return
   const {data,error}=await supabase.from('menu_items').select('*').eq('active',true).order('sort_order',{ascending:true})
   if(!error&&data)setMenu(data)
 },[session])

 useEffect(()=>{
   const timer=window.setInterval(()=>setClock(Date.now()),1000)
   return ()=>window.clearInterval(timer)
 },[])

 useEffect(()=>{
   if(!supabase || !session)return
   let disposed=false
   let channel=null
   let reconnectTimer=null
   let channelAttempt=0

   setSyncError('')
   setRealtimeState(typeof navigator!=='undefined'&&!navigator.onLine?'offline':'connecting')

   const scheduleReconnect=()=>{
     if(disposed||typeof navigator!=='undefined'&&!navigator.onLine)return
     if(reconnectTimer)window.clearTimeout(reconnectTimer)
     reconnectTimer=window.setTimeout(()=>{
       if(disposed)return
       setRealtimeState('connecting')
       connectRealtime()
     },2500)
   }

   const connectRealtime=()=>{
     if(disposed||!supabase)return
     if(typeof navigator!=='undefined'&&!navigator.onLine){setRealtimeState('offline');return}
     if(channel){
       const oldChannel=channel
       channel=null
       supabase.removeChannel(oldChannel).catch(()=>{})
     }
     const nextChannel=supabase
       .channel(`chinito-kitchen-live-${++channelAttempt}`)
       .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>loadOrders({silent:true}))
       .on('postgres_changes',{event:'*',schema:'public',table:'order_items'},()=>loadOrders({silent:true}))
       .on('postgres_changes',{event:'*',schema:'public',table:'menu_items'},()=>loadMenu())
     channel=nextChannel
     nextChannel.subscribe(status=>{
       if(disposed||channel!==nextChannel)return
       if(status==='SUBSCRIBED'){
         if(reconnectTimer){window.clearTimeout(reconnectTimer);reconnectTimer=null}
         setRealtimeState('live')
         loadOrders({silent:true})
         return
       }
       if(['TIMED_OUT','CHANNEL_ERROR','CLOSED'].includes(status)){
         setRealtimeState(typeof navigator!=='undefined'&&!navigator.onLine?'offline':'degraded')
         scheduleReconnect()
       }
     })
   }

   const online=()=>{
     if(disposed)return
     setRealtimeState('connecting')
     loadOrders({silent:true})
     loadMenu()
     connectRealtime()
   }
   const offline=()=>{if(!disposed)setRealtimeState('offline')}
   const refreshWhenVisible=()=>{
     if(disposed)return
     if(document.visibilityState==='visible'&&(typeof navigator==='undefined'||navigator.onLine))loadOrders({silent:true})
   }
   const refreshOnFocus=()=>{
     if(disposed)return
     if(typeof navigator==='undefined'||navigator.onLine)loadOrders({silent:true})
   }

   connectRealtime()
   loadOrders()
   loadMenu()

   const safetyPoll=window.setInterval(()=>{
     if(disposed)return
     const visible=document.visibilityState==='visible'
     const onlineNow=typeof navigator==='undefined'||navigator.onLine
     if(visible&&onlineNow)loadOrders({silent:true})
   },10000)

   window.addEventListener('online',online)
   window.addEventListener('offline',offline)
   window.addEventListener('focus',refreshOnFocus)
   document.addEventListener('visibilitychange',refreshWhenVisible)

   return()=>{
     disposed=true
     loadRequestRef.current+=1
     window.clearInterval(safetyPoll)
     if(reconnectTimer)window.clearTimeout(reconnectTimer)
     window.removeEventListener('online',online)
     window.removeEventListener('offline',offline)
     window.removeEventListener('focus',refreshOnFocus)
     document.removeEventListener('visibilitychange',refreshWhenVisible)
     if(channel){
       const oldChannel=channel
       channel=null
       supabase.removeChannel(oldChannel).catch(()=>{})
     }
   }
 },[session,loadOrders,loadMenu])

 const scheduled=useMemo(()=>orders.filter(o=>isWaitingScheduledOrder(o,clock)).sort((a,b)=>scheduledPickupAt(a)-scheduledPickupAt(b)),[orders,clock])
 const scheduledIds=useMemo(()=>new Set(scheduled.map(o=>o.id)),[scheduled])
 const preparing=useMemo(()=>orders.filter(o=>(o.status==='Nuevo'||o.status==='Preparando')&&!scheduledIds.has(o.id)),[orders,scheduledIds])
 const ready=useMemo(()=>orders.filter(o=>o.status==='Listo'),[orders])

 const acknowledge=async(order)=>{
   if(!order?.id||order.kitchen_acknowledged_at)return true
   const acknowledgedAt=new Date().toISOString()
   const {error}=await supabase.from('orders').update({kitchen_acknowledged_at:acknowledgedAt}).eq('id',order.id)
   if(error){
     console.error('Kitchen acknowledge error',error)
     window.alert('No pudimos marcar el pedido como enterado. Revisa la conexión e intenta nuevamente.')
     return false
   }
   setOrders(prev=>prev.map(o=>o.id===order.id?{...o,kitchen_acknowledged_at:acknowledgedAt}:o))
   setDetailOrder(current=>current?.id===order.id?{...current,kitchen_acknowledged_at:acknowledgedAt}:current)
   return true
 }

 const advance=async(order)=>{
   if(order.status!=='Listo'&&!order.kitchen_acknowledged_at){
     window.alert('Primero toca “Enterado” para confirmar que Cocina ya vio este pedido.')
     return
   }
   const next=order.status==='Listo'?'Entregado':'Listo'
   const {error}=await supabase.from('orders').update({status:next}).eq('id',order.id)
   if(!error){
     if(next==='Entregado'){setOrders(prev=>prev.filter(o=>o.id!==order.id));setDetailOrder(null)}
     else{
       setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:next}:o))
       setDetailOrder(current=>current?.id===order.id?{...current,status:next}:current)
     }
   }
 }

 if(!supabaseConfigured)return <SetupMissing/>
 if(!authReady)return <div className="k-auth"><div className="k-auth-card">Conectando con Supabase…</div></div>
 if(!session)return <KitchenLogin error={authError}/>

 return <div className="kitchen">
  <header><div className="brand"><img src="/logo.jpg" alt="Chi-nito"/><div><span>KITCHEN MODE</span><b>CHI-NITO</b></div></div><div className="header-right"><div className="online" title={syncError||`Última sincronización: ${lastSyncAt?lastSyncAt.toLocaleTimeString('es-MX'):'pendiente'}`}><i style={{background:realtimeState==='live'?'#22c55e':realtimeState==='offline'?'#ef4444':'#f59e0b'}}/> {loading?'Actualizando…':realtimeState==='live'?'En tiempo real':realtimeState==='offline'?'Sin conexión':realtimeState==='degraded'?'Reconectando…':'Conectando…'}</div><div className="online"><Clock3 size={15}/> {new Date(clock).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div><button onClick={()=>loadOrders()} aria-label="Actualizar"><RotateCcw size={17}/></button><button onClick={()=>supabase.auth.signOut()} aria-label="Cerrar sesión"><LogOut size={17}/></button></div></header>
  <main>
    <section className="k-head"><div><span className="eyebrow">PEDIDOS EN TIEMPO REAL</span><h1>Kitchen Mode</h1><p>Prepara, libera y entrega pedidos desde una sola vista.</p></div><div className="k-head-actions"><div className="counters"><Counter label="Preparando" n={preparing.length}/><Counter label="Listos" n={ready.length}/></div><button className="scheduled-orders-button" onClick={()=>setScheduledOpen(true)}><Clock3 size={18}/> Pedidos programados <b>{scheduled.length}</b></button><button className="new-order-button" onClick={()=>setNewOrderOpen(true)}><Plus size={19}/> Nuevo pedido</button></div></section>

    <section className="k-board">
      <OrderLane title="Preparando" subtitle="Todos los pedidos activos en preparación" count={preparing.length} tone="prep">
        {preparing.length?preparing.map(o=><Ticket key={o.id} order={o} onAcknowledge={()=>acknowledge(o)} onDetails={()=>setDetailOrder(o)} onAdvance={()=>advance(o)}/>):<LaneEmpty icon={<Flame size={34}/>} title="Sin pedidos preparando" text="Los pedidos activos aparecerán aquí automáticamente, aunque sean de días anteriores."/>}
      </OrderLane>
      <OrderLane title="Listos para recoger" subtitle="Esperando al cliente" count={ready.length} tone="ready">
        {ready.length?ready.map(o=><Ticket key={o.id} order={o} onAcknowledge={()=>acknowledge(o)} onDetails={()=>setDetailOrder(o)} onAdvance={()=>advance(o)}/>):<LaneEmpty icon={<Check size={34}/>} title="Nada listo todavía" text="Cuando marques un pedido como listo aparecerá en esta columna."/>}
      </OrderLane>
    </section>
  </main>
  {detailOrder&&<OrderDetailsModal order={detailOrder} onClose={()=>setDetailOrder(null)} onAcknowledge={()=>acknowledge(detailOrder)} onAdvance={()=>advance(detailOrder)}/>}
  {scheduledOpen&&<ScheduledOrdersModal orders={scheduled} now={clock} onClose={()=>setScheduledOpen(false)}/>}
  {newOrderOpen&&<NewOrderModal menu={menu} onClose={()=>setNewOrderOpen(false)} onCreated={()=>{setNewOrderOpen(false);loadOrders()}}/>}
 </div>
}

function Counter({label,n}){return <div><span>{label}</span><b>{n}</b></div>}

function OrderLane({title,subtitle,count,tone,children}){
 return <section className={`order-lane ${tone}`}><div className="lane-head"><div><span>{title}</span><small>{subtitle}</small></div><b>{count}</b></div><div className="lane-list">{children}</div></section>
}

function LaneEmpty({icon,title,text}){return <div className="lane-empty">{icon}<h3>{title}</h3><p>{text}</p></div>}

function Ticket({order,onAcknowledge,onDetails,onAdvance}){
 const acknowledged=Boolean(order.kitchen_acknowledged_at)
 const isReady=order.status==='Listo'
 return <article className={`ticket compact-ticket ${order.status.toLowerCase()} ${acknowledged?'acknowledged':'unacknowledged'}`}>
   <div className="ticket-top compact-ticket-top"><div><span>{order.order_number}</span><b>{order.customer_name}</b></div></div>

   <div className="compact-ticket-actions">
     <button className={`acknowledge ${acknowledged?'done':''}`} disabled={acknowledged} onClick={onAcknowledge}><Check size={17}/> Enterado</button>
     <button className="details-button" onClick={onDetails}><Eye size={17}/> Ver detalles</button>
   </div>

   <div className="compact-ticket-print-actions">
     <button onClick={()=>printSaleTicket(order)}><Printer size={17}/> Ticket venta</button>
     <button onClick={()=>printKitchenTicket(order)}><Printer size={17}/> Ticket cocina</button>
   </div>

   <button className={`compact-ticket-advance ${isReady?'deliver':''}`} onClick={onAdvance}>
     {isReady?<Check size={18}/>:<Flame size={18}/>} {isReady?'Entregar pedido':'Marcar listo'}
   </button>
 </article>
}

function OrderDetailsModal({order,onClose,onAcknowledge,onAdvance}){
 const acknowledged=Boolean(order.kitchen_acknowledged_at)
 const subtotal=orderSubtotal(order)
 return <div className="order-detail-overlay" onMouseDown={onClose}>
   <section className="order-detail-modal" onMouseDown={e=>e.stopPropagation()}>
     <header><div><span>PEDIDO {order.order_number}</span><h2>{order.customer_name}</h2><p>{displayPickupLabel(order.pickup_label)} · {order.customer_phone||'Sin teléfono'}</p></div><button onClick={onClose} aria-label="Cerrar"><X size={21}/></button></header>
     <div className="order-detail-body">
       <div className="order-detail-meta"><div><span>Estado</span><b>{order.status}</b></div><div><span>Pago</span><b>{paymentLabel(order)} · {paymentStatusLabel(order)}</b></div><div><span>Recibido</span><b>{thermalDate(order.created_at)}</b></div></div>
       <section><h3>Productos</h3><div className="detail-items">{(order.order_items||[]).map(i=><KitchenItem item={i} key={i.id}/>)}</div></section>
       <section className="order-financial-detail"><h3>Desglose</h3><div><span>Subtotal</span><b>{thermalMoney(subtotal)}</b></div>{Number(order.first_order_discount||0)>0&&<div className="discount"><span>Regalo primer pedido</span><b>−{thermalMoney(order.first_order_discount)}</b></div>}{Number(order.cashback_used||0)>0&&<div className="discount"><span>Cashback</span><b>−{thermalMoney(order.cashback_used)}</b></div>}<div className="total"><span>Total</span><b>{thermalMoney(order.total)}</b></div></section>
     </div>
     <footer>
       {!acknowledged&&<button className="acknowledge-detail" onClick={onAcknowledge}><Check size={17}/> Enterado</button>}
       <button onClick={()=>printKitchenTicket(order)}><Printer size={17}/> Ticket cocina</button>
       <button onClick={()=>printSaleTicket(order)}><Printer size={17}/> Ticket de venta</button>
       <button className="advance-detail" onClick={onAdvance}>{order.status==='Listo'?<Check size={17}/>:<Flame size={17}/>} {order.status==='Listo'?'Entregar pedido':'Marcar como listo'}</button>
     </footer>
   </section>
 </div>
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
 const [pickup,setPickup]=useState('Lo antes posible · 10–15 min')
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
         <section className="manual-customer"><label><UserRound size={16}/><span>Nombre del cliente</span><input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Mostrador"/></label><label><Phone size={16}/><span>Teléfono</span><input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="Opcional"/></label><label className="wide"><Clock3 size={16}/><span>Pickup</span><select value={pickup} onChange={e=>setPickup(e.target.value)}><option>Lo antes posible · 10–15 min</option><option>En 15 minutos</option><option>En 30 minutos</option><option>En 45 minutos</option></select></label></section>

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
