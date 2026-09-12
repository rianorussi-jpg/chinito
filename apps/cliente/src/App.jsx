import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, CreditCard, Minus, Plus, ShoppingBag, ShoppingCart, Trash2, UserRound } from 'lucide-react'

const BASES = [
  { id:'frito', name:'Arroz frito', emoji:'🥘' },
  { id:'chowmein', name:'Chow mein', emoji:'🍜' },
]
const GUISADOS = [
  { id:'naranja', name:'Pollo a la naranja', emoji:'🍗' },
  { id:'agridulce', name:'Pollo agridulce', emoji:'🥢' },
  { id:'brocoli', name:'Res con brócoli', emoji:'🥦' },
  { id:'bbq', name:'Cerdo BBQ', emoji:'🍖' },
  { id:'verduras', name:'Verduras mixtas', emoji:'🥬' },
  { id:'chopsuey', name:'Chop suey', emoji:'🥡' },
  { id:'teriyaki', name:'Pollo teriyaki', emoji:'🍱' },
  { id:'kungpao', name:'Pollo kung pao', emoji:'🌶️' },
  { id:'mongol', name:'Res mongoliana', emoji:'🥩' },
]
const PRODUCTOS = [
  { id:1, name:'Chi-nito 1', baseCount:1, guisados:1, price:95, desc:'Ideal para un antojo rápido.' },
  { id:2, name:'Chi-nito 2', baseCount:1, guisados:2, price:115, desc:'El balance perfecto para comer bien.' },
  { id:3, name:'Chi-nito 3', baseCount:1, guisados:3, price:135, desc:'El máximo de sabor en un solo bowl.' },
]
const EXTRAS = [
  { id:'te', type:'Bebidas', name:'Té helado', price:35, emoji:'🥤' },
  { id:'refresco', type:'Bebidas', name:'Refresco', price:30, emoji:'🥤' },
  { id:'agua', type:'Bebidas', name:'Agua', price:25, emoji:'💧' },
  { id:'rollitos', type:'Complementos', name:'Rollito primavera', price:35, emoji:'🥟' },
  { id:'wanton', type:'Complementos', name:'Wantán crujiente', price:45, emoji:'🥠' },
  { id:'salsa', type:'Salsas', name:'Salsa extra', price:12, emoji:'🌶️' },
]

function App(){
  const [screen,setScreen]=useState('home')
  const [product,setProduct]=useState(PRODUCTOS[2])
  const [base,setBase]=useState(BASES[0])
  const [guisados,setGuisados]=useState([GUISADOS[1],GUISADOS[2],GUISADOS[3]])
  const [tab,setTab]=useState('Bebidas')
  const [extras,setExtras]=useState([])
  const [name,setName]=useState('')
  const [phone,setPhone]=useState('')
  const [pickup,setPickup]=useState('Lo antes posible · 20–30 min')
  const [payment,setPayment]=useState('online')
  const [placed,setPlaced]=useState(false)

  const addProduct=(p)=>{ setProduct(p); setBase(BASES[0]); setGuisados([]); setScreen('builder'); window.scrollTo(0,0) }
  const toggleGuisado=(g)=>{
    setGuisados(prev => prev.some(x=>x.id===g.id) ? prev.filter(x=>x.id!==g.id) : prev.length<product.guisados ? [...prev,g] : prev)
  }
  const toggleExtra=(e)=>setExtras(prev=>prev.some(x=>x.id===e.id)?prev.filter(x=>x.id!==e.id):[...prev,e])
  const total=useMemo(()=>product.price+extras.reduce((s,e)=>s+e.price,0),[product,extras])
  const ready=base && guisados.length===product.guisados

  if(placed) return <Success onReset={()=>{setPlaced(false);setScreen('home');setExtras([])}} />

  return <div className="app-shell">
    {screen!=='builder' && <header className="topbar">
      <button className="icon-btn profile-btn" onClick={()=>setScreen('profile')} aria-label="Ver perfil"><UserRound size={23}/></button>
      <div className="brand-mini" onClick={()=>setScreen('home')}><img src="/logo.jpg" alt="Chi-nito"/></div>
      <div className="topbar-spacer" aria-hidden="true" />
    </header>}

    {screen==='home' && <Home onPick={addProduct} />}
    {screen==='builder' && <Builder product={product} base={base} setBase={setBase} guisados={guisados} toggleGuisado={toggleGuisado} tab={tab} setTab={setTab} extras={extras} toggleExtra={toggleExtra} ready={ready} onBack={()=>setScreen('home')} onCart={()=>setScreen('cart')} />}
    {screen==='profile' && <Profile name={name} setName={setName} phone={phone} setPhone={setPhone} onBack={()=>setScreen('home')} />}
    {screen==='cart' && <Cart product={product} base={base} guisados={guisados} extras={extras} toggleExtra={toggleExtra} total={total} pickup={pickup} setPickup={setPickup} name={name} setName={setName} phone={phone} setPhone={setPhone} payment={payment} setPayment={setPayment} onBack={()=>setScreen('builder')} onPlace={()=>setPlaced(true)} />}
  </div>
}

function Profile({name,setName,phone,setPhone,onBack}){
  return <main className="page profile-page">
    <div className="page-title"><button className="back" onClick={onBack}><ArrowLeft/></button><div><span className="eyebrow">MI CUENTA</span><h2>Mi perfil</h2></div></div>
    <section className="profile-card">
      <div className="profile-avatar"><UserRound size={42}/></div>
      <div className="profile-heading"><h3>Tus datos</h3><p>Estos datos se usarán para identificar tus pedidos de pickup.</p></div>
      <label>Nombre completo<input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" /></label>
      <label>Teléfono<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Tu teléfono" inputMode="tel" /></label>
      <button className="primary profile-save" onClick={onBack}>Guardar datos</button>
    </section>
  </main>
}

function Home({onPick}){
  const goToMenu=()=>document.getElementById('menu-chinito')?.scrollIntoView({behavior:'smooth',block:'start'})
  return <main>
    <section className="home-hero-image" onClick={goToMenu} role="button" tabIndex={0} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' ') goToMenu()}} aria-label="Ver menú de Chi-nito">
      <img src="/img/inicio.jpg" alt="Arma tu Chi-nito - Solo pickup" />
    </section>


    <section className="section-wrap" id="menu-chinito">
      <div className="section-head"><div><h2>Nuestros Chi-nitos</h2></div><span className="muted">1 base + tus guisados favoritos</span></div>
      <div className="product-grid">{PRODUCTOS.map((p,i)=><article className="product-card" key={p.id}>
        <div className="product-visual">{['🥘','🍜','🥡'][i]}</div>
        <div className="badge">{p.guisados} guisado{p.guisados>1?'s':''}</div>
        <h3>{p.name}</h3><p>1 base + {p.guisados} guisado{p.guisados>1?'s':''}</p><small>{p.desc}</small>
        <div className="product-foot"><strong>Desde ${p.price}</strong><button onClick={()=>onPick(p)}>Elegir</button></div>
      </article>)}</div>
    </section>
  </main>
}

function Builder({product,base,setBase,guisados,toggleGuisado,tab,setTab,extras,toggleExtra,ready,onBack,onCart}){
  return <main className="page builder-page">
    <div className="builder-topline"><button className="builder-nav-btn" onClick={onBack} aria-label="Volver"><ArrowLeft size={22}/></button><h2>Personaliza tu Chi-nito</h2><button className="builder-nav-btn" onClick={onCart} aria-label="Ver pedido"><ShoppingCart size={22}/></button></div>
    <section className="summary-card"><div className="summary-food">🥘</div><div><h3>{product.name}</h3><p>1 base + {product.guisados} guisados</p><span>{product.desc}</span></div><strong>${product.price}</strong></section>

    <Step num="1" title="Elige tu base" subtitle="Selecciona una opción">
      <div className="choice-grid bases">{BASES.map(x=><button className={`choice ${base?.id===x.id?'selected':''}`} key={x.id} onClick={()=>setBase(x)}><span className="choice-emoji">{x.emoji}</span><b>{x.name}</b>{x.note&&<small>{x.note}</small>}{base?.id===x.id&&<i><Check size={14}/></i>}</button>)}</div>
    </Step>

    <Step num="2" title="Elige tus guisados" subtitle={`Selecciona ${product.guisados} guisado${product.guisados>1?'s':''}`} right={<b className="counter">{guisados.length}/{product.guisados}</b>}>
      <div className="choice-grid guisos">{GUISADOS.map(x=>{const selected=guisados.some(g=>g.id===x.id); return <button className={`choice ${selected?'selected':''}`} key={x.id} onClick={()=>toggleGuisado(x)}><span className="choice-emoji">{x.emoji}</span><b>{x.name}</b>{selected&&<i><Check size={14}/></i>}</button>})}</div>
    </Step>

    <Step title="Agrega más a tu orden" subtitle="Opcional">
      <div className="tabs">{['Bebidas','Complementos','Salsas'].map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?'active':''}>{t}</button>)}</div>
      <div className="extras-grid">{EXTRAS.filter(e=>e.type===tab).map(e=>{const selected=extras.some(x=>x.id===e.id); return <button className={`extra-card ${selected?'selected':''}`} key={e.id} onClick={()=>toggleExtra(e)}><span>{e.emoji}</span><div><b>{e.name}</b><strong>${e.price}</strong></div><i>{selected?<Check size={15}/>:<Plus size={15}/>}</i></button>})}</div>
    </Step>

    <div className="sticky-action"><div><small>Tu {product.name}</small><strong>${product.price+extras.reduce((s,e)=>s+e.price,0)}</strong></div><button className="primary" disabled={!ready} onClick={onCart}>Ver pedido <ChevronRight size={19}/></button></div>
  </main>
}

function Step({num,title,subtitle,right,children}){return <section className="step"><div className={`step-head ${!num?'optional-step-head':''}`}>{num&&<span className="step-num">{num}</span>}<div><h3>{title}</h3><p>{subtitle}</p></div>{right&&<div className="step-right">{right}</div>}</div>{children}</section>}

function Cart({product,base,guisados,extras,toggleExtra,total,pickup,setPickup,name,setName,phone,setPhone,payment,setPayment,onBack,onPlace}){
  return <main className="page cart-page">
    <div className="page-title"><button className="back" onClick={onBack}><ArrowLeft/></button><div><span className="eyebrow">CHECKOUT</span><h2>Tu pedido</h2></div></div>
    <div className="pickup-banner"><ShoppingBag/><div><b>Solo pickup</b><span>Tu orden se prepara en nuestro local.</span></div><strong>RÁPIDO<br/>FÁCIL<br/>SIN ESPERAS</strong></div>

    <section className="cart-list">
      <div className="cart-item main"><div className="item-emoji">🥘</div><div className="item-copy"><h3>{product.name}</h3><p><b>Base:</b> {base?.name}</p><p><b>Guisados:</b> {guisados.map(g=>g.name).join(', ')}</p><button onClick={onBack}>Editar</button></div><strong>${product.price}</strong></div>
      {extras.map(e=><div className="cart-item" key={e.id}><div className="item-emoji small">{e.emoji}</div><div className="item-copy"><h3>{e.name}</h3></div><strong>${e.price}</strong><button className="trash" onClick={()=>toggleExtra(e)}><Trash2 size={18}/></button></div>)}
    </section>

    <section className="checkout-card"><div className="field-head"><Clock3/><div><h3>Hora de pickup</h3><p>Selecciona tu hora</p></div></div><select value={pickup} onChange={e=>setPickup(e.target.value)}><option>Lo antes posible · 20–30 min</option><option>Hoy, 7:00 p.m.</option><option>Hoy, 7:30 p.m.</option><option>Hoy, 8:00 p.m.</option></select></section>

    <section className="checkout-card"><div className="field-head"><UserRound/><div><h3>Tus datos</h3><p>Para identificar tu pedido</p></div></div><div className="inputs"><input placeholder="Nombre completo" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Teléfono" value={phone} onChange={e=>setPhone(e.target.value)}/></div></section>

    <section className="checkout-card"><div className="field-head"><CreditCard/><div><h3>Método de pago</h3><p>Selecciona una opción</p></div></div><div className="pay-grid"><button className={payment==='online'?'selected':''} onClick={()=>setPayment('online')}><CreditCard/><div><b>Pagar en línea</b><span>Tarjeta de crédito o débito</span></div></button><button className={payment==='pickup'?'selected':''} onClick={()=>setPayment('pickup')}><ShoppingBag/><div><b>Pagar al recoger</b><span>Efectivo o tarjeta</span></div></button></div></section>

    <section className="total-box"><div><span>Total</span><strong>${total}</strong></div><button className="primary big" disabled={!name||!phone} onClick={onPlace}>Confirmar pedido <ChevronRight/></button></section>
  </main>
}

function Success({onReset}){return <div className="success-screen"><div className="success-mark"><Check size={42}/></div><span className="eyebrow">PEDIDO CONFIRMADO</span><h1>¡Tu Chi-nito ya se está preparando!</h1><p>Pedido <b>#CN-1048</b>. Te avisaremos cuando esté listo para recoger.</p><div className="success-card"><span>Tiempo estimado</span><strong>20–30 min</strong><small>Solo pickup</small></div><button className="primary big" onClick={onReset}>Volver al inicio</button></div>}

export default App
