import { useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, Clock3, Flame, LayoutDashboard, PackageOpen, Plus, Search, Settings, ShoppingBag, ToggleLeft, ToggleRight, UtensilsCrossed } from 'lucide-react'

const seedOrders=[
{id:'#CN-1048',name:'Juan Pérez',time:'19:10',total:205,status:'Nuevo',items:'Chi-nito 3 + té + rollitos'},
{id:'#CN-1047',name:'Mariana López',time:'19:00',total:145,status:'Preparando',items:'Chi-nito 2 + refresco'},
{id:'#CN-1046',name:'Carlos Díaz',time:'18:50',total:95,status:'Listo',items:'Chi-nito 1'},
]
const seedMenu=[
{name:'Pollo a la naranja',type:'Guisado',price:0,active:true},{name:'Pollo agridulce',type:'Guisado',price:0,active:true},{name:'Res con brócoli',type:'Guisado',price:0,active:true},{name:'Cerdo BBQ',type:'Guisado',price:0,active:false},{name:'Arroz frito',type:'Base',price:0,active:true},{name:'Tallarín',type:'Base',price:0,active:true},{name:'Té helado',type:'Bebida',price:35,active:true},{name:'Rollito primavera',type:'Complemento',price:35,active:true},
]

export default function App(){
 const [section,setSection]=useState('Resumen'); const [orders,setOrders]=useState(seedOrders); const [menu,setMenu]=useState(seedMenu); const [q,setQ]=useState('')
 const active=useMemo(()=>menu.filter(x=>x.active).length,[menu])
 const nav=[['Resumen',LayoutDashboard],['Pedidos',ShoppingBag],['Menú',UtensilsCrossed],['Disponibilidad',Flame],['Configuración',Settings]]
 return <div className="admin-shell">
  <aside><div className="logo-wrap"><img src="/logo.jpg"/><div><b>CHI-NITO</b><span>Panel</span></div></div><nav>{nav.map(([n,I])=><button key={n} onClick={()=>setSection(n)} className={section===n?'active':''}><I size={19}/>{n}</button>)}</nav><div className="aside-foot"><span>Sucursal</span><b>Chi-nito Centro</b><small>Solo pickup</small></div></aside>
  <main><header><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>{section}</h1></div><div className="live"><i/> Operación activa</div></header>
   {section==='Resumen'&&<Dashboard orders={orders} active={active} setSection={setSection}/>} 
   {section==='Pedidos'&&<Orders orders={orders} setOrders={setOrders}/>} 
   {section==='Menú'&&<Menu menu={menu} setMenu={setMenu} q={q} setQ={setQ}/>} 
   {section==='Disponibilidad'&&<Availability menu={menu} setMenu={setMenu}/>} 
   {section==='Configuración'&&<SettingsPage/>}
  </main>
 </div>
}

function Dashboard({orders,active,setSection}){return <>
 <section className="stats"><Stat icon={ShoppingBag} label="Pedidos hoy" value="38" note="+12% vs ayer"/><Stat icon={BarChart3} label="Venta del día" value="$5,480" note="Ticket prom. $144"/><Stat icon={Clock3} label="Tiempo promedio" value="22 min" note="Pickup"/><Stat icon={PackageOpen} label="Productos activos" value={active} note="Disponibles ahora"/></section>
 <div className="two-col"><section className="card"><div className="card-head"><div><span className="eyebrow">EN TIEMPO REAL</span><h2>Pedidos recientes</h2></div><button onClick={()=>setSection('Pedidos')}>Ver todos</button></div>{orders.map(o=><OrderRow key={o.id} o={o}/>)}</section>
 <section className="card accent"><span className="eyebrow">OPERACIÓN</span><h2>Todo listo para recibir pedidos</h2><p>El canal de pickup está activo y el Kitchen Mode puede recibir órdenes.</p><div className="mini-status"><CheckCircle2/><div><b>Tienda abierta</b><span>11:00 a.m. – 9:00 p.m.</span></div></div><div className="mini-status"><Flame/><div><b>Cocina conectada</b><span>Última actividad hace 1 min</span></div></div></section></div>
 </>}
function Stat({icon:I,label,value,note}){return <div className="stat"><i><I/></i><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function OrderRow({o}){return <div className="order-row"><div><b>{o.id}</b><span>{o.name}</span></div><p>{o.items}</p><span>{o.time}</span><strong>${o.total}</strong><em className={`status ${o.status.toLowerCase()}`}>{o.status}</em></div>}

function Orders({orders,setOrders}){const cycle=id=>setOrders(prev=>prev.map(o=>o.id===id?{...o,status:o.status==='Nuevo'?'Preparando':o.status==='Preparando'?'Listo':'Entregado'}:o)); return <section className="card"><div className="card-head"><div><span className="eyebrow">PICKUP</span><h2>Pedidos de hoy</h2></div></div><div className="table-head"><span>Pedido</span><span>Contenido</span><span>Hora</span><span>Total</span><span>Estado</span></div>{orders.map(o=><div className="order-row clickable" key={o.id} onClick={()=>cycle(o.id)}><div><b>{o.id}</b><span>{o.name}</span></div><p>{o.items}</p><span>{o.time}</span><strong>${o.total}</strong><em className={`status ${o.status.toLowerCase()}`}>{o.status}</em></div>)}<p className="hint">Haz clic en un pedido para avanzar su estado.</p></section>}

function Menu({menu,setMenu,q,setQ}){const visible=menu.filter(m=>m.name.toLowerCase().includes(q.toLowerCase())); const toggle=i=>setMenu(prev=>prev.map((m,idx)=>idx===i?{...m,active:!m.active}:m)); return <section className="card"><div className="card-head"><div><span className="eyebrow">CATÁLOGO</span><h2>Menú</h2></div><button className="primary"><Plus size={17}/> Agregar</button></div><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar producto..."/></div><div className="menu-grid">{visible.map((m)=>{const idx=menu.indexOf(m); return <article className="menu-card" key={m.name}><div className="food-icon">{m.type==='Bebida'?'🥤':m.type==='Base'?'🍚':m.type==='Complemento'?'🥟':'🥡'}</div><div><small>{m.type}</small><h3>{m.name}</h3>{m.price>0&&<strong>${m.price}</strong>}</div><button onClick={()=>toggle(idx)} className={m.active?'on':''}>{m.active?<ToggleRight/>:<ToggleLeft/>}</button></article>})}</div></section>}

function Availability({menu,setMenu}){const toggle=i=>setMenu(prev=>prev.map((m,idx)=>idx===i?{...m,active:!m.active}:m)); return <section className="card"><div className="card-head"><div><span className="eyebrow">CONTROL RÁPIDO</span><h2>Disponibilidad</h2></div></div><p className="lead">Activa o agota productos al instante. El cambio se reflejará en la app del cliente.</p><div className="availability">{menu.map((m,i)=><button key={m.name} onClick={()=>toggle(i)} className={m.active?'available':'sold'}><span>{m.active?'●':'○'}</span><div><b>{m.name}</b><small>{m.type}</small></div><em>{m.active?'Disponible':'Agotado'}</em></button>)}</div></section>}
function SettingsPage(){return <div className="two-col"><section className="card"><span className="eyebrow">SUCURSAL</span><h2>Datos generales</h2><label>Nombre<input defaultValue="Chi-nito Centro"/></label><label>Modalidad<input defaultValue="Solo pickup" disabled/></label><label>Horario<input defaultValue="11:00 a.m. - 9:00 p.m."/></label><button className="primary">Guardar cambios</button></section><section className="card"><span className="eyebrow">PAGOS</span><h2>Métodos habilitados</h2><div className="setting-row"><div><b>Pago en línea</b><span>Stripe</span></div><ToggleRight/></div><div className="setting-row"><div><b>Pago al recoger</b><span>Efectivo o terminal</span></div><ToggleRight/></div></section></div>}
