import { useMemo, useState } from 'react'
import { Check, ChefHat, Clock3, Flame, Printer, RotateCcw, ShoppingBag } from 'lucide-react'

const initial=[
 {id:'#CN-1048',time:'19:10',elapsed:3,status:'Nuevo',name:'Juan Pérez',items:[['Chi-nito 3','Arroz frito','Pollo agridulce · Res con brócoli · Cerdo BBQ'],['Rollito primavera','2 piezas',''],['Té helado','','']]},
 {id:'#CN-1047',time:'19:00',elapsed:12,status:'Preparando',name:'Mariana López',items:[['Chi-nito 2','Tallarín','Pollo a la naranja · Verduras mixtas'],['Refresco','','']]},
 {id:'#CN-1046',time:'18:50',elapsed:21,status:'Listo',name:'Carlos Díaz',items:[['Chi-nito 1','Arroz blanco','Res con brócoli']]},
]

export default function App(){
 const [orders,setOrders]=useState(initial); const [filter,setFilter]=useState('Todos')
 const visible=useMemo(()=>filter==='Todos'?orders:orders.filter(o=>o.status===filter),[filter,orders])
 const advance=id=>setOrders(prev=>prev.map(o=>o.id===id?{...o,status:o.status==='Nuevo'?'Preparando':o.status==='Preparando'?'Listo':'Entregado'}:o).filter(o=>o.status!=='Entregado'))
 const reset=()=>setOrders(initial)
 return <div className="kitchen"><header><div className="brand"><img src="/logo.jpg"/><div><span>KITCHEN MODE</span><b>CHI-NITO</b></div></div><div className="header-right"><div className="online"><i/> Cocina conectada</div><button onClick={reset}><RotateCcw size={17}/></button></div></header>
  <main><section className="k-head"><div><span className="eyebrow">PEDIDOS EN TIEMPO REAL</span><h1>Cola de cocina</h1></div><div className="counters"><Counter label="Nuevos" n={orders.filter(o=>o.status==='Nuevo').length}/><Counter label="Preparando" n={orders.filter(o=>o.status==='Preparando').length}/><Counter label="Listos" n={orders.filter(o=>o.status==='Listo').length}/></div></section>
  <div className="filters">{['Todos','Nuevo','Preparando','Listo'].map(x=><button onClick={()=>setFilter(x)} className={filter===x?'active':''} key={x}>{x}</button>)}</div>
  <section className="orders-grid">{visible.map(o=><Ticket key={o.id} order={o} advance={()=>advance(o.id)}/>)}</section>
  {visible.length===0&&<div className="empty"><ChefHat size={50}/><h2>No hay pedidos en esta vista</h2><p>Los nuevos pedidos aparecerán aquí automáticamente.</p></div>}
  </main>
 </div>
}
function Counter({label,n}){return <div><span>{label}</span><b>{n}</b></div>}
function Ticket({order,advance}){const next=order.status==='Nuevo'?'Aceptar pedido':order.status==='Preparando'?'Marcar como listo':'Entregar pedido'; return <article className={`ticket ${order.status.toLowerCase()}`}><div className="ticket-top"><div><span>{order.id}</span><b>{order.name}</b></div><em>{order.status}</em></div><div className="pickup"><ShoppingBag size={18}/><div><b>Pickup {order.time}</b><span>Hace {order.elapsed} min</span></div><Clock3 size={18}/></div><div className="items">{order.items.map((i,idx)=><div className="item" key={idx}><strong>{i[0]}</strong>{i[1]&&<span>BASE · {i[1]}</span>}{i[2]&&<p>{i[2]}</p>}</div>)}</div><div className="ticket-actions"><button className="print" onClick={()=>window.print()}><Printer size={18}/> Imprimir</button><button className="advance" onClick={advance}>{order.status==='Listo'?<Check size={18}/>:<Flame size={18}/>} {next}</button></div></article>}
