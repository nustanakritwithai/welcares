import{useState,useEffect,useRef,createContext,useContext}from"react";
import{getJobs,assignJob,updateJob,addCheckpoint,addCheckpointWithData,updateVoiceData,addRating,getActiveJob,getRunningJobs,getJobCounts,JOB_UPDATED_EVENT}from'./lib/jobStore';
import{createRecorder,transcribeAudio,analyzeTranscript,scanPrescription,chatWithAI}from'./agents/voice/voicePipeline';
const getApiKey=()=>{try{return localStorage.getItem('welcares_api_key')||'';}catch{return'';}}
import{IntakeAgentDemo}from'./agents/intake/demo/IntakeAgentDemo';
import{IntakeChatDemo}from'./agents/intake-chat/demo/IntakeChatDemo';
import{ChatBookingAgentDemo}from'./agents/__demo__/ChatBookingAgentDemo';
import{AgentChat}from'./components/AgentChat';
const C={pri:'#7F77DD',suc:'#1D9E75',wrn:'#F59E0B',dan:'#E24B4A',drk:'#1E293B',nvy:'#1E3A8A',mid:'#64748B',bdr:'#E2E8F0',bg:'#F8FAFC',txt:'#1E293B',lin:'#06C755',tel:'#14B8A6',pur:'#8B5CF6',org:'#F97316'};
const Ctx=createContext(null);const useCtx=()=>useContext(Ctx);
const GMAPS_KEY=import.meta.env.VITE_GOOGLE_MAPS_API_KEY||'';
function calcP(base,km,grab,o=0.05,w=0.25){const d=Math.round(km*15),op=Math.round(base*o),wc=Math.round(base*w),g=grab?Math.round((base+d)*0.1):0;return{base,dist:d,ops:op,wc,grab:g,total:base+d+op+wc+g};}

function Crd({children,s={}}){return <div style={{background:'#fff',borderRadius:9,padding:'7px 10px',border:'1px solid '+C.bdr,marginBottom:5,flexShrink:0,...s}}>{children}</div>;}
function Btn({ch,col=C.pri,sm,out,s={},fn}){return <button onClick={fn} style={{background:out?'transparent':col,color:out?col:'#fff',border:out?`1.5px solid ${col}`:'none',borderRadius:7,padding:sm?'4px 8px':'8px 12px',fontWeight:700,fontSize:sm?10:11,cursor:'pointer',...s}}>{ch}</button>;}
function Tag({ch,col=C.pri}){return <span style={{background:col+'18',color:col,border:`1px solid ${col}28`,borderRadius:4,padding:'1px 5px',fontSize:9,fontWeight:700}}>{ch}</span>;}
function ST({ic,ch}){return <div style={{fontSize:11,fontWeight:700,color:'#334155',marginBottom:4,display:'flex',alignItems:'center',gap:3}}>{ic&&<span>{ic}</span>}{ch}</div>;}
function HR(){return <div style={{height:1,background:C.bdr,margin:'5px 0',flexShrink:0}}/>;}
function Alrt({ch,t='warning'}){const m={warning:['#FFFBEB','#F59E0B'],danger:['#FFF1F2','#EF4444'],info:['#EFF6FF','#3B82F6'],success:['#ECFDF5','#10B981']};const[bg,bd]=m[t]||m.warning;return <div style={{background:bg,border:`1px solid ${bd}40`,borderRadius:7,padding:'6px 8px',fontSize:10,color:C.txt,marginBottom:5,flexShrink:0}}>{ch}</div>;}
function BX({l,h=70,bg='#EFF6FF'}){return <div style={{background:bg,border:'1.5px dashed #93C5FD',borderRadius:7,height:h,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:5,flexShrink:0}}><span style={{color:'#60A5FA',fontSize:10,fontStyle:'italic'}}>{"📊 "+l}</span></div>;}
function InpBox({ph}){return <div style={{background:'#F8FAFC',border:'1px dashed #CBD5E1',borderRadius:7,padding:'6px 8px',fontSize:10,color:C.mid,marginBottom:4,flexShrink:0}}>{ph}</div>;}
function Photo({l,done}){return <div style={{background:done?'#ECFDF5':'#F8FAFC',border:`1.5px ${done?'solid #6EE7B7':'dashed #CBD5E1'}`,borderRadius:7,height:34,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:3,flexShrink:0,cursor:'pointer'}}><span style={{fontSize:10,color:done?'#059669':C.mid}}>{done?("✅ "+l):("📷 "+l)}</span></div>;}
function KPI({l,v,sub,col=C.pri}){return <div style={{background:C.bg,borderRadius:8,padding:'7px 9px',border:'1px solid '+C.bdr,flex:1,minWidth:70}}><div style={{fontSize:9,color:C.mid}}>{l}</div><div style={{fontSize:15,fontWeight:800,color:col,lineHeight:1.1}}>{v}</div>{sub&&<div style={{fontSize:9,color:'#94A3B8'}}>{sub}</div>}</div>;}
function AB({t,bg=C.pri,notif,onHam,right}){return <div style={{background:bg,padding:'8px 11px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}><div style={{display:'flex',alignItems:'center',gap:6}}>{onHam&&<button onClick={onHam} style={{background:'none',border:'none',color:'#fff',fontSize:15,cursor:'pointer',padding:0}}>{"☰"}</button>}<span style={{color:'#fff',fontWeight:700,fontSize:12}}>{t}</span></div><div style={{display:'flex',alignItems:'center',gap:6}}>{right}{notif&&<span style={{color:'#fff',fontSize:11}}>{"🔔"}</span>}</div></div>;}
function SOSBar(){return <div style={{background:'#FFF1F2',border:'1.5px solid #E24B4A',borderRadius:7,padding:'5px 9px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,cursor:'pointer',margin:'2px 9px 4px'}}><span style={{fontSize:10,fontWeight:700,color:'#A32D2D'}}>{"🆘 SOS ฉุกเฉิน"}</span><div style={{background:'#E24B4A',borderRadius:5,padding:'2px 8px',fontSize:9,color:'white',fontWeight:700}}>{"⟵ เลื่อน · โทร 1669"}</div></div>;}
function TogSw({on}){return <div style={{width:34,height:18,borderRadius:9,background:on?C.suc:'#CBD5E1',position:'relative',flexShrink:0}}><div style={{position:'absolute',top:2,left:on?14:2,width:14,height:14,borderRadius:'50%',background:'#fff'}}/></div>;}

function HamMenu({items,onClose}){
  return <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:100,display:'flex'}}>
    <div style={{width:'78%',background:'#fff',display:'flex',flexDirection:'column',boxShadow:'2px 0 12px rgba(0,0,0,0.15)'}}>
      <div style={{background:C.drk,padding:'10px 12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{color:'white',fontWeight:700,fontSize:12}}>{"☰ เมนู"}</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:'white',fontSize:16,cursor:'pointer'}}>{"✕"}</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
        {items.map((item,i)=>typeof item==='string'&&item==='---'
          ?<div key={i} style={{height:1,background:C.bdr,margin:'4px 0'}}/>
          :<div key={i} onClick={()=>{item.fn&&item.fn();onClose();}} style={{padding:'9px 14px',fontSize:11,color:C.txt,cursor:'pointer',borderBottom:'1px solid '+C.bdr,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:14}}>{item.ic}</span>
            <div><div style={{fontWeight:500}}>{item.label}</div>{item.sub&&<div style={{fontSize:9,color:C.mid}}>{item.sub}</div>}</div>
          </div>
        )}
      </div>
    </div>
    <div style={{flex:1,background:'rgba(0,0,0,0.35)'}} onClick={onClose}/>
  </div>;
}

// ── Voice utilities ──────────────────────────────────────────────
function useAudioLevel(recRef,recording){
  const[level,setLevel]=useState(0);
  useEffect(()=>{
    if(!recording||!recRef.current?.getLevel)return;
    let raf;
    const tick=()=>{setLevel(recRef.current?.getLevel()||0);raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(raf);setLevel(0);};
  },[recording]);
  return level;
}
function VoiceWave({recording,level=0}){
  if(!recording)return null;
  const base=[20,38,50,38,20];
  return <div style={{display:'flex',gap:3,alignItems:'center',height:50,justifyContent:'center',margin:'4px 0'}}>
    {base.map((b,i)=>{const h=Math.max(6,b*(0.3+level/100*0.7));return <div key={i} style={{width:5,height:h,background:C.dan,borderRadius:3,transition:'height 0.08s ease'}}/>;})}<span style={{fontSize:9,color:C.dan,fontWeight:700,marginLeft:6}}>{"กำลังฟัง…"}</span>
  </div>;
}

function PhoneShell({navItems,hamItems,sos=false,grandma=false,title}){
  const[navIdx,setNavIdx]=useState(0);const[subIdx,setSubIdx]=useState(0);const[ham,setHam]=useState(false);const[hamPage,setHamPage]=useState(null);
  const[bdg,setBdg]=useState([0,0,0,0,0]);
  useEffect(()=>{const load=()=>{try{const js=JSON.parse(localStorage.getItem('welcares_bookings')||'[]');const p=js.filter(j=>!j.status||j.status==='pending').length;const a=js.filter(j=>j.status==='assigned'||j.status==='active').length;setBdg([0,a,p,0,0]);}catch{}};load();window.addEventListener('welcares_jobs_updated',load);return()=>window.removeEventListener('welcares_jobs_updated',load);},[]);
  const selectNav=i=>{setNavIdx(i);setSubIdx(0);};
  const goTo=(i,j=0)=>{setNavIdx(i);setSubIdx(j);};
  const pages=navItems[navIdx]?.pages||[];const page=pages[subIdx]||pages[0];
  const hamFn=(hamItems||[]).map(item=>typeof item==='string'?item:item.hamPage?{...item,fn:()=>{setHam(false);setHamPage(item.hamPage);}}:item);
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      {title&&<div style={{fontSize:10,color:C.mid,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px'}}>{title}</div>}
      <div style={{width:300,background:'#fff',borderRadius:22,border:'4px solid '+C.drk,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,0.12)',position:'relative',display:'flex',flexDirection:'column'}}>
        <div style={{background:C.drk,height:12,display:'flex',justifyContent:'center',alignItems:'center',flexShrink:0}}><div style={{width:40,height:3,background:'#374151',borderRadius:2}}/></div>
        {ham&&<div style={{position:'absolute',top:12,left:0,right:0,bottom:0,zIndex:100}}><HamMenu items={hamFn} onClose={()=>setHam(false)}/></div>}
        {hamPage&&<div style={{position:'absolute',top:12,left:0,right:0,bottom:0,zIndex:99,background:'#fff',overflowY:'auto'}}>
          <div onClick={()=>setHamPage(null)} style={{background:C.pri,padding:'7px 11px',display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
            <span style={{color:'#fff',fontSize:14}}>{"←"}</span><span style={{color:'#fff',fontWeight:700,fontSize:12}}>{"กลับ"}</span>
          </div>{hamPage}
        </div>}
        <div style={{flex:1,overflowY:'auto',maxHeight:495,display:'flex',flexDirection:'column',minHeight:495}}>
          {pages.length>1&&<div style={{display:'flex',background:C.bg,borderBottom:'1px solid '+C.bdr,flexShrink:0,overflowX:'auto'}}>
            {pages.map((p,i)=><button key={i} onClick={()=>setSubIdx(i)} style={{flex:1,padding:'5px 2px',border:'none',borderBottom:`2px solid ${subIdx===i?C.pri:'transparent'}`,background:'none',fontSize:9,color:subIdx===i?C.pri:C.mid,cursor:'pointer',fontWeight:subIdx===i?700:400,whiteSpace:'nowrap',minWidth:45}}>{p.label}</button>)}
          </div>}
          {page&&page.content({openHam:()=>setHam(true),goTo})}
          {sos&&<SOSBar/>}
        </div>
        <div style={{borderTop:'1px solid '+C.bdr,display:'flex',background:'#fff',flexShrink:0}}>
          {navItems.map((item,i)=><button key={i} onClick={()=>selectNav(i)} style={{flex:1,padding:'5px 2px',border:'none',background:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
            <div style={{position:'relative',display:'inline-flex'}}>
              <span style={{fontSize:grandma?18:15}}>{item.icon}</span>
              {(bdg[i]||0)>0&&navIdx!==i&&<div style={{position:'absolute',top:-2,right:-3,width:7,height:7,borderRadius:'50%',background:C.dan,border:'1.5px solid #fff'}}/>}
            </div>
            <span style={{fontSize:grandma?8:7,color:navIdx===i?C.pri:C.mid,fontWeight:navIdx===i?700:400,lineHeight:1.1,textAlign:'center'}}>{item.label}</span>
            {navIdx===i&&<div style={{width:14,height:2,background:C.pri,borderRadius:1}}/>}
          </button>)}
        </div>
        <div style={{background:'#F1F5F9',height:8,flexShrink:0}}/>
      </div>
    </div>
  );
}

function LPhone({msgs}){
  return <div style={{width:260,background:'#E8F5E9',borderRadius:20,border:'4px solid '+C.drk,overflow:'hidden',boxShadow:'0 3px 12px rgba(0,0,0,0.1)'}}>
    <div style={{background:C.drk,height:11,display:'flex',justifyContent:'center',alignItems:'center'}}><div style={{width:36,height:3,background:'#374151',borderRadius:2}}/></div>
    <div style={{background:C.lin,padding:'6px 10px',display:'flex',alignItems:'center',gap:7}}>
      <div style={{width:22,height:22,background:'white',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>{"💚"}</div>
      <span style={{color:'white',fontWeight:700,fontSize:10}}>{"Welcares — น้องแคร์"}</span>
    </div>
    <div style={{padding:'8px 9px',background:'#E8F5E9',maxHeight:430,overflowY:'auto'}}>
      {msgs.map((m,i)=><div key={i} style={{marginBottom:9}}>
        {m.time&&<div style={{textAlign:'center',marginBottom:4}}><span style={{background:'rgba(0,0,0,0.08)',color:'#555',fontSize:8,padding:'1px 8px',borderRadius:8}}>{m.time}</span></div>}
        <div style={{display:'flex',gap:7}}>
          <div style={{width:26,height:26,background:C.lin,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{"💚"}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:8,color:'#555',marginBottom:1}}>{"น้องแคร์"}</div>
            <div style={{background:'white',borderRadius:'0 9px 9px 9px',padding:'7px 9px',fontSize:10,border:'1px solid '+C.bdr,lineHeight:1.65}}>
              {m.title&&<div style={{fontWeight:700,color:C.pri,marginBottom:2}}>{m.title}</div>}
              <div style={{whiteSpace:'pre-line',color:C.txt}}>{m.body}</div>
              {m.photo&&<img src={m.photo} style={{width:'100%',maxHeight:90,objectFit:'cover',borderRadius:6,marginTop:5,border:'1px solid '+C.bdr}}/>}
              {m.cta&&<div style={{marginTop:5}}><Btn ch={m.cta} col={C.lin} sm/></div>}
            </div>
          </div>
        </div>
      </div>)}
    </div>
    <div style={{background:'#F1F5F9',height:8}}/>
  </div>;
}

// ── DATA ──────────────────────────────────────────────────────────
const ROLES=['rujai','khabdi','dulaeh'];
const TIERS={
  RN:{col:C.pur,badge:'🏅 สูงสุด',cap:'ประเมินอาการ คุยหมอวิชาชีพ จด Rx แจ้ง Red Flags',suit:'โรคซับซ้อน หลายโรคพร้อมกัน'},
  PN:{col:C.suc,badge:'⭐ แนะนำ',cap:'คุยหมอได้ดี จดบันทึกละเอียด อธิบายคำแนะนำ',suit:'โรคประจำตัวทั่วไป ต้องการจดบันทึก'},
  CG:{col:C.mid,badge:'💰 ประหยัด',cap:'เป็นเพื่อน จดบันทึกทั่วไป ช่วยพาเดิน ให้กำลังใจ',suit:'นัดตรวจทั่วไป ต้องการเพื่อนไปด้วย'},
};
const PKG=[
  {id:'best',label:'🥇 Best',sub:'Full Medical Care',col:'#B45309',bg:'#FAEEDA',rujai:{tier:'RN',name:'คุณนุช',r:5.0,j:203,km:'5.2km',bid:1900},khabdi:{name:'คุณสมชาย',sub:'SUV รองรับวีลแชร์',bid:600},dulaeh:{name:'คุณอ้อ',sub:'PN ตรวจยา+อธิบาย',bid:350},reason:'ความดัน+วีลแชร์ → RN ประเมินอาการได้'},
  {id:'great',label:'🥈 Great',sub:'Professional Care',col:C.pri,bg:'#EEEDFE',badge:'✦ AI แนะนำ',rujai:{tier:'PN',name:'คุณทิพย์',r:4.9,j:127,km:'2.1km',bid:1680},khabdi:{name:'คุณสมชาย',sub:'Sedan ปลอดภัย',bid:500},dulaeh:{name:'คุณนิภา',sub:'CG รับยาตรวจครบ',bid:300},reason:'PN เชี่ยวชาญความดัน 127 ราย บ้านใกล้ 2.1km'},
  {id:'good',label:'🥉 Good',sub:'Basic Companion',col:'#0891B2',bg:'#F0FDFA',rujai:{tier:'CG',name:'คุณแนน',r:4.6,j:45,km:'1.2km',bid:900},khabdi:{name:'Grab',sub:'เรียก Grab เอง',bid:150},dulaeh:null,reason:'เหมาะนัดทั่วไป ไม่ต้องการรับยา ประหยัดสุด'},
];
const CANDS=[
  [{name:'คุณทิพย์',tier:'PN',r:4.9,j:127,bid:'฿1,680',ac:C.suc,km:'2.1km',hist:'เจอ 3 ครั้ง'},{name:'คุณนุช',tier:'RN',r:5.0,j:203,bid:'฿1,900',ac:C.pur,km:'5.2km',hist:'—'},{name:'คุณแนน',tier:'CG',r:4.6,j:45,bid:'฿900',ac:C.mid,km:'1.2km',hist:'—'}],
  [{name:'คุณสมชาย',tier:'Driver',r:4.8,j:89,bid:'฿500',ac:C.suc,km:'1.8km',hist:'เจอ 3 ครั้ง'},{name:'คุณวิชัย',tier:'Driver',r:4.6,j:54,bid:'฿450',ac:C.pri,km:'2.9km',hist:'—'}],
  [{name:'คุณนิภา',tier:'CG',r:4.7,j:64,bid:'฿300',ac:C.suc,km:'1.5km',hist:'—'},{name:'คุณอ้อ',tier:'PN',r:4.9,j:112,bid:'฿350',ac:C.pri,km:'3.1km',hist:'—'}],
];
const PREV_TEAM=[{ri:0,name:'คุณทิพย์',tier:'PN',r:4.9,bid:'฿1,680'},{ri:1,name:'คุณสมชาย',tier:'Driver',r:4.8,bid:'฿500'},{ri:2,name:'คุณนิภา',tier:'CG',r:4.7,bid:'฿300'}];
const AI_NEW=[{ri:0,name:'คุณนุช',tier:'RN',r:5.0,bid:'฿1,900',ac:C.pur},{ri:1,name:'คุณวิชัย',tier:'Driver',r:4.6,bid:'฿450',ac:C.pri},{ri:2,name:'คุณอ้อ',tier:'PN',r:4.9,bid:'฿350',ac:C.pri}];
const SV_DEFS=[
  {k:'rujai',ic:'🤝',title:'เพื่อนหาหมอ',desc:'นั่งเป็นเพื่อน จดบันทึก คุยกับหมอแทน',locked:true},
  {k:'khabdi',ic:'🚗',title:'รถรับ-ส่ง (Welcares)',desc:'รับถึงบ้าน รองรับวีลแชร์ มีประกัน'},
  {k:'dulaeh',ic:'💊',title:'รับยาแทน',desc:'รับยา ตรวจครบ ส่ง Grab ถึงบ้าน'},
];
// Transport options — FULL with descriptions
const TR_FULL=[
  {v:'khabdi',l:'🚐 Welcares',sub:'คนขับผ่าน BG Check ประกันครบ รองรับวีลแชร์',price:'฿400+',pros:'ปลอดภัยสูงสุด มีประกัน',col:C.suc},
  {v:'grab',l:'🚗 Grab',sub:'เรียก Grab ผ่าน welcares ติดตามได้',price:'฿120+',pros:'สะดวก ราคาถูกกว่า',col:C.pri},
  {v:'self',l:'👨‍👩‍👧 รับส่งเอง',sub:'ครอบครัวพาไปเอง',price:'ฟรี',pros:'ประหยัดสุด ครอบครัวดูแล',col:C.mid},
];
// P1 fields (appointment details)
const P1=[
  {k:'name',l:'ชื่อเรียกผู้สูงอายุ',ocr:'แม่มุก'},
  {k:'age',l:'อายุ',ocr:'72 ปี'},
  {k:'cond',l:'โรคประจำตัว'},
  {k:'spec',l:'หาหมอโรคอะไร'},
  {k:'date',l:'วันนัด',ocr:'พ 15 พ.ค.'},
  {k:'time',l:'เวลานัด',ocr:'09:00 น.'},
  {k:'hosp',l:'โรงพยาบาล',ocr:'รพ.จุฬาฯ'},
  {k:'prep',l:'เตรียมตัวล่วงหน้า',ocr:'งดน้ำ/อาหาร'},
  {k:'care',l:'การดูแลพิเศษ (วีลแชร์/ได้ยินยาก)'},
];
// P2: NO tr_go/tr_back — moved to Step 1
const P2=[
  {k:'likes',l:'สิ่งที่คุณยายชอบ'},
  {k:'dislikes',l:'สิ่งที่คุณยายไม่ชอบ'},
];
// P3: NO sv_khabdi — determined by transport Step 1
const P3=[
  {k:'sv_rujai',l:'🤝 เพื่อนหาหมอ',svk:'rujai',req:true},
  {k:'sv_dulaeh',l:'💊 รับยาแทน',svk:'dulaeh'},
];
const SAMPLES={cond:'ความดัน เบาหวาน',spec:'อายุรกรรม',care:'ใช้วีลแชร์',likes:'ขนมหวาน',dislikes:'กลัวแมว'};

// ── HELPERS ───────────────────────────────────────────────────────
function SumPill(){
  return <div style={{background:'#EEEDFE',borderRadius:8,padding:'6px 10px',marginBottom:8,display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
    {[['👵','แม่มุก 72ปี'],['📅','พ 15 พ.ค. 09:00'],['🏥','รพ.จุฬาฯ'],['📍','~8km']].map(([ic,txt],i)=>(
      <span key={i} style={{fontSize:9,color:'#534AB7',display:'flex',alignItems:'center',gap:2}}>{i>0&&<span style={{color:'#AFA9EC'}}>{"·"}</span>}{ic+" "+txt}</span>
    ))}
  </div>;
}

// Transport Summary (read-only display for team pages)
function TrSummary(){
  const{booking}=useCtx();
  const lbl=booking.transport_go==='khabdi'?'🚐 Welcares':booking.transport_go==='grab'?'🚗 Grab':'👨‍👩‍👧 รับส่งเอง';
  return <div style={{background:'#F8FAFC',borderRadius:7,padding:'5px 9px',fontSize:9,color:C.mid,marginTop:6}}>
    {"🚗 การเดินทาง: "}<span style={{fontWeight:700,color:C.txt}}>{lbl}</span>
    <span style={{fontSize:8,color:'#CBD5E1'}}>{" (เลือกแล้วในขั้นตอนก่อนหน้า)"}</span>
  </div>;
}

// Transport Full Picker — used in Step 1 and old booking Step 1
function TrPickerFull(){
  const{booking,setBooking}=useCtx();
  const set=v=>setBooking(b=>({...b,transport_go:v,transport_back:v,has_khabdi:v==='khabdi'}));
  return(
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {TR_FULL.map(o=>{
        const sel=booking.transport_go===o.v;
        return <div key={o.v} onClick={()=>set(o.v)} style={{padding:'8px 10px',borderRadius:9,border:`1.5px solid ${sel?o.col:C.bdr}`,background:sel?o.col+'12':'#fff',cursor:'pointer'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
            <span style={{fontSize:11,fontWeight:700,color:sel?o.col:C.txt}}>{o.l}</span>
            <span style={{fontSize:10,fontWeight:800,color:o.col}}>{o.price}</span>
          </div>
          <div style={{fontSize:8,color:C.mid,marginBottom:2}}>{o.sub}</div>
          <div style={{fontSize:8,color:sel?o.col:'#94A3B8'}}>{"✓ "+o.pros}</div>
        </div>;
      })}
    </div>
  );
}

function PriceBar({totl,label='ยืนยัน →',onFn}){
  return <div style={{background:'#1E3A8A',borderRadius:10,padding:'10px 12px',marginTop:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
    <div>
      <div style={{color:'rgba(255,255,255,0.5)',fontSize:9,marginBottom:1}}>{"ยอดรวม (รวม Ops+Welcares fees)"}</div>
      <div style={{color:'#93C5FD',fontSize:20,fontWeight:900,lineHeight:1}}>{"฿"+totl.toLocaleString()}</div>
    </div>
    <Btn ch={label} col={C.suc} fn={onFn} s={{padding:'10px 16px'}}/>
  </div>;
}

// Cancellation Policy block
function CancelPolicy(){
  return <Crd s={{background:'#FFFBEB',border:'1px solid #F59E0B',marginTop:6}}>
    <div style={{fontSize:9,fontWeight:700,color:'#92400E',marginBottom:4}}>{"📋 นโยบายการยกเลิก"}</div>
    {[['✅','ยกเลิกก่อน 3 วัน','ฟรี'],['💛','ยกเลิก 2 วันก่อน','หัก 25%'],['🟠','ยกเลิกภายใน 24 ชม.','หัก 50%'],['🔴','หลัง 24 ชม. / วันงาน','คิดเต็มราคา']].map(([ic,l,v],i)=>(
      <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'2px 0',borderBottom:i<3?'1px solid #FDE68A':'none'}}>
        <span style={{color:'#92400E'}}>{ic+" "+l}</span><span style={{fontWeight:700,color:'#B45309'}}>{v}</span>
      </div>
    ))}
  </Crd>;
}

// Income Graph for EOD
function IncomeGraph(){
  const data=[0,850,1200,0,1500,900,1680,1200,0,1800,900,0,1680,1500,1200,0,900,1680,1500,1200,0,1500,1680,900,1500,0,1200,1680,900,1500];
  const max=Math.max(...data.filter(v=>v>0));
  const total=data.reduce((a,b)=>a+b,0);
  return <div style={{marginBottom:8}}>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
      <span style={{fontSize:9,color:C.mid}}>{"รายได้เดือนนี้ (รายวัน)"}</span>
      <span style={{fontSize:11,fontWeight:800,color:C.suc}}>{"฿"+total.toLocaleString()}</span>
    </div>
    <div style={{display:'flex',alignItems:'flex-end',gap:1.5,height:52,background:'#F8FAFC',borderRadius:8,padding:'4px 6px 0'}}>
      {data.map((v,i)=><div key={i} style={{flex:1,height:`${v>0?(v/max)*88+12:5}%`,background:v>0?C.pri+'AA':'#E2E8F0',borderRadius:'2px 2px 0 0',minHeight:2}}/>)}
    </div>
    <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
      {['1','8','15','22','30'].map(n=><span key={n} style={{fontSize:7,color:C.mid}}>{n}</span>)}
    </div>
  </div>;
}

// ── ONBOARDING ────────────────────────────────────────────────────
function DVP({onDone}){
  const[s,ss]=useState(0);
  const slides=[{bg:'#EEEDFE',ic:'💛',h:'ลูกสาวยุ่ง แต่แม่ไปหาหมอได้',sub:'welcares ดูแลแทนคุณ ครบจบในแอปเดียว'},{bg:'#E1F5EE',ic:'🤝',h:'847 ครอบครัวไว้วางใจ',sub:'พยาบาลวิชาชีพ ตรวจประวัติแล้ว พาถึงบ้าน'},{bg:'#EFF6FF',ic:'💊',h:'ยาส่งถึงบ้าน แม่ไม่ต้องรอ',sub:'กลับบ้านทันทีหลังพบหมอ'}];
  const cur=slides[s];
  return <div style={{background:cur.bg,minHeight:495,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:16,gap:12,position:'relative'}}>
    <button onClick={onDone} style={{position:'absolute',top:8,right:12,background:'none',border:'none',fontSize:18,color:C.mid,cursor:'pointer'}}>{"✕"}</button>
    <div style={{fontSize:48}}>{cur.ic}</div>
    <div style={{fontSize:18,fontWeight:800,color:C.drk,textAlign:'center',lineHeight:1.3}}>{cur.h}</div>
    <div style={{fontSize:12,color:C.mid,textAlign:'center',lineHeight:1.6}}>{cur.sub}</div>
    <div style={{display:'flex',gap:6}}>{slides.map((_,i)=><div key={i} style={{width:7,height:7,borderRadius:'50%',background:i===s?C.pri:C.bdr}}/>)}</div>
    {s<slides.length-1?<Btn ch="ถัดไป →" col={C.pri} s={{width:'100%'}} fn={()=>ss(s+1)}/>:<Btn ch="เริ่มต้นใช้งาน ✅" col={C.suc} s={{width:'100%'}} fn={onDone}/>}
    <div style={{fontSize:10,color:C.mid}}>{"⭐ 4.8 · 2,341 รีวิว · ✅ Verified & Insured"}</div>
  </div>;
}

// ── NEW CUSTOMER HOME ─────────────────────────────────────────────
function DHomeNew({openHam}){
  return <div style={{background:C.bg}}>
    <AB t="🩵 welcares" onHam={openHam} notif bg={C.pri}/>
    <div style={{padding:'8px 10px 14px'}}>
      <Crd s={{background:'#EEEDFE',border:'1px solid #AFA9EC',textAlign:'center',padding:'12px'}}>
        <div style={{fontSize:22}}>{"💛"}</div>
        <div style={{fontSize:13,fontWeight:800,color:C.pri,marginTop:3}}>{"ยินดีต้อนรับสู่ welcares!"}</div>
        <div style={{fontSize:9,color:C.mid,marginTop:2}}>{"847 ครอบครัวไว้วางใจ · ⭐ 4.8"}</div>
      </Crd>
      <ST ic="📋" ch="วิธีใช้งาน 3 ขั้นตอน"/>
      <Crd s={{padding:'6px 10px'}}>
        {[{n:'1',ic:'💬',t:'บอกรายละเอียดนัด',d:'ถ่ายบัตรนัด หรือพิมพ์/พูดกับ AI'},{n:'2',ic:'🎯',t:'เลือกทีมดูแล',d:'AI แนะนำ 3 Package หรือเลือกเองได้'},{n:'3',ic:'✅',t:'ยืนยัน & ชำระเงิน',d:'จ่ายปลอดภัย ประกัน ฿100,000'}].map((s,i)=>(
          <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:i<2?'1px solid '+C.bdr:'none',alignItems:'flex-start'}}>
            <div style={{width:24,height:24,borderRadius:'50%',background:C.pri,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,flexShrink:0,marginTop:1}}>{s.n}</div>
            <div><div style={{fontSize:11,fontWeight:700,color:C.txt}}>{s.ic+" "+s.t}</div><div style={{fontSize:9,color:C.mid,lineHeight:1.5,marginTop:1}}>{s.d}</div></div>
          </div>
        ))}
      </Crd>
      <HR/>
      <ST ic="✨" ch="3 บริการที่เลือกได้"/>
      {SV_DEFS.map((sv,i)=><Crd key={i}><div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
        <div style={{width:34,height:34,borderRadius:9,background:'#EEEDFE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{sv.ic}</div>
        <div style={{flex:1}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontSize:11,fontWeight:700,color:C.pri}}>{sv.title}</span>{sv.locked&&<Tag ch="จำเป็น" col={C.suc}/>}</div><div style={{fontSize:9,color:C.mid}}>{sv.desc}</div></div>
      </div></Crd>)}
      <Btn ch="📅 จองบริการแรก →" col={C.suc} s={{width:'100%',padding:'12px',fontSize:12,marginTop:4}}/>
    </div>
  </div>;
}

// ── NEW BOOKING STEP 1: PIN MAP + TRANSPORT ───────────────────────
function DNStep1(){
  const[coords,setCoords]=useState({lat:13.7563,lng:100.5018});
  const[geoErr,setGeoErr]=useState('');
  const locateMe=()=>{
    if(!navigator.geolocation){setGeoErr('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');return;}
    navigator.geolocation.getCurrentPosition(
      p=>{setCoords({lat:p.coords.latitude,lng:p.coords.longitude});setGeoErr('');},
      ()=>setGeoErr('ไม่สามารถอ่านพิกัดได้ กรุณาอนุญาตตำแหน่ง'),
      {enableHighAccuracy:true,timeout:10000}
    );
  };
  const mapUrl=GMAPS_KEY?`https://www.google.com/maps/embed/v1/place?key=${GMAPS_KEY}&q=${coords.lat},${coords.lng}&zoom=15`:'';
  return <div style={{background:C.bg}}>
    <div style={{background:C.pri,padding:'7px 11px'}}><span style={{color:'#fff',fontWeight:700,fontSize:11}}>{"📍 Step 1: ปักหมุด + เลือกการเดินทาง"}</span></div>
    <div style={{padding:'8px 10px 12px'}}>
      <Alrt t="info" ch="AI คำนวณระยะทาง → ประเมินราคาค่าเดินทางอัตโนมัติ"/>
      {GMAPS_KEY
        ?<div style={{borderRadius:12,overflow:'hidden',border:'1px solid '+C.bdr,marginBottom:6}}>
          <iframe title="welcares-map" src={mapUrl} width="100%" height="150" style={{border:'none',display:'block'}} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
        </div>
        :<div style={{background:'#FFF1F2',border:'1px solid #FCA5A5',borderRadius:12,padding:'8px 10px',fontSize:9,color:'#991B1B',marginBottom:6}}>
          {"ยังไม่พบ Google Maps API Key กรุณาตั้งค่า VITE_GOOGLE_MAPS_API_KEY"}
        </div>}
      <div style={{display:'flex',gap:6,marginBottom:6}}>
        <Btn ch="📍 ใช้ตำแหน่งปัจจุบัน" col={C.pri} sm fn={locateMe} s={{flex:1}}/>
      </div>
      <Crd s={{background:'#ECFDF5',border:'1px solid #6EE7B7',marginBottom:6}}>
        <span style={{fontSize:9}}>{`📍 Lat ${coords.lat.toFixed(6)}, Lng ${coords.lng.toFixed(6)} · ~8km จากรพ.จุฬาฯ`}</span>
      </Crd>
      {geoErr&&<Alrt t="warning" ch={geoErr}/>}
      <HR/>
      <ST ic="🚗" ch="เลือกวิธีเดินทาง (ไป-กลับ)"/>
      <TrPickerFull/>
      <Btn ch="ถัดไป → ถ่ายรูปบัตรนัด" col={C.suc} s={{width:'100%',padding:'11px',fontSize:11,marginTop:10}}/>
    </div>
  </div>;
}

// ── NEW BOOKING STEP 2: OCR ───────────────────────────────────────
function DNStep2(){
  const[state,setState]=useState('idle');
  const doScan=()=>{setState('scanning');setTimeout(()=>setState('done'),1400);};
  const ocr=[['ชื่อผู้ป่วย','มุก วงศ์ทอง'],['HN','12345678'],['แผนก','อายุรกรรม'],['วันนัด','15 พ.ค. 2568'],['เวลา','09:00 น.'],['รพ.','รพ.จุฬาลงกรณ์'],['เตรียม','งดน้ำ/อาหาร 8 ชม.']];
  return <div style={{background:C.bg}}>
    <div style={{background:C.pri,padding:'7px 11px'}}><span style={{color:'#fff',fontWeight:700,fontSize:11}}>{"📷 Step 2: ถ่ายบัตรนัด"}</span></div>
    <div style={{padding:'8px 10px 12px'}}>
      <Alrt t="info" ch="AI อ่านบัตรนัดอัตโนมัติ — ประหยัดเวลากรอก"/>
      {state==='idle'&&<div onClick={doScan} style={{background:'#F8FAFC',border:'2px dashed #CBD5E1',borderRadius:12,height:100,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',marginBottom:8}}>
        <span style={{fontSize:28}}>{"📷"}</span><span style={{fontSize:10,color:C.mid,marginTop:3}}>{"กดถ่ายรูป / อัปโหลดบัตรนัด"}</span><span style={{fontSize:8,color:C.mid}}>{"รองรับ: ใบนัด, ภาพถ่าย, PDF"}</span>
      </div>}
      {state==='scanning'&&<div style={{background:'#EEEDFE',border:'1px solid #AFA9EC',borderRadius:12,height:80,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginBottom:8}}>
        <div style={{fontSize:22}}>{"🤖"}</div><div style={{fontSize:11,color:C.pri,fontWeight:700,marginTop:5}}>{"AI กำลังอ่านบัตรนัด..."}</div>
      </div>}
      {state==='done'&&<>
        <Alrt t="success" ch="✅ AI อ่านสำเร็จ! ดึงข้อมูลได้ 7 รายการ"/>
        <Crd s={{padding:'5px 9px',marginBottom:8}}>{ocr.map(([l,v],i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:i<ocr.length-1?'1px solid '+C.bdr:'none',fontSize:9}}><span style={{color:C.mid}}>{l}</span><span style={{fontWeight:700,color:C.suc}}>{"✅ "+v}</span></div>)}</Crd>
        <Btn ch="ถัดไป → กรอกข้อมูลเพิ่มเติม" col={C.suc} s={{width:'100%',padding:'11px',fontSize:11}}/>
      </>}
      {state==='idle'&&<div style={{textAlign:'center',marginTop:4}}><button onClick={()=>setState('done')} style={{background:'none',border:'none',color:C.mid,fontSize:9,cursor:'pointer',textDecoration:'underline'}}>{"ข้ามขั้นตอนนี้ → กรอกเอง"}</button></div>}
    </div>
  </div>;
}

// ── NEW BOOKING STEP 3: AI INFO (no transport, no sv_khabdi) ──────
function DNStep3(){
  const{booking,setBooking}=useCtx();
  const init={};
  P1.forEach(f=>{if(f.ocr)init[f.k]=f.ocr;});
  P3.forEach(f=>{if(f.req)init[f.k]='จำเป็น';});
  const[ans,setAns]=useState(init);
  const ALL=[...P1,...P2,...P3];
  const done=ALL.filter(f=>ans[f.k]).length;
  const next=ALL.find(f=>!ans[f.k]);
  const answer=(k,v)=>{
    setAns(a=>({...a,[k]:v}));
    if(k==='sv_dulaeh'&&v.includes('ต้องการ'))setBooking(b=>({...b,has_dulaeh:true}));
  };
  const SvDesc={dulaeh:'รับยาแทน ตรวจครบ ส่ง Grab ถึงบ้าน ไม่ต้องรอที่รพ.'};
  const FRow=({f})=>{
    const ok=!!ans[f.k];const sv=ok&&ans[f.k].length>15?ans[f.k].slice(0,15)+'…':ans[f.k];
    return <div onClick={()=>{if(!ok&&SAMPLES[f.k])answer(f.k,SAMPLES[f.k]);}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 7px',borderRadius:6,marginBottom:3,cursor:ok?'default':'pointer',background:ok?'#ECFDF5':'#FFF1F2',border:`1px solid ${ok?'#6EE7B7':'#FCA5A5'}`}}>
      <span style={{fontSize:9,color:ok?'#065F46':'#991B1B',fontWeight:600}}>{(ok?'✅ ':'🔴 ')+f.l+(f.ocr&&ok?' (AI)':'')}</span>
      <span style={{fontSize:9,fontWeight:700,color:ok?C.suc:C.dan}}>{ok?sv:'กดตอบ'}</span>
    </div>;
  };
  return <div style={{background:C.bg}}>
    <div style={{background:C.pri,padding:'7px 11px'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{color:'#fff',fontWeight:700,fontSize:10}}>{"💬 Step 3: ข้อมูลเพิ่มเติม"}</span><span style={{color:'rgba(255,255,255,0.85)',fontSize:10,fontWeight:700}}>{done+"/"+ALL.length}</span></div>
      <div style={{height:4,background:'rgba(255,255,255,0.3)',borderRadius:2}}><div style={{height:4,width:`${(done/ALL.length)*100}%`,background:'#fff',borderRadius:2}}/></div>
    </div>
    <div style={{padding:'8px 10px 12px'}}>
      {next&&<div style={{background:'#EEEDFE',border:'1px solid #AFA9EC',borderRadius:10,padding:'8px 10px',marginBottom:8}}>
        <div style={{fontSize:8,color:C.mid,marginBottom:2}}>{"🤖 น้องแคร์ถาม:"}</div>
        <div style={{fontSize:11,fontWeight:700,color:'#3C3489',marginBottom:6}}>{next.svk?("ต้องการบริการ "+next.l.replace(/[🤝🚗💊]/g,'').trim()+" ไหมคะ?"):(next.l+" คืออะไรคะ?")}</div>
        {next.svk&&<><div style={{fontSize:9,color:'#534AB7',marginBottom:4}}>{SvDesc[next.svk]||''}</div>
          <div style={{display:'flex',gap:4}}><div onClick={()=>answer(next.k,'ต้องการ')} style={{flex:1,padding:'6px',textAlign:'center',borderRadius:7,background:C.suc,cursor:'pointer'}}><span style={{fontSize:10,fontWeight:700,color:'#fff'}}>{"✅ ต้องการ"}</span></div><div onClick={()=>answer(next.k,'ไม่ต้องการ')} style={{flex:1,padding:'6px',textAlign:'center',borderRadius:7,background:'#F1F5F9',border:'1px solid '+C.bdr,cursor:'pointer'}}><span style={{fontSize:10,color:C.mid}}>{"❌ ไม่ต้องการ"}</span></div></div></>}
        {!next.svk&&<div style={{display:'flex',gap:6,alignItems:'center'}}><div style={{flex:1,background:'#F8FAFC',border:`1.5px solid ${C.pri}`,borderRadius:9,padding:'8px 10px',fontSize:10,color:C.mid}}>{"พิมพ์หรือพูดคำตอบ..."}</div><button style={{width:38,height:38,borderRadius:'50%',background:C.pri,border:'none',cursor:'pointer',fontSize:16,color:'#fff',flexShrink:0}}>{"🎙"}</button></div>}
      </div>}
      {!next&&<Alrt t="success" ch="✅ ข้อมูลครบแล้วค่ะ! ไปเลือกทีมดูแลได้เลย"/>}
      <HR/>
      <ST ic="1️⃣" ch="รายละเอียดบัตรนัด"/><Crd s={{padding:'5px 8px',marginBottom:6}}>{P1.map(f=><FRow key={f.k} f={f}/>)}</Crd>
      <ST ic="2️⃣" ch="การดูแลคุณยาย"/><Crd s={{padding:'5px 8px',marginBottom:6}}>{P2.map(f=><FRow key={f.k} f={f}/>)}</Crd>
      <ST ic="3️⃣" ch="บริการที่ต้องการ"/><Crd s={{padding:'5px 8px',marginBottom:6}}>{P3.map(f=><FRow key={f.k} f={f}/>)}</Crd>
      {!next&&<Btn ch="เลือกทีมดูแล →" col={C.suc} s={{width:'100%',padding:'11px',fontSize:11}}/>}
    </div>
  </div>;
}

// ── NEW BOOKING STEP 4: PACKAGES (no TrPicker) ───────────────────
function DNStep4(){
  const{booking}=useCtx();
  const[selPkg,setSP]=useState(null);const[showCustom,setSC]=useState(false);const[selC,setSelC]=useState([0,0,0]);
  const getPkgTotal=pkg=>{
    let t=pkg.rujai.bid;
    if(booking.has_khabdi&&pkg.khabdi)t+=pkg.khabdi.bid;
    if(booking.has_dulaeh&&pkg.dulaeh)t+=pkg.dulaeh.bid;
    return calcP(t,8,booking.transport_go==='grab').total;
  };
  if(showCustom){
    return <div style={{background:C.bg}}>
      <div style={{background:C.pri,padding:'7px 11px',display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>setSC(false)}>
        <span style={{color:'#fff',fontSize:14}}>{"←"}</span><span style={{color:'#fff',fontWeight:700,fontSize:11}}>{"✏️ ปรับแต่งทีมเอง"}</span>
      </div>
      <div style={{padding:'8px 10px 12px'}}>
        <Alrt t="info" ch="เลือกบุคลากรเองได้ ไม่ต้องเลือกบริการซ้ำ"/>
        <TrSummary/>
        <HR/>
        {SV_DEFS.map((sv,ri)=>{
          const isOn=booking['has_'+sv.k]||sv.locked;
          if(!isOn)return null;
          return <div key={ri} style={{marginBottom:10}}>
            <ST ic={sv.ic} ch={sv.title}/>
            {sv.k==='rujai'&&<div style={{background:'#F8FAFC',borderRadius:7,padding:'5px 8px',marginBottom:5}}>
              <div style={{fontSize:8,color:C.mid,fontWeight:700,marginBottom:3}}>{"ความแตกต่าง tier:"}</div>
              {Object.entries(TIERS).map(([k,t])=><div key={k} style={{display:'flex',gap:5,padding:'2px 0'}}><Tag ch={k} col={t.col}/><span style={{fontSize:8,color:C.mid,flex:1}}>{t.badge+" — "+t.suit}</span></div>)}
            </div>}
            <div style={{display:'flex',gap:4,overflowX:'auto',paddingBottom:3}}>
              {CANDS[ri].map((ct,ci)=><div key={ci} onClick={()=>setSelC(s=>{const n=[...s];n[ri]=ci;return n;})} style={{minWidth:98,padding:'6px 7px',borderRadius:9,flexShrink:0,border:`1.5px solid ${selC[ri]===ci?C.pri:C.bdr}`,background:selC[ri]===ci?'#EEEDFE':'#fff',cursor:'pointer'}}>
                {ct.tier&&TIERS[ct.tier]&&<div style={{marginBottom:2}}><Tag ch={ct.tier} col={TIERS[ct.tier].col}/></div>}
                <div style={{fontSize:10,fontWeight:700,marginBottom:1}}>{ct.name}</div>
                <div style={{fontSize:8,color:C.mid}}>{"⭐"+ct.r+"·"+ct.j+"งาน"}</div>
                {ct.hist!=='—'&&<div style={{fontSize:8,color:C.suc}}>{"👋"+ct.hist}</div>}
                <div style={{fontSize:11,fontWeight:900,color:C.suc,marginTop:3,paddingTop:3,borderTop:'1px solid '+C.bdr}}>{ct.bid}</div>
              </div>)}
            </div>
          </div>;
        })}
        <div style={{background:'#1E3A8A',borderRadius:10,padding:'10px 12px',marginTop:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{color:'rgba(255,255,255,0.5)',fontSize:9}}>{"ยอดรวม"}</div><div style={{color:'#93C5FD',fontSize:18,fontWeight:900}}>{"฿"+calcP(CANDS[0][selC[0]]?.bid?.replace(/[฿,]/g,'')*1||0,8,booking.transport_go==='grab').total.toLocaleString()}</div></div>
          <Btn ch="ยืนยันทีม →" col={C.suc} s={{padding:'10px 16px'}}/>
        </div>
      </div>
    </div>;
  }
  return <div style={{background:C.bg}}>
    <div style={{background:C.pri,padding:'7px 11px'}}><span style={{color:'#fff',fontWeight:700,fontSize:11}}>{"🎯 Step 4: เลือกทีมดูแล"}</span></div>
    <div style={{padding:'8px 10px 12px'}}>
      <div style={{background:'#EEEDFE',border:'1px solid #AFA9EC',borderRadius:8,padding:'6px 10px',marginBottom:8,fontSize:9,color:'#3C3489'}}>{"💡 AI วิเคราะห์: ความดัน + วีลแชร์ → เสนอ RN/PN เพื่อความปลอดภัย"}</div>
      {PKG.map(pkg=>{
        const tier=TIERS[pkg.rujai.tier];const total=getPkgTotal(pkg);const isSel=selPkg===pkg.id;
        return <div key={pkg.id} onClick={()=>setSP(pkg.id)} style={{background:isSel?pkg.bg:'#fff',border:`2px solid ${isSel?pkg.col:C.bdr}`,borderRadius:12,padding:'10px 11px',marginBottom:8,cursor:'pointer',position:'relative'}}>
          {pkg.badge&&<div style={{position:'absolute',top:-8,left:12,background:pkg.col,borderRadius:4,padding:'1px 7px',fontSize:8,color:'#fff',fontWeight:700}}>{pkg.badge}</div>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
            <div><div style={{fontSize:12,fontWeight:800,color:pkg.col}}>{pkg.label}</div><div style={{fontSize:9,color:C.mid}}>{pkg.sub}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:14,fontWeight:900,color:pkg.col}}>{"฿"+total.toLocaleString()}</div><div style={{fontSize:8,color:C.mid}}>{"รวมทุกอย่าง"}</div></div>
          </div>
          <div style={{background:tier.col+'15',border:`1px solid ${tier.col}40`,borderRadius:8,padding:'7px 9px',marginBottom:5}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}><span style={{fontSize:10,fontWeight:700}}>{"🤝 "+pkg.rujai.name}</span><Tag ch={tier.badge} col={tier.col}/></div>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}><Tag ch={pkg.rujai.tier} col={tier.col}/><span style={{fontSize:8,color:C.mid}}>{"⭐"+pkg.rujai.r+" · "+pkg.rujai.j+"งาน · "+pkg.rujai.km}</span></div>
            <div style={{fontSize:8,color:tier.col,fontWeight:700,marginBottom:1}}>{"✓ "+tier.cap}</div>
            <div style={{fontSize:8,color:C.mid,fontStyle:'italic'}}>{"เหมาะกับ: "+tier.suit}</div>
            <div style={{fontSize:9,fontWeight:800,color:tier.col,marginTop:3}}>{"฿"+pkg.rujai.bid.toLocaleString()}</div>
          </div>
          {booking.has_khabdi&&pkg.khabdi&&<div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderTop:'1px solid '+C.bdr,fontSize:9}}><span>{"🚗 "+pkg.khabdi.name+" — "+pkg.khabdi.sub}</span><span style={{fontWeight:700,color:C.suc}}>{"฿"+pkg.khabdi.bid}</span></div>}
          {booking.has_dulaeh&&<div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderTop:'1px solid '+C.bdr,fontSize:9}}>{pkg.dulaeh?<><span>{"💊 "+pkg.dulaeh.name+" — "+pkg.dulaeh.sub}</span><span style={{fontWeight:700,color:C.suc}}>{"฿"+pkg.dulaeh.bid}</span></>:<span style={{color:C.mid}}>{"💊 ไม่รวมรับยา"}</span>}</div>}
          <div style={{background:'rgba(0,0,0,0.04)',borderRadius:6,padding:'4px 7px',marginTop:5}}><span style={{fontSize:8,color:C.mid}}>{"💡 "+pkg.reason}</span></div>
          {isSel&&<div style={{marginTop:6}}><Btn ch={"✅ เลือก "+pkg.label+" Package →"} col={pkg.col} s={{width:'100%',padding:'9px'}}/></div>}
        </div>;
      })}
      <button onClick={()=>setSC(true)} style={{width:'100%',background:'none',border:'none',fontSize:10,color:C.pri,cursor:'pointer',textDecoration:'underline',padding:'4px 0'}}>{"✏️ ต้องการปรับแต่งทีมเอง →"}</button>
    </div>
  </div>;
}

// ── NEW BOOKING STEP 5: PAY + REGISTER ───────────────────────────
function DNStep5(){
  const{booking}=useCtx();const[step,setStep]=useState('pay');const[pt,sp]=useState('qr');
  const base=1680+(booking.has_khabdi?500:0)+(booking.has_dulaeh?300:0);
  const p=calcP(base,8,booking.transport_go==='grab');
  if(step==='reg')return <div style={{background:C.bg}}>
    <div style={{background:C.suc,padding:'8px 11px',display:'flex',alignItems:'center',gap:8}}>
      <span style={{color:'#fff',fontSize:14,cursor:'pointer'}} onClick={()=>setStep('pay')}>{"←"}</span>
      <span style={{color:'#fff',fontWeight:700,fontSize:11}}>{"📝 ลงทะเบียน"}</span>
    </div>
    <div style={{padding:'8px 10px 12px'}}>
      <Alrt t="success" ch="✅ ชำระเงินสำเร็จ! กรอกข้อมูลเพื่อรับอัปเดต LINE"/>
      <ST ic="👤" ch="ข้อมูลของคุณ"/>
      <InpBox ph="ชื่อ-นามสกุล"/><InpBox ph="เบอร์โทรศัพท์"/><InpBox ph="LINE ID"/>
      <HR/>
      <ST ic="👵" ch="ข้อมูลผู้สูงอายุ"/>
      <Crd s={{background:'#ECFDF5',border:'1px solid #6EE7B7'}}>
        <div style={{fontSize:9,color:C.suc,fontWeight:700,marginBottom:3}}>{"✅ AI เติมจากการจองให้แล้ว"}</div>
        {[['ชื่อ','แม่มุก วงศ์ทอง'],['อายุ','72 ปี'],['โรค','ความดัน เบาหวาน'],['พิเศษ','ใช้วีลแชร์'],['ชอบ','ขนมหวาน'],['ไม่ชอบ','กลัวแมว']].map(([l,v],i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'2px 0'}}><span style={{color:C.mid}}>{l}</span><span style={{fontWeight:700}}>{v}</span></div>
        ))}
      </Crd>
      <InpBox ph="แพ้ยา / ข้อมูลเพิ่มเติม..."/>
      <Alrt t="info" ch="🔒 Consent: GPS + บันทึกเสียง เพื่อความปลอดภัย"/>
      <Btn ch="✅ ลงทะเบียนสำเร็จ — ดู Dashboard" col={C.suc} s={{width:'100%',padding:'12px',fontSize:12}}/>
    </div>
  </div>;
  return <div style={{background:C.bg}}>
    <div style={{background:C.suc,padding:'7px 11px'}}><span style={{color:'#fff',fontWeight:700,fontSize:11}}>{"✅ Step 5: ยืนยัน + ชำระเงิน"}</span></div>
    <div style={{padding:'8px 9px'}}>
      <Crd s={{border:'2px solid '+C.suc}}>
        {[['👵','แม่มุก + ทีม welcares'],['📅','พ 15 พ.ค. 09:00'],['🏥','รพ.จุฬาฯ'],['🚗',booking.transport_go==='khabdi'?'🚐 Welcares':booking.transport_go==='grab'?'🚗 Grab':'เอง'],['💰','฿'+p.total.toLocaleString()]].map(([l,v],i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid '+C.bdr}}>
            <span style={{color:C.mid,fontSize:9}}>{l}</span>
            <span style={{fontWeight:i===4?900:700,color:i===4?C.suc:C.txt,fontSize:i===4?13:10}}>{v}</span>
          </div>
        ))}
      </Crd>
      <CancelPolicy/>
      <ST ic="💳" ch="ชำระเงิน"/>
      <div style={{display:'flex',gap:3,marginBottom:6}}>{[['card','💳 Card'],['qr','📱 QR'],['line','💚 LINE']].map(([v,l])=><div key={v} onClick={()=>sp(v)} style={{flex:1,padding:'5px 2px',textAlign:'center',borderRadius:8,border:`1.5px solid ${pt===v?C.suc:C.bdr}`,background:pt===v?'#ECFDF5':'#fff',fontSize:9,color:pt===v?C.suc:C.mid,cursor:'pointer',fontWeight:pt===v?700:400}}>{l}</div>)}</div>
      {pt==='card'&&<Crd><InpBox ph="1234 5678 9012 3456"/><div style={{display:'flex',gap:5}}><InpBox ph="MM/YY"/><InpBox ph="CVV"/></div></Crd>}
      {pt==='qr'&&<Crd s={{textAlign:'center'}}><div style={{width:65,height:65,background:'#F1F5F9',margin:'0 auto 4px',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{"▦"}</div></Crd>}
      {pt==='line'&&<Crd><Btn ch="💚 ชำระผ่าน LINE Pay" col={C.lin} s={{width:'100%'}}/></Crd>}
      <Btn ch={"ชำระเงิน ฿"+p.total.toLocaleString()+" →"} col={C.suc} fn={()=>setStep('reg')} s={{width:'100%',padding:'12px',fontSize:13,borderRadius:10}}/>
      <div style={{textAlign:'center',fontSize:9,color:C.mid,marginTop:3}}>{"🔒 ปลอดภัย · ประกัน ฿100,000"}</div>
    </div>
  </div>;
}

// ── OLD BOOKING ───────────────────────────────────────────────────
function DOldApptBook(){
  const{booking,setBooking}=useCtx();
  return <div style={{background:C.bg}}>
    <AB t="📅 ยืนยันนัดหมาย" bg={C.pri}/>
    <div style={{padding:'8px 10px'}}>
      <Crd s={{background:'#E1F5EE',border:'1px solid #1D9E75'}}>
        <div style={{fontSize:10,fontWeight:700,color:'#085041',marginBottom:4}}>{"📋 นัดหมายที่ดึงมา"}</div>
        {[['📅','พ 15 พ.ค. 68'],['⏰','09:00 น.'],['🏥','รพ.จุฬาฯ ตึก ภปร ชั้น 3'],['📋','อายุรกรรม'],['📝','งดน้ำ/อาหาร · X-Ray ก่อน']].map(([l,v],i)=>(
          <div key={i} style={{display:'flex',gap:8,padding:'3px 0',fontSize:9,borderBottom:'1px solid #9FE1CB'}}><span style={{color:'#085041',minWidth:24,flexShrink:0}}>{l}</span><span style={{fontWeight:700,color:C.txt}}>{v}</span></div>
        ))}
      </Crd>
      <ST ic="✅" ch="บริการ (จากครั้งที่แล้ว)"/>
      <div style={{display:'flex',gap:4,marginBottom:8}}>{SV_DEFS.map((sv,i)=>{const isOn=booking['has_'+sv.k]||sv.locked;return <div key={i} onClick={()=>!sv.locked&&setBooking(b=>({...b,['has_'+sv.k]:!b['has_'+sv.k]}))} style={{flex:1,padding:'6px 3px',borderRadius:9,border:`1.5px solid ${isOn?C.pri:C.bdr}`,background:isOn?'#EEEDFE':'#fff',cursor:sv.locked?'default':'pointer',textAlign:'center'}}><div style={{fontSize:16}}>{sv.ic}</div><div style={{fontSize:8,fontWeight:700,color:isOn?C.pri:C.mid,marginTop:1}}>{sv.title}</div><div style={{fontSize:7,color:sv.locked?C.suc:isOn?'#085041':C.mid}}>{sv.locked?'จำเป็น':isOn?'เคยจอง ✓':'ไม่จอง'}</div></div>;})}
      </div>
      <HR/>
      <ST ic="🚗" ch="เลือกวิธีเดินทาง (ไป-กลับ)"/>
      <TrPickerFull/>
      <Btn ch="ถัดไป → เลือกทีมดูแล" col={C.pri} s={{width:'100%',padding:'10px',fontSize:11,marginTop:10}}/>
    </div>
  </div>;
}

function DOldNoApptBook(){
  const{booking,setBooking}=useCtx();
  return <div style={{background:C.bg}}>
    <AB t="🗓 จองนัดใหม่" bg={C.pri}/>
    <div style={{padding:'8px 10px'}}>
      <Crd><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontWeight:700,fontSize:11}}>{"👵 แม่มุก · 72 ปี"}</div><div style={{fontSize:9,color:C.mid}}>{"🏠 ลาดพร้าว ซ.12 · วีลแชร์ · ความดัน"}</div></div><Tag ch="แก้ไข" col={C.pri}/></div></Crd>
      <Crd s={{background:'#E1F5EE',border:'1px solid #1D9E75'}}><div style={{fontSize:9,fontWeight:700,color:'#085041',marginBottom:2}}>{"📋 การจองล่าสุด"}</div><div style={{fontSize:9,color:'#085041',lineHeight:1.8}}>{"20 มี.ค. 68 · รพ.จุฬาฯ · คุณทิพย์ PN\n🤝 รู้ใจ + 💊 ดูแล · 🚗 Grab"}</div></Crd>
      <ST ic="🗓️" ch="แม่จะไปหาหมอวันไหนคะ?"/>
      <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:'1px solid '+C.bdr,marginBottom:5}}>{['🎙 พูด/พิมพ์','📷 บัตรนัด','✏️ กรอกเอง'].map((l,i)=><div key={i} style={{flex:1,textAlign:'center',padding:'6px 0',fontSize:9,background:i===0?C.pri:'#fff',color:i===0?'#fff':C.mid,cursor:'pointer'}}>{l}</div>)}</div>
      <div style={{background:'#F8FAFC',border:'1px solid #AFA9EC',borderRadius:7,padding:'7px 8px',fontSize:10,color:'#534AB7',marginBottom:8}}>{"🎙 เช่น \"พาแม่ไปรพ.จุฬา วันพุธ 19 มีค 9 โมง\""}</div>
      <ST ic="✅" ch="บริการ (จากครั้งที่แล้ว)"/>
      <div style={{display:'flex',gap:4,marginBottom:8}}>{SV_DEFS.map((sv,i)=>{const isOn=booking['has_'+sv.k]||sv.locked;return <div key={i} onClick={()=>!sv.locked&&setBooking(b=>({...b,['has_'+sv.k]:!b['has_'+sv.k]}))} style={{flex:1,padding:'6px 3px',borderRadius:9,border:`1.5px solid ${isOn?C.pri:C.bdr}`,background:isOn?'#EEEDFE':'#fff',cursor:sv.locked?'default':'pointer',textAlign:'center'}}><div style={{fontSize:16}}>{sv.ic}</div><div style={{fontSize:8,fontWeight:700,color:isOn?C.pri:C.mid,marginTop:1}}>{sv.title}</div><div style={{fontSize:7,color:sv.locked?C.suc:isOn?'#085041':C.mid}}>{sv.locked?'จำเป็น':isOn?'เคยจอง ✓':'ไม่จอง'}</div></div>;})}
      </div>
      <HR/>
      <ST ic="🚗" ch="เลือกวิธีเดินทาง (ไป-กลับ)"/>
      <TrPickerFull/>
      <Btn ch="ถัดไป → เลือกทีมดูแล" col={C.pri} s={{width:'100%',padding:'10px',fontSize:11,marginTop:10}}/>
    </div>
  </div>;
}

function DOldTeamSelect(){
  const{lastRating}=useCtx();const[manual,setManual]=useState(false);
  if(manual)return <DOldManual/>;
  if(lastRating>=4)return <DRepeatTeam onCustom={()=>setManual(true)}/>;
  return <DAINewTeam onCustom={()=>setManual(true)}/>;
}

function DRepeatTeam({onCustom}){
  const{booking,lastRating}=useCtx();
  const shown=PREV_TEAM.filter(m=>{if(m.ri===1)return booking.transport_go==='khabdi';return booking['has_'+ROLES[m.ri]]||m.ri===0;});
  return <div style={{background:C.bg}}>
    <AB t="🔁 ทีมเดิม — 1-Click" bg={C.pri}/>
    <div style={{padding:'8px 10px'}}>
      <SumPill/>
      <div style={{background:'#E1F5EE',border:'1px solid #1D9E75',borderRadius:10,padding:'10px 11px',marginBottom:8}}>
        <div style={{fontSize:11,fontWeight:700,color:'#085041',marginBottom:6}}>{"✦ AI แนะนำทีมเดิม (ยายชอบ ⭐"+lastRating+")"}</div>
        {shown.map((m,i)=>{const tier=TIERS[m.tier];return <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #9FE1CB'}}>
          <div style={{width:30,height:30,borderRadius:'50%',background:'#ECFDF5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{m.ri===0?'👩‍⚕️':m.ri===1?'🚗':'💊'}</div>
          <div style={{flex:1}}><div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}><span style={{fontSize:10,fontWeight:700}}>{m.name}</span>{tier&&<Tag ch={m.tier} col={tier.col}/>}</div><div style={{fontSize:8,color:C.mid}}>{"⭐"+m.r+" · "+m.bid}</div>{tier&&<div style={{fontSize:8,color:tier.col}}>{"✓ "+tier.cap.split(' ').slice(0,3).join(' ')}</div>}</div>
          <Tag ch="ทีมเดิม" col={C.suc}/>
        </div>;})}
        <TrSummary/>
      </div>
      <div style={{background:'#1E3A8A',borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{color:'rgba(255,255,255,0.5)',fontSize:9}}>{"ยอดรวม"}</div><div style={{color:'#93C5FD',fontSize:18,fontWeight:900}}>{"฿"+calcP(2480,8,false).total.toLocaleString()}</div></div>
        <Btn ch="จองซ้ำ 1-Click ✅" col={C.suc} s={{padding:'10px 16px'}}/>
      </div>
      <button onClick={onCustom} style={{width:'100%',background:'none',border:'none',fontSize:10,color:C.mid,cursor:'pointer',textDecoration:'underline',padding:'5px 0'}}>{"ต้องการเปลี่ยนทีม? →"}</button>
    </div>
  </div>;
}

function DAINewTeam({onCustom}){
  const{booking,lastRating}=useCtx();
  const shown=AI_NEW.filter(m=>{if(m.ri===1)return booking.transport_go==='khabdi';return booking['has_'+ROLES[m.ri]]||m.ri===0;});
  return <div style={{background:C.bg}}>
    <AB t="✦ AI แนะนำทีมใหม่" bg={C.pri}/>
    <div style={{padding:'8px 10px'}}>
      <Alrt t="warning" ch={"⭐ รอบที่แล้ว "+lastRating+" ดาว — AI คัดทีมใหม่ที่เหมาะกว่าค่ะ"}/>
      <div style={{background:'#EEEDFE',border:'1px solid #AFA9EC',borderRadius:8,padding:'6px 9px',marginBottom:8,fontSize:9,color:'#3C3489'}}>{"💡 แนะนำ upgrade เป็น RN เพื่อดูแลความดันได้ดีขึ้น"}</div>
      <SumPill/>
      <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'10px 11px',marginBottom:8}}>
        <div style={{fontSize:11,fontWeight:700,color:C.nvy,marginBottom:6}}>{"✦ AI เลือกทีมใหม่ที่ดีกว่า"}</div>
        {shown.map((m,i)=>{const tier=TIERS[m.tier];return <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #BFDBFE'}}>
          <div style={{width:30,height:30,borderRadius:'50%',background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{m.ri===0?'👩‍⚕️':m.ri===1?'🚗':'💊'}</div>
          <div style={{flex:1}}><div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}><span style={{fontSize:10,fontWeight:700}}>{m.name}</span>{tier&&<Tag ch={m.tier} col={tier.col}/>}</div><div style={{fontSize:8,color:C.mid}}>{"⭐"+m.r+" · "+m.bid}</div>{tier&&<div style={{fontSize:8,color:tier.col}}>{"✓ "+tier.cap.split(' ').slice(0,3).join(' ')}</div>}</div>
          <span style={{fontSize:9,color:m.ac,fontWeight:700}}>{"✦ ใหม่"}</span>
        </div>;})}
        <TrSummary/>
      </div>
      <div style={{background:'#1E3A8A',borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{color:'rgba(255,255,255,0.5)',fontSize:9}}>{"ยอดรวม"}</div><div style={{color:'#93C5FD',fontSize:18,fontWeight:900}}>{"฿"+calcP(2700,8,false).total.toLocaleString()}</div></div>
        <Btn ch="ยืนยัน →" col={C.suc} s={{padding:'10px 16px'}}/>
      </div>
      <button onClick={onCustom} style={{width:'100%',background:'none',border:'none',fontSize:10,color:C.pri,cursor:'pointer',textDecoration:'underline',padding:'5px 0'}}>{"ไม่ชอบทีมนี้? เลือกเองเลย →"}</button>
    </div>
  </div>;
}

function DOldManual(){
  const{booking,setBooking}=useCtx();const[sel,setSel]=useState([0,0,0]);
  return <div style={{background:C.bg}}>
    <AB t="✏️ เลือกทีมดูแล" bg={C.pri}/>
    <div style={{padding:'8px 10px 12px'}}>
      <Alrt t="info" ch="✏️ เลือกบุคลากรเองได้ตามต้องการ"/><SumPill/><TrSummary/><HR/>
      {SV_DEFS.map((sv,ri)=>{
        const isOn=booking['has_'+sv.k]||sv.locked;
        return <div key={ri} style={{marginBottom:8}}>
          <div onClick={()=>!sv.locked&&setBooking(b=>({...b,['has_'+sv.k]:!b['has_'+sv.k]}))} style={{background:'#fff',border:`1.5px solid ${isOn?C.pri:C.bdr}`,borderRadius:10,padding:'7px 9px',display:'flex',alignItems:'center',gap:9,cursor:sv.locked?'default':'pointer',marginBottom:isOn?5:0}}>
            <div style={{width:30,height:30,borderRadius:8,background:isOn?'#EEEDFE':'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{sv.ic}</div>
            <div style={{flex:1}}><div style={{fontSize:11,fontWeight:700,color:isOn?C.pri:C.mid}}>{sv.title}</div><div style={{fontSize:9,color:C.mid}}>{sv.desc}</div></div>
            {sv.locked?<Tag ch="จำเป็น" col={C.suc}/>:<TogSw on={isOn}/>}
          </div>
          {isOn&&sv.k==='rujai'&&<div style={{background:'#F8FAFC',borderRadius:7,padding:'5px 8px',marginBottom:4}}>
            <div style={{fontSize:8,color:C.mid,fontWeight:700,marginBottom:2}}>{"ความแตกต่าง tier:"}</div>
            {Object.entries(TIERS).map(([k,t])=><div key={k} style={{display:'flex',gap:5,padding:'2px 0',fontSize:8}}><Tag ch={k} col={t.col}/><span style={{color:C.mid,flex:1}}>{t.badge+" — "+t.suit}</span></div>)}
          </div>}
          {isOn&&<div style={{display:'flex',gap:4,overflowX:'auto',paddingBottom:3}}>
            {CANDS[ri].map((ct,ci)=><div key={ci} onClick={()=>setSel(s=>{const n=[...s];n[ri]=ci;return n;})} style={{minWidth:98,padding:'6px 7px',borderRadius:9,flexShrink:0,border:`1.5px solid ${sel[ri]===ci?C.pri:C.bdr}`,background:sel[ri]===ci?'#EEEDFE':'#fff',cursor:'pointer'}}>
              {ct.tier&&TIERS[ct.tier]&&<div style={{marginBottom:2}}><Tag ch={ct.tier} col={TIERS[ct.tier].col}/></div>}
              <div style={{fontSize:10,fontWeight:700,marginBottom:1}}>{ct.name}</div>
              <div style={{fontSize:8,color:C.mid}}>{"⭐"+ct.r+"·"+ct.j+"งาน"}</div>
              {ct.hist!=='—'&&<div style={{fontSize:8,color:C.suc}}>{"👋"+ct.hist}</div>}
              <div style={{fontSize:11,fontWeight:900,color:C.suc,marginTop:3,paddingTop:3,borderTop:'1px solid '+C.bdr}}>{ct.bid}</div>
            </div>)}
          </div>}
        </div>;
      })}
      <div style={{background:'#1E3A8A',borderRadius:10,padding:'10px 12px',marginTop:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{color:'rgba(255,255,255,0.5)',fontSize:9}}>{"ยอดรวม"}</div><div style={{color:'#93C5FD',fontSize:18,fontWeight:900}}>{"฿"+calcP(2480,8,false).total.toLocaleString()}</div></div>
        <Btn ch="ยืนยัน →" col={C.suc} s={{padding:'10px 16px'}}/>
      </div>
    </div>
  </div>;
}

// Confirm & Pay for old customers (no consent)
function DConfirmPay(){
  const{booking}=useCtx();const[pt,sp]=useState('qr');
  const base=1680+(booking.has_khabdi?500:0)+(booking.has_dulaeh?300:0);
  const p=calcP(base,8,booking.transport_go==='grab');
  return <div style={{background:C.bg}}>
    <AB t="✅ ยืนยัน + ชำระเงิน" bg={C.pri}/>
    <div style={{padding:'8px 9px'}}>
      <Crd s={{border:'2px solid '+C.pri}}>
        {[['👵','แม่มุก + ทีม welcares'],['📅','พ 15 พ.ค. 09:00'],['🏥','รพ.จุฬาฯ'],['🚗',booking.transport_go==='khabdi'?'🚐 Welcares':booking.transport_go==='grab'?'🚗 Grab':'เอง'],['💰','฿'+p.total.toLocaleString()]].map(([l,v],i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid '+C.bdr}}><span style={{color:C.mid,fontSize:9}}>{l}</span><span style={{fontWeight:i===4?900:700,color:i===4?C.suc:C.txt,fontSize:i===4?13:10}}>{v}</span></div>
        ))}
      </Crd>
      <CancelPolicy/>
      <ST ic="💳" ch="ชำระเงิน"/>
      <div style={{display:'flex',gap:3,marginBottom:6}}>{[['card','💳 Card'],['qr','📱 QR'],['line','💚 LINE']].map(([v,l])=><div key={v} onClick={()=>sp(v)} style={{flex:1,padding:'5px 2px',textAlign:'center',borderRadius:8,border:`1.5px solid ${pt===v?C.pri:C.bdr}`,background:pt===v?'#EEEDFE':'#fff',fontSize:9,color:pt===v?C.pri:C.mid,cursor:'pointer',fontWeight:pt===v?700:400}}>{l}</div>)}</div>
      {pt==='card'&&<Crd><InpBox ph="1234 5678 9012 3456"/><div style={{display:'flex',gap:5}}><InpBox ph="MM/YY"/><InpBox ph="CVV"/></div></Crd>}
      {pt==='qr'&&<Crd s={{textAlign:'center'}}><div style={{width:65,height:65,background:'#F1F5F9',margin:'0 auto',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{"▦"}</div></Crd>}
      <Btn ch={"ชำระเงิน ฿"+p.total.toLocaleString()+" →"} col={C.suc} s={{width:'100%',padding:'12px',fontSize:13,borderRadius:10}}/>
      <div style={{textAlign:'center',fontSize:9,color:C.mid,marginTop:3}}>{"🔒 ปลอดภัย · ประกัน ฿100,000 · ยกเลิก 48ชม. คืนเต็ม"}</div>
    </div>
  </div>;
}

// ── HOME SCREENS ──────────────────────────────────────────────────
function DHomeOldAppt({openHam}){
  const[sel,ss]=useState(0);const el=[{name:'แม่มุก',age:72,cond:'ความดัน · วีลแชร์'},{name:'พ่อสมชัย',age:78,cond:'เบาหวาน · หัวใจ'}];
  const appts=[{date:'พ 15 พ.ค. 09:00',doc:'นพ.สมชาย',dept:'อายุรกรรม',s:'จองแล้ว'},{date:'พ 15 พ.ค. 14:00',doc:'นพ.วิชัย',dept:'ตา',s:'รอจอง'},{date:'ส 18 พ.ค. 10:00',doc:'ทพ.มาลี',dept:'ทันตกรรม',s:'รอจอง'}];
  return <div style={{background:C.bg}}>
    <AB t="🩵 welcares" onHam={openHam} notif bg={C.pri} right={<span style={{color:'white',fontSize:9,background:'rgba(255,255,255,0.2)',padding:'2px 6px',borderRadius:4}}>{"LINE ✓"}</span>}/>
    <div style={{padding:'8px 9px'}}>
      <Alrt t="warning" ch="🔔 แม่มีนัดหมอสัปดาห์หน้า — จองบริการ?"/>
      <div style={{display:'flex',gap:4,marginBottom:6}}>{el.map((e,i)=><div key={i} onClick={()=>ss(i)} style={{flex:1,padding:'5px 8px',borderRadius:8,border:`1.5px solid ${sel===i?C.pri:C.bdr}`,background:sel===i?'#EEEDFE':'#fff',cursor:'pointer'}}><div style={{fontSize:11,fontWeight:700,color:sel===i?C.pri:C.txt}}>{e.name}</div><div style={{fontSize:9,color:C.mid}}>{e.age+" ปี · "+e.cond}</div></div>)}</div>
      <ST ic="📅" ch={"ตารางนัด"+el[sel].name}/>
      <Crd s={{padding:'5px 8px'}}>{appts.map((a,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:i<appts.length-1?'1px solid '+C.bdr:'none'}}><div><div style={{fontSize:10,fontWeight:700}}>{a.date}</div><div style={{fontSize:9,color:C.mid}}>{a.doc+" · "+a.dept}</div></div><div style={{display:'flex',gap:4,alignItems:'center'}}><Tag ch={a.s} col={a.s==='จองแล้ว'?C.suc:C.wrn}/>{a.s==='รอจอง'&&<Btn ch="จอง" col={C.pri} sm/>}</div></div>)}</Crd>
    </div>
  </div>;
}

function DHomeOldNoAppt({openHam}){
  return <div style={{background:C.bg}}>
    <AB t="🩵 welcares" onHam={openHam} notif bg={C.pri} right={<span style={{color:'white',fontSize:9,background:'rgba(255,255,255,0.2)',padding:'2px 6px',borderRadius:4}}>{"LINE ✓"}</span>}/>
    <div style={{padding:'8px 9px'}}>
      <Crd><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontWeight:700,fontSize:12}}>{"👵 แม่มุก · 72 ปี"}</div><div style={{fontSize:9,color:C.mid}}>{"🏠 ลาดพร้าว ซ.12 · วีลแชร์ · ความดัน"}</div></div><Tag ch="แก้ไข" col={C.pri}/></div></Crd>
      <Crd s={{background:'#E1F5EE',border:'1px solid #1D9E75'}}><div style={{fontSize:10,fontWeight:700,color:'#085041',marginBottom:2}}>{"📋 การจองล่าสุด"}</div><div style={{fontSize:9,color:'#085041',lineHeight:1.8}}>{"20 มี.ค. 68 · รพ.จุฬาฯ · คุณทิพย์ PN\n🤝 รู้ใจ + 💊 ดูแล · 🚗 Grab"}</div></Crd>
      <Alrt t="info" ch="📅 ยังไม่มีนัดครั้งต่อไป — กดแท็บ 📅 จอง เพื่อเริ่มค่ะ"/>
      <Btn ch="📅 จองนัดใหม่ →" col={C.pri} s={{width:'100%',padding:'11px',fontSize:11}}/>
    </div>
  </div>;
}

function DLiveView(){
  const[job,setJob]=useState(()=>getActiveJob());
  const DLSTEPS=[{l:'รับจากบ้าน',cpKey:'รับจากบ้าน',ic:'🏠'},{l:'ถึงโรงพยาบาล',cpKey:'ถึง รพ.',ic:'🏥'},{l:'กำลังรอพบแพทย์',cpKey:'รอพบแพทย์',ic:'⏳'},{l:'รับยา',cpKey:'รอรับยา',ic:'💊'},{l:'กลับบ้าน',cpKey:'ส่งกลับบ้าน',ic:'🏠'}];
  useEffect(()=>{const load=()=>setJob(getActiveJob());load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const cpMap={};const cpPhotoMap={};
  (job?.checkpoints||[]).forEach(cp=>{DLSTEPS.forEach((s,i)=>{if(cp.label===s.cpKey||cp.label.includes(s.l.slice(0,4))){cpMap[i]=cp.time;if(cp.photo)cpPhotoMap[i]=cp.photo;}});});
  const fmtT=iso=>{try{const d=new Date(iso);return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')+' น.';}catch{return'';}};
  const activeIdx=DLSTEPS.findIndex((_,i)=>!cpMap[i]);
  const bd=job?.bookingData||{};
  const steps=DLSTEPS.map((s,i)=>{const done=cpMap[i]!==undefined;const active=i===activeIdx;return{ic:done?'✅':active?s.ic:s.ic,d:done?'done':active?'active':'future',l:s.l,s:done?fmtT(cpMap[i]):active?'กำลังดำเนินการ…':'',img:done&&i<2};});
  const headerLabel=activeIdx>=0?'● '+steps[activeIdx]?.l:(job?'● เสร็จสิ้นแล้ว':'● กำลังรอพบแพทย์');
  const subLabel=job?([bd.schedule?.date,bd.schedule?.time].filter(Boolean).join(' ')||'วันนี้')+' · '+(bd.locations?.dropoff||'รพ.')+' · '+(bd.patient?.name||'-'):'พ 15 พ.ค. 68 · รพ.จุฬาฯ · แม่มุก';
  return <div style={{padding:'8px 9px',background:C.bg}}>
    <div style={{textAlign:'center',marginBottom:6}}><div style={{fontWeight:700,color:C.pri,fontSize:13}}>{headerLabel}</div><div style={{fontSize:9,color:C.mid}}>{subLabel}</div></div>
    {steps.map((s,i)=><div key={i} style={{display:'flex',gap:9,marginBottom:3,opacity:s.d==='future'?.35:1}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,border:`2px solid ${s.d==='done'?C.suc:s.d==='active'?C.pri:C.bdr}`,background:s.d==='done'?'#ECFDF5':s.d==='active'?'#EEEDFE':'#fff'}}>{s.ic}</div>
        {i<steps.length-1&&<div style={{width:2,height:cpPhotoMap[i]?52:s.img?52:18,background:s.d==='done'?C.suc:C.bdr}}/>}
      </div>
      <div style={{paddingTop:5,flex:1}}>
        <div style={{fontSize:11,fontWeight:s.d==='active'?700:500,color:s.d==='active'?C.pri:C.txt}}>{s.l}</div>
        <div style={{fontSize:9,color:C.mid}}>{s.s}</div>
        {s.img&&(cpPhotoMap[i]
          ?<img src={cpPhotoMap[i]} style={{width:'100%',height:52,objectFit:'cover',borderRadius:7,marginTop:4,border:'1px solid '+C.bdr}}/>
          :<div style={{background:'#F1F5F9',borderRadius:8,height:38,display:'flex',alignItems:'center',justifyContent:'center',marginTop:4,border:'1px solid '+C.bdr}}><span style={{fontSize:9,color:C.mid}}>{"📷 รูปจะปรากฏหลังถ่าย"}</span></div>)}
      </div>
    </div>)}
    <Crd s={{background:'#E1F5EE',border:'1px solid #1D9E75',marginTop:6}}><div style={{fontWeight:700,color:'#085041',marginBottom:2}}>{"💡 จองนัดครั้งต่อไป 15 ก.ค.?"}</div><div style={{display:'flex',gap:4}}><Btn ch="จองเลย →" col={C.suc} sm/><Btn ch="ภายหลัง" col={C.mid} out sm/></div></Crd>
  </div>;
}

// Report with Note tab (instruction 10)
function DReport(){
  const[rt,srt]=useState('emotion');const[noteStatus,setNS]=useState('pending');
  const[job,setJob]=useState(()=>getActiveJob()||getJobs().find(j=>j.status==='completed'));
  useEffect(()=>{const load=()=>setJob(getActiveJob()||getJobs().find(j=>j.status==='completed'));load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const scoreCol=s=>s>=4?C.suc:s>=3?C.wrn:C.dan;
  const scoreEmoji=s=>s>=4?'😊 ดี':'s>=3'?'😐 ปกติ':'😟 ต้องติดตาม';
  return <div style={{padding:'8px 9px',background:C.bg}}>
    <div style={{display:'flex',gap:2,marginBottom:7,overflowX:'auto'}}>
      {[{v:'emotion',l:'😊'},{v:'doctor',l:'👨‍⚕️'},{v:'meds',l:'💊'},{v:'note',l:'📝 Note'}].map(r=><button key={r.v} onClick={()=>srt(r.v)} style={{flex:1,padding:'4px 2px',borderRadius:6,border:`1px solid ${rt===r.v?C.pri:C.bdr}`,background:rt===r.v?'#EEEDFE':'#fff',fontSize:8,color:rt===r.v?C.pri:C.mid,cursor:'pointer',fontWeight:rt===r.v?700:400,whiteSpace:'nowrap',minWidth:40}}>{r.l}</button>)}
    </div>
    {rt==='emotion'&&<Crd s={{background:'#FFF3CD'}}><div style={{fontWeight:700,marginBottom:2}}>{"😊 AI Sentiment"}</div>
      {job?.voiceSentiment?<div style={{display:'flex',gap:8,marginTop:4}}>
        <div style={{flex:1,textAlign:'center'}}><div style={{fontSize:9,color:C.mid}}>{"คะแนน"}</div><div style={{fontSize:14,fontWeight:800,color:scoreCol(job.voiceSentiment.score)}}>{job.voiceSentiment.score+"/5"}</div></div>
        <div style={{flex:2,fontSize:9,color:C.txt,lineHeight:1.6}}>{job.voiceSentiment.summary}</div>
      </div>:<div style={{display:'flex',gap:8,marginTop:4}}>{[{l:'บรรยากาศ',v:'😊 ดีมาก',c:C.suc},{l:'ระดับ',v:'4.8/5',c:C.suc},{l:'คำพูดดี',v:'87%',c:C.pri}].map((k,i)=><div key={i} style={{flex:1,textAlign:'center'}}><div style={{fontSize:9,color:C.mid}}>{k.l}</div><div style={{fontSize:12,fontWeight:800,color:k.c}}>{k.v}</div></div>)}</div>}
      {job?.voiceSentiment?.flags?.length>0&&<div style={{marginTop:4}}>{job.voiceSentiment.flags.map((f,i)=><Tag key={i} ch={"⚠️ "+f} col={C.dan}/>)}</div>}
    </Crd>}
    {rt==='doctor'&&<Crd><ST ic="👨‍⚕️" ch="Doctor Summary"/><div style={{fontSize:10,lineHeight:1.8}}>{"ความดันลด 145/90→128/82 ✅\nลด AMLODIPINE 10mg→5mg\nนัดติดตาม: 15 ก.ค. 68"}</div></Crd>}
    {rt==='meds'&&<Crd><ST ic="💊" ch="Medication"/><div style={{height:5,background:'#E2E8F0',borderRadius:3,marginBottom:3}}><div style={{height:5,width:'91%',background:C.suc,borderRadius:3}}/></div><div style={{fontSize:9,color:C.suc,textAlign:'right'}}>{"91% compliance ✅"}</div></Crd>}
    {rt==='note'&&<>
      <Crd s={{background:'#F8FAFC'}}>
        <ST ic="🎙" ch="บันทึกเสียง คุณทิพย์ (PN)"/>
        {job?.voiceNoteUrl
          ?<audio controls src={job.voiceNoteUrl} style={{width:'100%',height:32,marginBottom:4}}/>
          :<div style={{background:'#EFF6FF',borderRadius:8,height:38,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:5}}><span style={{fontSize:9,color:C.pri}}>{"🎵 จะปรากฏหลังปิดงาน"}</span></div>}
      </Crd>
      <Crd>
        <ST ic="🤖" ch="AI Transcript + Tone Analysis"/>
        <div style={{fontSize:9,color:C.txt,lineHeight:1.8,background:'#F8FAFC',borderRadius:6,padding:'6px 8px',marginBottom:6}}>{job?.voiceTranscript||"คุณยายอารมณ์ดีตลอด พูดคุยเรื่องหลาน ๒ คน ความดันลดลงจาก ๑๔๕ เป็น ๑๒๘ หมอแนะนำลดยา และนัดติดตาม ๑๕ ก.ค. คุณยายรับทราบและยิ้มตลอด"}</div>
        {job?.voiceSentiment
          ?<div style={{display:'flex',gap:3}}><div style={{flex:1,textAlign:'center',background:scoreCol(job.voiceSentiment.score)+'12',borderRadius:6,padding:'3px 0',fontSize:7,color:scoreCol(job.voiceSentiment.score),fontWeight:700}}>{scoreEmoji(job.voiceSentiment.score)}</div><div style={{flex:1,textAlign:'center',background:C.pri+'12',borderRadius:6,padding:'3px 0',fontSize:7,color:C.pri,fontWeight:700}}>{"คะแนน "+job.voiceSentiment.score+"/5"}</div><div style={{flex:1,textAlign:'center',background:(job.voiceSentiment.flags.length?C.dan:C.suc)+'12',borderRadius:6,padding:'3px 0',fontSize:7,color:job.voiceSentiment.flags.length?C.dan:C.suc,fontWeight:700}}>{job.voiceSentiment.flags.length?'⚠️ '+job.voiceSentiment.flags.length+' flag':'✅ ไม่มีความเสี่ยง'}</div></div>
          :<div style={{display:'flex',gap:3}}>{[{l:'โทนดี 😊',c:C.suc},{l:'Positive 87%',c:C.pri},{l:'ไม่มีความเสี่ยง',c:C.suc}].map((k,i)=><div key={i} style={{flex:1,textAlign:'center',background:k.c+'12',borderRadius:6,padding:'3px 0',fontSize:7,color:k.c,fontWeight:700}}>{k.l}</div>)}</div>}
      </Crd>
      {noteStatus==='pending'&&<Crd s={{background:'#FFFBEB',border:'1px solid #F59E0B'}}>
        <div style={{fontSize:9,fontWeight:700,color:'#92400E',marginBottom:2}}>{"⏳ รอ Ops อนุมัติ (ช่วงแรก)"}</div>
        <div style={{fontSize:8,color:C.mid,marginBottom:5}}>{"หลังจาก Ops approve ครั้งแรก AI Agent จะดูแลแทนอัตโนมัติ"}</div>
        <Btn ch="✅ Ops: อนุมัติส่งให้ลูกสาว" col={C.suc} s={{width:'100%'}} fn={()=>{setNS('approved');const j=getJobs().find(j=>j.status==='completed');if(j)updateJob(j.jobId,{reportApproved:true});}}/>
      </Crd>}
      {noteStatus==='approved'&&<Alrt t="success" ch="✅ Ops อนุมัติแล้ว — AI Agent ส่งให้ลูกสาวอัตโนมัติ · ต่อไปไม่ต้อง approve"/>}
    </>}
  </div>;
}

function DNCare(){
  const[msgs,setMsgs]=useState([{role:'ai',text:'สวัสดีคุณเจดา 😊 มีอะไรให้น้องแคร์ช่วยไหมคะ?'}]);
  const[rec,setRec]=useState(false);const[proc,setProc]=useState(false);
  const recRef=useRef(null);
  const level=useAudioLevel(recRef,rec);
  const PROMPT='คุณคือน้องแคร์ AI ผู้ช่วย Welcares สำหรับครอบครัว ตอบภาษาไทย 1-3 ประโยค ให้ข้อมูลสถานะผู้ป่วย นัดหมาย หรือข้อสงสัยเกี่ยวกับบริการ ใช้ภาษาสุภาพและเป็นมิตร';
  const startV=async()=>{try{recRef.current=await createRecorder();recRef.current.start();setRec(true);}catch{alert('กรุณาอนุญาตใช้ไมค์ก่อนนะคะ 🙏');}};
  const stopV=async()=>{
    if(!recRef.current||!rec)return;
    setRec(false);setProc(true);
    const blob=await recRef.current.stop();
    const k=getApiKey();
    if(!k){setMsgs(m=>[...m,{role:'ai',text:'ยังไม่ได้ตั้งค่า API Key ค่ะ 🙏'}]);setProc(false);return;}
    const tx=await transcribeAudio(blob,k);
    if(tx)setMsgs(m=>[...m,{role:'user',text:tx}]);
    const reply=await chatWithAI(tx||'...',k,PROMPT);
    setMsgs(m=>[...m,{role:'ai',text:reply||'ขอโทษค่ะ ไม่ได้ยิน ลองใหม่นะคะ'}]);
    setProc(false);
  };
  const last5=msgs.slice(-5);
  return <div style={{background:C.bg,minHeight:450,display:'flex',flexDirection:'column'}}>
    <div style={{background:C.lin,padding:'8px 11px',display:'flex',alignItems:'center',gap:8,flexShrink:0}}><div style={{width:26,height:26,background:'white',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>{"🤖"}</div><span style={{color:'white',fontWeight:700,fontSize:12}}>{"น้องแคร์"}</span></div>
    <div style={{flex:1,display:'flex',flexDirection:'column',gap:8,padding:'10px 12px',overflowY:'auto',maxHeight:300}}>
      {last5.map((m,i)=><div key={i} style={{display:'flex',justifyContent:m.role==='ai'?'flex-start':'flex-end'}}>
        <div style={{maxWidth:'80%',background:m.role==='ai'?'#EEEDFE':'#7F77DD',color:m.role==='ai'?'#3C3489':'#fff',borderRadius:m.role==='ai'?'4px 12px 12px 12px':'12px 4px 12px 12px',padding:'8px 12px',fontSize:11,lineHeight:1.6,border:m.role==='ai'?'1px solid #AFA9EC':'none'}}>{m.text}</div>
      </div>)}
      {proc&&<div style={{display:'flex',justifyContent:'flex-start'}}><div style={{background:'#EEEDFE',borderRadius:'4px 12px 12px 12px',padding:'8px 12px',fontSize:11,color:'#94A3B8',border:'1px solid #AFA9EC'}}>{"⏳ กำลังคิด…"}</div></div>}
    </div>
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,padding:'10px 12px',borderTop:'1px solid '+C.bdr,flexShrink:0}}>
      <VoiceWave recording={rec} level={level}/>
      <button onPointerDown={startV} onPointerUp={stopV} onPointerLeave={rec?stopV:undefined}
        style={{width:60,height:60,borderRadius:'50%',background:rec?C.dan:C.pri,color:'#fff',fontSize:24,border:`3px solid ${rec?'rgba(239,68,68,.25)':'rgba(127,119,221,.25)'}`,cursor:'pointer',transition:'background .2s',userSelect:'none',WebkitUserSelect:'none',touchAction:'none'}}>{"🎙"}</button>
      <div style={{fontSize:10,color:C.mid}}>{rec?'ปล่อยเมื่อพูดเสร็จ':'กดค้างเพื่อพูดค่ะ'}</div>
    </div>
  </div>;
}

// Daughter Ham pages (FINAL)
const DAddEl=()=><div style={{background:C.bg,padding:'8px 9px'}}><ST ic="👵" ch="เพิ่ม / แก้ไขผู้สูงอายุ"/><InpBox ph="ชื่อ-นามสกุล"/><InpBox ph="อายุ"/><InpBox ph="ที่อยู่รับ-ส่ง"/><InpBox ph="เบอร์ + LINE ID"/><InpBox ph="โรคประจำตัว"/><InpBox ph="ความต้องการพิเศษ"/><InpBox ph="สิ่งที่ชอบ / ไม่ชอบ / แพ้ยา"/><Btn ch="💾 บันทึก" col={C.suc} s={{width:'100%'}}/></div>;
const DHist=()=><div style={{background:C.bg,padding:'8px 9px'}}><ST ic="📋" ch="ประวัติธุรกรรม"/>{[{date:'15 พ.ค. 68',svc:'คุณทิพย์ PN+Welcares',amt:'฿2,480'},{date:'20 มี.ค. 68',svc:'คุณทิพย์ PN+Grab',amt:'฿2,100'}].map((tx,i)=><Crd key={i}><div style={{fontSize:10,fontWeight:700,marginBottom:2}}>{tx.date}</div><div style={{fontSize:9,color:C.mid,marginBottom:3}}>{tx.svc}</div><div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:12,fontWeight:800,color:C.suc}}>{tx.amt}</span><Btn ch="ดูรายงาน" col={C.pri} sm/></div></Crd>)}</div>;
const DConsentP=()=><div style={{background:C.bg,padding:'8px 9px'}}><ST ic="🔒" ch="Consent Setting"/>{[{ic:'📍',l:'GPS tracking',lock:true,on:true},{ic:'🎙',l:'บันทึกเสียง',lock:true,on:true},{ic:'📸',l:'Moments of Joy',lock:false,on:true},{ic:'📅',l:'Calendar',lock:false,on:true}].map((c,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid '+C.bdr}}><div style={{width:26,height:15,borderRadius:8,background:c.on?C.suc:'#CBD5E1',position:'relative',flexShrink:0,opacity:c.lock?.7:1}}><div style={{position:'absolute',top:2,right:2,width:11,height:11,borderRadius:'50%',background:'#fff'}}/></div><span style={{fontSize:10,fontWeight:600}}>{c.ic+" "+c.l+(c.lock?' 🔒':'')}</span></div>)}</div>;
const DFriend=()=><div style={{background:C.bg,padding:'8px 9px',textAlign:'center'}}><div style={{fontSize:36,margin:'10px 0'}}>{"🎁"}</div><div style={{fontSize:16,fontWeight:800,marginBottom:6}}>{"แนะนำเพื่อน รับ ฿200"}</div><Crd s={{background:'#EEEDFE',border:'1px solid #AFA9EC'}}><div style={{fontWeight:700,color:C.pri,marginBottom:3}}>{"รหัสของคุณ"}</div><div style={{fontSize:22,fontWeight:900,color:C.pri,letterSpacing:4}}>{"JADA2025"}</div></Crd><Btn ch="📲 แชร์ผ่าน LINE" col={C.lin} s={{width:'100%',marginBottom:5}}/><Btn ch="📋 คัดลอก" col={C.pri} out s={{width:'100%'}}/></div>;
const dHam=[{ic:'👵',label:'เพิ่ม / แก้ไขผู้สูงอายุ',hamPage:<DAddEl/>},{ic:'📋',label:'ประวัติธุรกรรม',hamPage:<DHist/>},'---',{ic:'🔒',label:'Consent Setting',hamPage:<DConsentP/>},{ic:'👥',label:'Get Friend Affiliate',hamPage:<DFriend/>},'---',{ic:'⚙️',label:'ตั้งค่าบัญชี'},{ic:'🚪',label:'ออกจากระบบ'}];

// ── GRANDMA ───────────────────────────────────────────────────────
const GF={base:16,large:20,btn:52};
function GHome(){
  const[apptJob,setApptJob]=useState(()=>getJobs().find(j=>j.status!=='cancelled'&&j.status!=='completed'));
  useEffect(()=>{const load=()=>setApptJob(getJobs().find(j=>j.status!=='cancelled'&&j.status!=='completed'));load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const bd=apptJob?.bookingData||{};
  return <div style={{background:'#fff',padding:14,display:'flex',flexDirection:'column',gap:8}}>
    <div style={{fontSize:GF.large,fontWeight:800,textAlign:'center',color:C.drk}}>{"สวัสดีค่ะ "+(bd.patient?.name||'คุณยายมุก')+" 👋"}</div>
    <Crd s={{background:'#EEEDFE',border:'2px solid '+C.pri}}>
      <div style={{fontSize:GF.base,fontWeight:700,color:'#534AB7',marginBottom:6}}>{"📅 ตารางนัดหมอ"}</div>
      {apptJob?<div style={{display:'flex',gap:8,padding:'6px 0',fontSize:GF.base-2,alignItems:'center'}}><span style={{fontSize:GF.base}}>{"🩺"}</span><div><div style={{fontWeight:700}}>{[bd.schedule?.date,bd.schedule?.time].filter(Boolean).join(' ')||'-'}</div><div style={{color:'#534AB7'}}>{bd.locations?.dropoff||'-'}</div></div></div>
      :[{d:'พ 15 พ.ค.',doc:'หมอสมชาย',t:'09:00',ic:'🩺'},{d:'พ 15 พ.ค.',doc:'หมออุดม',t:'14:00',ic:'👁'}].map((a,i)=>(
        <div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'1px solid #AFA9EC',fontSize:GF.base-2,alignItems:'center'}}><span style={{fontSize:GF.base}}>{a.ic}</span><div><div style={{fontWeight:700}}>{a.d+" "+a.t}</div><div style={{color:'#534AB7'}}>{a.doc}</div></div></div>
      ))}
    </Crd>
    <Crd>
      <div style={{fontSize:GF.base,fontWeight:700,marginBottom:6}}>{"💊 ยาวันนี้"}</div>
      {[{t:'เช้า',m:'ยาความดัน 1 เม็ด',done:true},{t:'กลางวัน',m:'ยาเบาหวาน 1 เม็ด',done:false},{t:'เย็น',m:'ยาเลือด 1 เม็ด',done:false}].map((item,i)=>(
        <div key={i} style={{display:'flex',gap:10,padding:'7px 0',borderBottom:'1px solid '+C.bdr,alignItems:'center'}}><span style={{fontSize:GF.base,width:52,color:C.mid}}>{item.t}</span><span style={{flex:1,fontSize:GF.base}}>{item.m}</span><span style={{fontSize:22}}>{item.done?'✅':'⬜'}</span></div>
      ))}
    </Crd>
  </div>;
}
function GNCare(){
  const[msgs,setMsgs]=useState([{role:'ai',text:'มีอะไรให้น้องแคร์ช่วยไหมคะ? 💚'}]);
  const[rec,setRec]=useState(false);const[proc,setProc]=useState(false);
  const recRef=useRef(null);
  const level=useAudioLevel(recRef,rec);
  const PROMPT='คุณคือน้องแคร์ AI ผู้ช่วยดูแลผู้สูงอายุของ Welcares ตอบภาษาไทย สั้น อบอุ่น 1-2 ประโยค ใช้ Emoji เพิ่มความน่ารัก ห้ามพูดยาว';
  const startV=async()=>{try{recRef.current=await createRecorder();recRef.current.start();setRec(true);}catch{alert('กรุณาอนุญาตใช้ไมค์ก่อนนะคะ 🙏');}};
  const stopV=async()=>{
    if(!recRef.current||!rec)return;
    setRec(false);setProc(true);
    const blob=await recRef.current.stop();
    const k=getApiKey();
    if(!k){setMsgs(m=>[...m,{role:'ai',text:'ยังไม่ได้ตั้งค่า API Key ค่ะ กรุณาใส่ที่เมนูตั้งค่าก่อนนะคะ 🙏'}]);setProc(false);return;}
    const tx=await transcribeAudio(blob,k);
    if(tx)setMsgs(m=>[...m,{role:'user',text:tx}]);
    const reply=await chatWithAI(tx||'...', k, PROMPT);
    setMsgs(m=>[...m,{role:'ai',text:reply||'ขอโทษค่ะ ไม่ได้ยินชัดเจน ลองพูดใหม่ได้เลยนะคะ 🙏'}]);
    setProc(false);
  };
  const last5=msgs.slice(-5);
  return <div style={{background:'#EEEDFE',minHeight:450,display:'flex',flexDirection:'column',padding:14,gap:8}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><div style={{width:36,height:36,borderRadius:'50%',background:'white',border:'2px solid '+C.pri,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{"🤖"}</div><div style={{fontSize:16,fontWeight:800,color:'#3C3489'}}>{"น้องแคร์"}</div></div>
    <div style={{flex:1,display:'flex',flexDirection:'column',gap:8,overflowY:'auto',maxHeight:280}}>
      {last5.map((m,i)=><div key={i} style={{display:'flex',justifyContent:m.role==='ai'?'flex-start':'flex-end'}}>
        <div style={{maxWidth:'80%',background:m.role==='ai'?'white':'#7F77DD',color:m.role==='ai'?'#3C3489':'#fff',borderRadius:m.role==='ai'?'4px 14px 14px 14px':'14px 4px 14px 14px',padding:'10px 14px',fontSize:GF.large,lineHeight:1.6,border:m.role==='ai'?'1px solid #AFA9EC':'none'}}>{m.text}</div>
      </div>)}
      {proc&&<div style={{display:'flex',justifyContent:'flex-start'}}><div style={{background:'white',borderRadius:'4px 14px 14px 14px',padding:'10px 14px',fontSize:GF.large,color:'#94A3B8',border:'1px solid #AFA9EC'}}>{"⏳ กำลังคิด…"}</div></div>}
    </div>
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,paddingTop:8,borderTop:'1px solid #AFA9EC'}}>
      <VoiceWave recording={rec} level={level}/>
      <button onPointerDown={startV} onPointerUp={stopV} onPointerLeave={rec?stopV:undefined}
        style={{width:86,height:86,borderRadius:'50%',background:rec?C.dan:C.pri,color:'#fff',fontSize:38,border:`4px solid ${rec?'rgba(239,68,68,.3)':'rgba(127,119,221,.3)'}`,cursor:'pointer',transition:'background .2s',userSelect:'none',WebkitUserSelect:'none',touchAction:'none'}}>{"🎙"}</button>
      <div style={{fontSize:GF.base,color:C.mid}}>{rec?'ปล่อยเมื่อพูดเสร็จ':'กดค้างเพื่อพูดค่ะ'}</div>
    </div>
  </div>;
}
function GUpcoming(){
  const[mode,sm]=useState('week');
  const[apptJob,setApptJob]=useState(()=>getJobs().find(j=>j.status!=='cancelled'&&j.status!=='completed'));
  useEffect(()=>{const load=()=>setApptJob(getJobs().find(j=>j.status!=='cancelled'&&j.status!=='completed'));load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const bd=apptJob?.bookingData||{};
  const dateStr=bd.schedule?.date||'วันพุธที่ 15 พฤษภาคม';
  const timeStr=bd.schedule?.time||'09:00';
  const dest=bd.locations?.dropoff||'รพ.จุฬาฯ';
  const assigned=apptJob?.assignedTo||null;
  return <div style={{background:'#fff',padding:14,display:'flex',flexDirection:'column',gap:10}}>
    <div style={{display:'flex',borderRadius:9,overflow:'hidden',border:'1px solid '+C.bdr}}>{[['week','🗓️ สัปดาห์หน้า'],['tmr','🌅 พรุ่งนี้']].map(([v,l])=><button key={v} onClick={()=>sm(v)} style={{flex:1,padding:'7px 0',border:'none',background:mode===v?C.pri:'#fff',color:mode===v?'#fff':C.mid,fontSize:GF.base-3,cursor:'pointer',fontWeight:mode===v?700:400}}>{l}</button>)}</div>
    {mode==='week'&&<><div style={{textAlign:'center'}}><div style={{fontSize:GF.large,fontWeight:800}}>{dateStr}</div><div style={{fontSize:GF.base,color:C.mid,marginTop:4}}>{dest+' · '+timeStr+' น.'}</div></div><div style={{background:'#E1F5EE',borderRadius:14,padding:12,border:'2px solid #1D9E75'}}><div style={{fontSize:GF.base,color:'#085041',lineHeight:1.8}}>{assigned?'จัดทีม '+assigned+' ให้แล้วค่ะ 💛\nจะมารับบ้านเวลา '+timeStr+' ค่ะ':'ลูกสาวจองให้แล้วค่ะ 💛\nจะมารับบ้านเวลา '+timeStr+' ค่ะ'}</div></div><button style={{width:'100%',height:GF.btn,borderRadius:12,background:C.suc,color:'#fff',border:'none',fontSize:GF.large,fontWeight:700,cursor:'pointer'}}>{"✅ รับทราบแล้วจ้า"}</button></>}
    {mode==='tmr'&&<><div style={{textAlign:'center'}}><div style={{fontSize:GF.large,fontWeight:800,color:C.dan}}>{"พรุ่งนี้แล้วค่ะ! 🌅"}</div></div><div style={{background:'#EEEDFE',borderRadius:14,padding:12,border:'2px solid '+C.pri}}><div style={{fontSize:GF.base,fontWeight:700,color:'#534AB7',marginBottom:8}}>{"สิ่งที่ต้องเตรียม"}</div>{[{ic:'🚫',t:'งดอาหารและน้ำตั้งแต่คืนนี้'},{ic:'📸',t:'เอกซเรย์ก่อนพบหมอนะคะ'},{ic:'💊',t:'นำยาที่กินอยู่มาด้วยค่ะ'}].map((r,i)=><div key={i} style={{display:'flex',gap:10,padding:'6px 0',borderBottom:'1px solid #AFA9EC',fontSize:GF.base,alignItems:'center'}}><span style={{fontSize:GF.large}}>{r.ic}</span>{r.t}</div>)}</div><button style={{width:'100%',height:GF.btn,borderRadius:12,background:C.suc,color:'#fff',border:'none',fontSize:GF.large,fontWeight:700,cursor:'pointer'}}>{"✅ รับทราบแล้วจ้า"}</button></>}
  </div>;
}
function GPINTimeline(){
  const[pin,sp]=useState('');const[step,ss]=useState(0);const[ok0,so0]=useState(false);const[ok1,so1]=useState(false);
  const[liveJob,setLiveJob]=useState(()=>getActiveJob());
  useEffect(()=>{const load=()=>setLiveJob(getActiveJob());load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const k=d=>{if(d==='⌫'){sp(p=>p.slice(0,-1));return;}if(pin.length<4){const np=pin+d;sp(np);if(np==='7421'){if(step===0){so0(true);setTimeout(()=>{sp('');ss(1);},600);}else{so1(true);}}}};
  const allOk=ok0&&ok1;
  const GSTEPS=[{l:'รับจากบ้านแล้ว',ic:'🏠'},{l:'ถึงโรงพยาบาลแล้ว',ic:'🏥'},{l:'กำลังรอพบหมอ',ic:'⏳'},{l:'รับยา',ic:'💊'},{l:'กลับบ้าน',ic:'🏡'}];
  const cpMap={};(liveJob?.checkpoints||[]).forEach(cp=>{const idx=GSTEPS.findIndex(s=>cp.label.includes(s.l.slice(0,4)));if(idx>=0)cpMap[idx]=cp.time;});
  // Also map standard care-team checkpoint labels to grandma labels
  const cpStd={'รับจากบ้าน':0,'ถึง รพ.':1,'รอพบแพทย์':2,'รอรับยา':3,'ส่งกลับบ้าน':4};
  (liveJob?.checkpoints||[]).forEach(cp=>{const idx=cpStd[cp.label];if(idx!==undefined)cpMap[idx]=cp.time;});
  const vitals=(liveJob?.checkpoints||[]).find(c=>c.vitals)?.vitals;
  const fmtT=iso=>{try{const d=new Date(iso);return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')+' น.';}catch{return'';}};
  const liveActiveIdx=GSTEPS.findIndex((_,i)=>!cpMap[i]);
  const ts=GSTEPS.map((s,i)=>{const done=cpMap[i]!==undefined;const active=i===liveActiveIdx;return{ic:done?'✅':active?'⏳':s.ic,d:done?'done':active?'active':'future',l:s.l,s:done?fmtT(cpMap[i]):active&&liveJob?.assignedTo?liveJob.assignedTo+' อยู่ด้วยค่ะ':''};});
  return <div style={{background:'#fff',padding:14,display:'flex',flexDirection:'column',gap:8}}>
    {!allOk&&<><div style={{textAlign:'center'}}><div style={{fontSize:GF.large,fontWeight:800}}>{"รถมาถึงแล้วค่ะ 🚗"}</div><div style={{fontSize:GF.base,color:C.mid}}>{"PIN ยืนยัน"+(step===0?'คุณทิพย์':'คุณสมชาย')+" (ลอง: 7421)"}</div></div><div style={{display:'flex',gap:10,justifyContent:'center',margin:'5px 0'}}>{[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${pin.length>i?C.pri:C.bdr}`,background:pin.length>i?C.pri:'transparent'}}/>)}</div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,maxWidth:200,margin:'0 auto'}}>{['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d,i)=><button key={i} onClick={()=>d&&k(d)} style={{height:46,background:d?'#fff':'transparent',border:d?'1px solid '+C.bdr:'none',borderRadius:8,fontSize:18,fontWeight:700,cursor:d?'pointer':'default',color:C.txt}}>{d}</button>)}</div></>}
    {allOk&&<div style={{background:'#ECFDF5',borderRadius:14,padding:12,textAlign:'center',border:'2px solid #1D9E75'}}><div style={{fontSize:32}}>{"✅"}</div><div style={{fontSize:GF.large,fontWeight:700,color:C.suc}}>{"ยืนยันแล้วค่ะ ขึ้นรถได้เลยนะคะ"}</div></div>}
    <HR/>
    <div style={{fontSize:GF.base,fontWeight:700,color:C.suc}}>{"● ติดตามสถานะวันนี้"}</div>
    {ts.map((s,i)=><div key={i} style={{display:'flex',gap:10,marginBottom:3,opacity:s.d==='future'?.4:1}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}><div style={{width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:GF.base,border:`2px solid ${s.d==='done'?C.suc:s.d==='active'?C.pri:C.bdr}`,background:s.d==='done'?'#ECFDF5':s.d==='active'?'#EEEDFE':'#fff'}}>{s.ic}</div>{i<ts.length-1&&<div style={{width:2,height:14,background:s.d==='done'?C.suc:C.bdr}}/>}</div>
      <div style={{paddingTop:6}}><div style={{fontSize:GF.base,fontWeight:s.d==='active'?700:500,color:s.d==='active'?C.pri:C.txt}}>{s.l}</div><div style={{fontSize:GF.base-4,color:C.mid}}>{s.s}</div></div>
    </div>)}
    {vitals&&<div style={{background:'#EFF6FF',borderRadius:10,padding:'8px 10px',border:'1px solid #BFDBFE',marginTop:4}}><div style={{fontSize:GF.base-2,color:'#1E3A8A',fontWeight:700,marginBottom:2}}>{"🩺 ข้อมูลสุขภาพวันนี้"}</div>{vitals.bp&&<div style={{fontSize:GF.base-2,color:C.txt}}>{"ความดัน: "+vitals.bp}</div>}{vitals.spo2&&<div style={{fontSize:GF.base-2,color:C.txt}}>{"SpO2: "+vitals.spo2+"%"}</div>}</div>}
  </div>;
}
function GPraise(){
  const[score,setScore]=useState(0);const[hover,setHover]=useState(0);
  const[submitted,setSubmitted]=useState(false);
  const[rec,setRec]=useState(false);const[voiceUrl,setVUrl]=useState(null);
  const recRef=useRef(null);
  const level=useAudioLevel(recRef,rec);
  const startVoice=async()=>{try{recRef.current=await createRecorder();recRef.current.start();setRec(true);}catch(e){console.error(e);}};
  const stopVoice=async()=>{if(!recRef.current||!rec)return;setRec(false);try{const blob=await recRef.current.stop();setVUrl(URL.createObjectURL(blob));}catch(e){console.error(e);}};
  const submit=()=>{const j=getJobs().find(j=>j.status==='completed');if(j&&score>0){addRating(j.jobId,score,voiceUrl||undefined);setSubmitted(true);}else if(score>0)setSubmitted(true);};
  const careTeam=getJobs().find(j=>j.status==='completed')?.assignedTo||'คุณทิพย์';
  if(submitted)return<div style={{background:'#fff',padding:14,textAlign:'center'}}><div style={{fontSize:48,marginBottom:8}}>{"🙏"}</div><div style={{fontSize:GF.large,fontWeight:800,color:C.suc}}>{"ขอบคุณมากค่ะ!"}</div><div style={{fontSize:GF.base,color:C.mid,marginTop:4}}>{"คะแนน "+score+" ดาว · "+careTeam}</div>{voiceUrl&&<audio controls src={voiceUrl} style={{width:'100%',height:32,marginTop:8}}/>}</div>;
  return<div style={{background:'#fff',padding:14,display:'flex',flexDirection:'column',gap:10}}>
    <div style={{textAlign:'center'}}><div style={{fontSize:36,marginBottom:6}}>{"🏡"}</div><div style={{fontSize:GF.large,fontWeight:800}}>{"กลับถึงบ้านแล้วค่ะ"}</div><div style={{fontSize:GF.base,color:C.mid,marginTop:4}}>{"ชอบ"+careTeam+"ไหมคะ?"}</div></div>
    <div style={{display:'flex',gap:8,justifyContent:'center'}}>{[1,2,3,4,5].map(i=><span key={i} onClick={()=>setScore(i)} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(0)} style={{fontSize:36,cursor:'pointer',color:i<=(hover||score)?'#EF9F27':'#CBD5E1',transition:'color .15s'}}>{i<=(hover||score)?'★':'☆'}</span>)}</div>
    <div onPointerDown={startVoice} onPointerUp={stopVoice} onPointerLeave={rec?stopVoice:undefined}
      style={{width:'100%',padding:'10px 14px',borderRadius:14,background:rec?C.dan+'10':'#FAECE7',border:`2px solid ${rec?C.dan:'#D85A30'}`,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',touchAction:'none',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
      {rec?<VoiceWave recording={rec} level={level}/>:<div style={{color:'#D85A30',fontSize:GF.base,fontWeight:700}}>{"❤️ กดค้างพูดบอกความรู้สึก"}</div>}
    </div>
    {voiceUrl&&<audio controls src={voiceUrl} style={{width:'100%',height:32}}/>}
    {score>0&&<button onClick={submit} style={{width:'100%',padding:14,borderRadius:12,background:C.suc,color:'#fff',border:'none',fontSize:GF.large,fontWeight:700,cursor:'pointer'}}>{"ส่งความคิดเห็น ✅"}</button>}
  </div>;
}
function GMed(){return <div style={{background:'#fff',padding:14,display:'flex',flexDirection:'column',gap:10}}><div style={{textAlign:'center'}}><div style={{fontSize:40,marginBottom:6}}>{"💊"}</div><div style={{fontSize:GF.large,fontWeight:800}}>{"ถึงเวลากินยาค่ะ"}</div></div><div style={{background:'#F8FAFC',borderRadius:12,padding:12,border:'1px solid '+C.bdr}}>{[{ic:'🔵',n:'AMLODIPINE 5mg',d:'ความดัน · 1 เม็ด'},{ic:'⚪',n:'Multivitamin',d:'บำรุง · 1 เม็ด'}].map((item,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:i===0?'1px solid '+C.bdr:'none'}}><div style={{width:38,height:38,borderRadius:'50%',background:'#EEEDFE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{item.ic}</div><div><div style={{fontSize:GF.large,fontWeight:600}}>{item.n}</div><div style={{fontSize:GF.base-4,color:C.mid}}>{item.d}</div></div></div>)}</div><button style={{width:'100%',height:GF.btn,borderRadius:12,background:C.suc,color:'#fff',border:'none',fontSize:GF.large,fontWeight:700,cursor:'pointer'}}>{"✅ กินยาแล้ว — แจ้งลูกสาว"}</button></div>;}

// ── CARE TEAM ─────────────────────────────────────────────────────
function PatientBrief(){
  const{booking}=useCtx();
  const[job,setJob]=useState(()=>getActiveJob());
  const MOB={'independent':'เดินได้เอง','assisted':'ต้องช่วยพยุง','wheelchair':'วีลแชร์','bedridden':'ติดเตียง'};
  useEffect(()=>{const load=()=>setJob(getActiveJob());window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const bd=job?.bookingData||{};
  if(job){
    return <div style={{background:'#EEEDFE',border:'1px solid #AFA9EC',borderRadius:9,padding:'8px 10px',marginBottom:6,flexShrink:0}}>
      <div style={{fontWeight:700,color:C.pri,fontSize:11,marginBottom:3}}>{"📋 "+(bd.patient?.name||'-')+" · "+(MOB[bd.patient?.mobilityLevel]||'-')}</div>
      <div style={{fontSize:9,color:C.txt,lineHeight:1.7}}>{"📍 "+(bd.locations?.pickup||'-')+" → "+(bd.locations?.dropoff||'-')}</div>
      <div style={{fontSize:9,color:C.txt}}>{"📞 "+(bd.contact?.name||'-')+" · "+(bd.contact?.phone||'-')}</div>
      <div style={{display:'flex',gap:4,marginTop:5,flexWrap:'wrap'}}>
        <Tag ch={[bd.schedule?.date,bd.schedule?.time].filter(Boolean).join(' ')||'-'} col={C.pri}/>
        <Tag ch={job.jobId} col={C.mid}/>
        {job.assignedTo&&<Tag ch={"👤 "+job.assignedTo} col={C.suc}/>}
      </div>
    </div>;
  }
  return <div style={{background:'#EEEDFE',border:'1px solid #AFA9EC',borderRadius:9,padding:'8px 10px',marginBottom:6,flexShrink:0}}>
    <div style={{fontWeight:700,color:C.pri,fontSize:11,marginBottom:3}}>{"📋 คุณแม่มุก · อายุ 72 · ความดัน"}</div>
    <div style={{fontSize:9,color:C.txt,lineHeight:1.7}}>{"📍 ลาดพร้าว ซ.12 → รพ.จุฬาฯ ตึก ภปร ชั้น 3\n⚠️ งดอาหาร/น้ำ · X-Ray ก่อนพบแพทย์ · ⚠️ แพ้ Aspirin"}</div>
    <div style={{background:'#F8FAFC',borderRadius:6,padding:'4px 7px',marginTop:5,fontSize:8,color:C.mid}}>{"💬 Ice-breaking: ชอบขนมหวาน 🍮 · ไม่ชอบแมว 🐱 · หลาน 2 คน ม.ปลาย"}</div>
    <div style={{display:'flex',gap:4,marginTop:5,flexWrap:'wrap'}}>
      {booking.transport_go==='grab'?<Tag ch="🚕 Grab" col={C.tel}/>:<Tag ch="🚐 คุณสมชาย" col={C.tel}/>}
      <Tag ch="🤝 คุณทิพย์ PN" col={C.suc}/>
      {booking.has_dulaeh&&<Tag ch="💊 คุณนิภา" col={C.wrn}/>}
    </div>
  </div>;
}

function CTOpContact(){
  const[rec,setRec]=useState(false);const[proc,setProc]=useState(false);
  const[tx,setTx]=useState('');const[sent,setSent]=useState(false);
  const recRef=useRef(null);
  const level=useAudioLevel(recRef,rec);
  const startV=async()=>{try{recRef.current=await createRecorder();recRef.current.start();setRec(true);}catch{alert('ไม่สามารถเข้าถึงไมค์ได้ค่ะ');}};
  const stopV=async()=>{
    if(!recRef.current||!rec)return;
    setRec(false);setProc(true);
    const blob=await recRef.current.stop();
    const k=getApiKey();
    if(k){const t=await transcribeAudio(blob,k);if(t){setTx(t);const j=getActiveJob();if(j)addCheckpointWithData(j.jobId,'Voice Report',{note:t});}}
    setProc(false);
  };
  return <div style={{background:C.bg}}>
    <div style={{background:C.lin,padding:'8px 11px',display:'flex',alignItems:'center',gap:8}}><div style={{width:24,height:24,background:'white',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>{"🤖"}</div><span style={{color:'white',fontWeight:700,fontSize:11}}>{"น้องแคร์ + ติดต่อ Ops"}</span></div>
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 12px',gap:8}}>
      <VoiceWave recording={rec} level={level}/>
      <button onPointerDown={startV} onPointerUp={stopV} onPointerLeave={rec?stopV:undefined}
        style={{width:62,height:62,borderRadius:'50%',background:rec?C.dan:C.pri,color:'#fff',fontSize:24,border:`3px solid ${rec?'rgba(239,68,68,.25)':'rgba(127,119,221,.25)'}`,cursor:'pointer',marginTop:rec?0:10,transition:'background .2s',userSelect:'none',WebkitUserSelect:'none',touchAction:'none'}}>{"🎙"}</button>
      <div style={{fontSize:11,color:C.mid}}>{rec?'ปล่อยเมื่อพูดเสร็จ':proc?'⏳ กำลังถอดความ…':'กดค้างรายงานให้ Ops'}</div>
      {tx&&<div style={{width:'100%',background:'#F8FAFC',border:'1px solid '+C.bdr,borderRadius:8,padding:'7px 9px',fontSize:10,color:C.txt,lineHeight:1.6,fontStyle:'italic'}}>{"\""+tx+"\""}</div>}
      {tx&&!sent&&<Btn ch="📤 ส่ง Ops →" col={C.pri} s={{width:'100%'}} fn={()=>setSent(true)}/>}
      {sent&&<Alrt t="success" ch="✅ ส่ง Ops แล้วค่ะ · จะได้รับการตอบกลับเร็วๆ นี้"/>}
      <HR/>
      <div style={{width:'100%'}}><div style={{fontSize:10,fontWeight:700,marginBottom:5}}>{"📞 ติดต่อ Operation"}</div>
        {[{col:C.suc,ic:'🟢',l:'ไม่เร่งด่วน',s:'ตอบใน 1 ชม.'},{col:C.wrn,ic:'🟡',l:'รอคำตอบ',s:'ตอบใน 15 นาที'},{col:C.dan,ic:'🔴',l:'ฉุกเฉิน — โทรทันที',s:''}].map((b,i)=>(
          <button key={i} style={{width:'100%',padding:'7px 9px',borderRadius:8,marginBottom:4,display:'flex',alignItems:'center',gap:8,border:`1px solid ${b.col}30`,background:`${b.col}10`,cursor:'pointer'}}><span style={{fontSize:13}}>{b.ic}</span><div style={{fontSize:11,fontWeight:700,color:b.col}}>{b.l}{b.s&&<div style={{fontSize:9,color:C.mid,fontWeight:400}}>{b.s}</div>}</div></button>
        ))}
      </div>
    </div>
  </div>;
}

// CTJobBoard with income graph (instruction 15)
function CTJobBoard({goTo,myTier}){
  const[wage,sw]=useState(1500);const[avail,sa]=useState([2,3,4]);
  const[lsJobs,setLsJobs]=useState([]);const[acceptedId,setAcceptedId]=useState(null);const[showAll,setShowAll]=useState(false);
  const days=['จ','อ','พ','พฤ','ศ','ส','อา'];
  const SVC={'hospital-visit':'🤝 เพื่อนหาหมอ','dialysis':'🩸 ล้างไต','chemotherapy':'💉 เคมีบำบัด','radiation':'☢️ รังสีรักษา','physical-therapy':'🏃 กายภาพบำบัด','checkup':'🔍 ตรวจสุขภาพ','vaccination':'💉 วัคซีน','other':'🏥 บริการทั่วไป'};
  const TR={'independent':'CG','assisted':'CG','wheelchair':'PN','bedridden':'RN'};
  useEffect(()=>{const load=()=>{try{const sv=JSON.parse(localStorage.getItem('welcares_bookings')||'[]');setLsJobs(sv.filter(b=>b.status!=='cancelled').map(b=>{const bd=b.bookingData||{};return{type:SVC[bd.service?.type]||'🏥 งานใหม่',hosp:bd.locations?.dropoff||'-',date:[bd.schedule?.date,bd.schedule?.time].filter(Boolean).join(' ')||'-',pay:'฿1,500',tier:TR[bd.patient?.mobilityLevel]||'CG',ok:true,jobId:b.jobId,patient:bd.patient?.name,status:b.status||'pending',isNew:true};}));}catch{setLsJobs([]);}};load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const handleAccept=jobId=>{assignJob(jobId,'คุณรู้ใจ');setAcceptedId(jobId);if(goTo)setTimeout(()=>goTo(0),1800);};
  const allJobs=[...lsJobs,{type:'🤝 เพื่อนหาหมอ',hosp:'รพ.ศิริราช',date:'20 พ.ค.',pay:'฿1,680',tier:'PN',ok:true},{type:'🤝 เพื่อนหาหมอ',hosp:'รพ.จุฬา',date:'21 พ.ค.',pay:'฿1,200',tier:'CG',ok:false},{type:'🚗 รถรับส่ง',hosp:'รพ.กลาง',date:'23 พ.ค.',pay:'฿500',tier:'Driver',ok:true}];
  const jobs=showAll||!myTier?allJobs:allJobs.filter(j=>!j.tier||j.tier===myTier);
  return <div style={{background:C.bg}}>
    <AB t="📋 รับงาน + ตารางเวลา" bg={C.drk}/>
    <div style={{padding:'8px 9px'}}>
      <ST ic="💰" ch="EOD รายได้"/>
      <IncomeGraph/>
      <div style={{display:'flex',gap:4,marginBottom:5}}>
        <div style={{flex:1,background:'#E1F5EE',border:'1px solid #9FE1CB',borderRadius:8,padding:'7px',textAlign:'center'}}><div style={{fontSize:13,fontWeight:700,color:'#085041'}}>{"฿8,400"}</div><div style={{fontSize:8,color:C.suc}}>{"ถอนได้เลย"}</div><Btn ch="ถอน" col={C.suc} sm s={{marginTop:3,fontSize:9}}/></div>
        <div style={{flex:1,background:'#FAEEDA',border:'1px solid #FAC775',borderRadius:8,padding:'7px',textAlign:'center'}}><div style={{fontSize:13,fontWeight:700,color:'#633806'}}>{"฿9,950"}</div><div style={{fontSize:8,color:'#854F0B'}}>{"เดือนนี้"}</div></div>
      </div>
      <HR/>
      <ST ic="📆" ch="เพิ่มวันรับงาน"/>
      <div style={{display:'flex',gap:2,marginBottom:6}}>{days.map((d,i)=><div key={i} onClick={()=>sa(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i])} style={{flex:1,borderRadius:6,padding:'4px 2px',textAlign:'center',fontSize:8,border:`1px solid ${avail.includes(i)?C.suc:C.bdr}`,background:avail.includes(i)?'#ECFDF5':'#F8FAFC',color:avail.includes(i)?C.suc:C.mid,cursor:'pointer',fontWeight:avail.includes(i)?700:400}}>{d}{avail.includes(i)&&<div style={{fontSize:6}}>{"✓"}</div>}</div>)}</div>
      <HR/>
      <ST ic="📋" ch={"งานที่เปิดรับ ("+jobs.length+")"}/>
      {myTier&&<div style={{display:'flex',gap:3,marginBottom:4}}><button onClick={()=>setShowAll(false)} style={{flex:1,padding:'3px 6px',borderRadius:5,border:`1px solid ${!showAll?C.pri:C.bdr}`,background:!showAll?C.pri:'#fff',color:!showAll?'#fff':C.mid,fontSize:8,cursor:'pointer',fontWeight:!showAll?700:400}}>{"งานที่เหมาะกับฉัน"}</button><button onClick={()=>setShowAll(true)} style={{flex:1,padding:'3px 6px',borderRadius:5,border:`1px solid ${showAll?C.pri:C.bdr}`,background:showAll?C.pri:'#fff',color:showAll?'#fff':C.mid,fontSize:8,cursor:'pointer',fontWeight:showAll?700:400}}>{"ทั้งหมด"}</button></div>}
      {jobs.map((j,i)=><Crd key={i} s={{opacity:j.ok?1:.5,borderLeft:j.isNew?'3px solid '+C.org:undefined}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:2}}>
          <div><div style={{fontSize:10,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>{j.isNew&&<Tag ch={j.status==='assigned'?'✅ รับแล้ว':'🆕 ใหม่'} col={j.status==='assigned'?C.suc:C.org}/>}{j.type}</div><div style={{fontSize:9,color:C.mid}}>{j.hosp}{j.patient&&(' · 👤 '+j.patient)}</div>{j.jobId&&<div style={{fontSize:8,color:'#94A3B8'}}>{j.jobId}</div>}</div>
          <Tag ch={j.pay} col={j.ok?C.suc:C.mid}/>
        </div>
        <div style={{fontSize:9,color:C.mid,marginBottom:3}}>{j.date+" · "}<Tag ch={j.tier} col={C.pri}/></div>
        {j.ok?(j.status==='assigned'?<div style={{fontSize:9,color:C.suc,fontWeight:700}}>{"✅ รับงานนี้แล้ว"}</div>:<Btn ch="รับงานนี้ →" col={C.suc} sm fn={()=>j.jobId&&handleAccept(j.jobId)}/>):<div style={{fontSize:9,color:C.dan}}>{"🔒 Tier ไม่ถึง"}</div>}
      </Crd>)}
      {acceptedId&&(()=>{const _j=lsJobs.find(j=>j.jobId===acceptedId);return _j?<Crd s={{background:'#ECFDF5',border:'2px solid '+C.suc}}><div style={{fontWeight:700,color:C.suc,marginBottom:4}}>{"✅ รับงานแล้ว!"}</div><div style={{fontSize:9,color:C.mid}}>{"👤 "+(_j.patient||'-')+" · 🕐 "+_j.date}</div><div style={{fontSize:8,color:'#94A3B8',marginBottom:3}}>{_j.hosp}</div><div style={{background:'#1E3A8A',borderRadius:6,padding:'4px 8px',marginTop:4,textAlign:'center'}}><div style={{fontSize:7,color:'rgba(255,255,255,0.6)'}}>{"🔐 PIN"}</div><div style={{fontSize:20,fontWeight:900,letterSpacing:6,color:'#93C5FD'}}>{"7421"}</div></div>{goTo&&<Btn ch="→ ไปที่งานเลย" col={C.suc} s={{width:'100%',marginTop:4}} fn={()=>goTo(0)}/>}</Crd>:null;})()}
    </div>
  </div>;
}

function CloseHearts(){
  const[hearts,sh]=useState({s1:null,s2:null});const[closed,setClosed]=useState(false);
  const[rec,setRec]=useState(false);const[processing,setProc]=useState(false);
  const[voiceUrl,setVoiceUrl]=useState(null);const[transcript,setTranscript]=useState('');
  const[sentiment,setSentiment]=useState(null);
  const recRef=useRef(null);
  const level=useAudioLevel(recRef,rec);
  const toggle=(k,t)=>sh(h=>({...h,[k]:h[k]===t?null:t}));
  const handleClose=()=>{const j=getActiveJob();if(j)updateJob(j.jobId,{status:'completed'});setClosed(true);};
  const startRec=async()=>{
    try{recRef.current=await createRecorder();recRef.current.start();setRec(true);}
    catch(e){console.error(e);alert('ไม่สามารถเข้าถึงไมโครโฟนได้ค่ะ กรุณาอนุญาตในเบราว์เซอร์');}
  };
  const stopRec=async()=>{
    if(!recRef.current)return;setRec(false);setProc(true);
    try{
      const blob=await recRef.current.stop();
      const url=URL.createObjectURL(blob);setVoiceUrl(url);
      const j=getActiveJob();if(j)updateVoiceData(j.jobId,{url});
      const k=getApiKey();
      if(k){
        const tx=await transcribeAudio(blob,k);
        if(tx){setTranscript(tx);if(j)updateVoiceData(j.jobId,{url,transcript:tx});}
        const s=await analyzeTranscript(tx||'',k);
        setSentiment(s);if(j)updateVoiceData(j.jobId,{url,transcript:tx,sentiment:s});
      }
    }catch(e){console.error(e);}finally{setProc(false);}
  };
  const scoreCol=s=>s>=4?C.suc:s>=3?C.wrn:C.dan;
  return <div style={{padding:'8px 9px',background:C.bg}}>
    <Crd s={{background:'#ECFDF5',border:'1px solid #6EE7B7',textAlign:'center'}}><div style={{fontSize:16}}>{"✅"}</div><div style={{fontWeight:700,color:C.suc}}>{"ส่งคุณยายถึงบ้านแล้ว"}</div></Crd>
    <Crd><ST ic="🎙" ch="อัดเสียงสรุปวันนี้"/>
      <VoiceWave recording={rec} level={level}/>
      {processing&&<div style={{fontSize:9,color:C.pri,marginBottom:4}}>{"⏳ กำลังถอดความ + วิเคราะห์…"}</div>}
      {voiceUrl&&!rec&&!processing&&<audio controls src={voiceUrl} style={{width:'100%',height:28,marginBottom:4}}/>}
      {transcript&&<div style={{fontSize:9,color:C.txt,background:'#F8FAFC',borderRadius:6,padding:'5px 7px',marginBottom:4,lineHeight:1.6,fontStyle:'italic'}}>{"\""+transcript.slice(0,120)+(transcript.length>120?'…':'')+"\""}</div>}
      {sentiment&&<div style={{display:'flex',gap:3,marginBottom:4}}><div style={{flex:1,textAlign:'center',background:scoreCol(sentiment.score)+'15',borderRadius:5,padding:'3px 0',fontSize:8,color:scoreCol(sentiment.score),fontWeight:700}}>{"คะแนน "+sentiment.score+"/5"}</div><div style={{flex:2,textAlign:'center',background:(sentiment.flags.length?C.dan:C.suc)+'15',borderRadius:5,padding:'3px 0',fontSize:8,color:sentiment.flags.length?C.dan:C.suc,fontWeight:700}}>{sentiment.flags.length?'⚠️ '+sentiment.flags.join(', '):'✅ ไม่มีความเสี่ยง'}</div></div>}
      <Btn ch={rec?'⏹ หยุดอัด':voiceUrl?'🔄 อัดใหม่':'🎙 เริ่มอัด'} col={rec?C.dan:C.pri} s={{width:'100%'}} fn={rec?stopRec:startRec} disabled={processing}/>
    </Crd>
    <Crd><ST ic="💝" ch="ขอบคุณเพื่อนร่วมงาน"/><div style={{fontSize:9,color:'#94A3B8',marginBottom:5}}>{"❤️ แดง = ส่งให้เพื่อน · 🖤 ดำ = Ops เท่านั้น"}</div>
      {[{k:'s1',n:'คุณสมชาย',ic:'🚗'},{k:'s2',n:'คุณนิภา',ic:'💊'}].map(m=><div key={m.k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid '+C.bdr}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:16}}>{m.ic}</span><span style={{fontWeight:700,fontSize:11}}>{m.n}</span></div>
        <div style={{display:'flex',gap:5}}>{['red','black'].map(t=><button key={t} onClick={()=>toggle(m.k,t)} style={{width:30,height:30,borderRadius:'50%',background:hearts[m.k]===t?(t==='red'?'#FFF1F2':'#1E293B'):'#F8FAFC',border:`2px solid ${hearts[m.k]===t?(t==='red'?C.dan:'#1E293B'):C.bdr}`,fontSize:13,cursor:'pointer'}}>{t==='red'?'❤️':'🖤'}</button>)}</div>
      </div>)}
    </Crd>
    {closed?<Crd s={{background:'#ECFDF5',border:'2px solid '+C.suc,textAlign:'center'}}><div style={{fontSize:26,marginBottom:4}}>{"🎉"}</div><div style={{fontWeight:700,color:C.suc,fontSize:12}}>{"ปิดงานเรียบร้อยแล้วค่ะ!"}</div><div style={{fontSize:9,color:C.mid,marginTop:2}}>{"ขอบคุณสำหรับงานวันนี้นะคะ 💛"}</div></Crd>:<Btn ch="🏁 ปิดงานวันนี้" col={C.suc} s={{width:'100%'}} fn={handleClose}/>}
  </div>;
}

// Care Team Home pages (no SOS)
function RHomeMain({openHam,goTo}){
  const[todayJob,setTodayJob]=useState(null);
  const MOB={'independent':'เดินได้เอง','assisted':'ต้องช่วยพยุง','wheelchair':'วีลแชร์','bedridden':'ติดเตียง'};
  useEffect(()=>{const load=()=>{const j=getJobs().find(j=>j.status==='assigned');setTodayJob(j||null);};load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const bd=todayJob?.bookingData||{};
  return <div style={{background:C.bg}}>
    <div style={{background:C.drk,padding:'8px 11px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <button onClick={openHam} style={{background:'none',border:'none',color:'white',fontSize:15,cursor:'pointer',padding:0}}>{"☰"}</button>
      <span style={{color:'white',fontWeight:700,fontSize:11}}>{"คุณทิพย์ "}<Tag ch="PN" col='#93C5FD'/></span>
      <span style={{color:'white',fontSize:11}}>{"🔔"}</span>
    </div>
    <div style={{padding:'8px 9px'}}>
      <div style={{display:'flex',gap:4,marginBottom:5}}>
        <div style={{flex:1,background:'#E1F5EE',border:'1px solid #9FE1CB',borderRadius:8,padding:'6px',textAlign:'center'}}><div style={{fontSize:13,fontWeight:700,color:'#085041'}}>{"฿8,400"}</div><div style={{fontSize:8,color:C.suc}}>{"ถอนได้เลย"}</div><Btn ch="ถอน" col={C.suc} sm s={{marginTop:3,fontSize:9}}/></div>
        <div style={{flex:1,background:'#FAEEDA',border:'1px solid #FAC775',borderRadius:8,padding:'6px',textAlign:'center'}}><div style={{fontSize:13,fontWeight:700,color:'#633806'}}>{"฿1,500"}</div><div style={{fontSize:8,color:'#854F0B'}}>{"งานวันนี้"}</div></div>
      </div>
      {todayJob?<Crd s={{background:'#EEEDFE',border:'1px solid #AFA9EC'}}><div style={{fontWeight:700,color:C.pri}}>{"⏰ งานวันนี้ "+(bd.schedule?.time||'09:00')}</div><div style={{fontSize:9,color:C.mid}}>{(bd.locations?.dropoff||'รพ.')+' · '+(bd.patient?.name||'-')+' · '+(MOB[bd.patient?.mobilityLevel]||'-')}</div><div style={{fontSize:8,color:'#94A3B8',marginTop:2}}>{todayJob.jobId}</div>{goTo&&<Btn ch="→ เริ่มงานเลย" col={C.pri} sm s={{marginTop:4,width:'100%'}} fn={()=>goTo(1)}/>}</Crd>:<Crd s={{background:'#EEEDFE',border:'1px solid #AFA9EC'}}><div style={{fontWeight:700,color:C.pri}}>{"⏰ งานวันนี้ 09:00"}</div><div style={{fontSize:9,color:C.mid}}>{"รพ.จุฬาฯ · คุณแม่มุก · วีลแชร์"}</div></Crd>}
      <ST ic="📅" ch="งานสัปดาห์นี้"/>
      <Crd><div style={{fontSize:9,lineHeight:1.9,color:C.mid}}>{"พ 15 พ.ค. 09:00 — แม่มุก · ฿1,500\n14:00 — ยายวิมล · ฿1,200"}</div></Crd>
    </div>
  </div>;
}

// RJobToday enhanced — photo capture + vitals
function RJobToday(){
  const[job,setJob]=useState(()=>getActiveJob());
  const[stepPhotos,setStepPhotos]=useState({});
  const[pendingPhotoStep,setPending]=useState(null);
  const[bp,setBp]=useState('');const[spo2,setSpo2]=useState('');
  const photoRef=useRef(null);
  const STEPS=[{l:'รับจากบ้าน',ic:'🏠',photo:true},{l:'ถึง รพ.',ic:'🏥',photo:true},{l:'รอพบแพทย์',ic:'👨‍⚕️',vitals:true},{l:'รอรับยา',ic:'💊'},{l:'ส่งกลับบ้าน',ic:'🏡',vitals:true}];
  useEffect(()=>{const load=()=>setJob(getActiveJob());window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const cpMap={};(job?.checkpoints||[]).forEach(cp=>{cpMap[cp.label]=cp.time;});
  const cpPhotoMap={};(job?.checkpoints||[]).forEach(cp=>{if(cp.photo)cpPhotoMap[cp.label]=cp.photo;});
  const cpVitals=(job?.checkpoints||[]).find(cp=>cp.vitals)?.vitals;
  const activeIdx=STEPS.findIndex(s=>!cpMap[s.l]);
  const handleStep=l=>{if(job&&!cpMap[l])addCheckpoint(job.jobId,l);};
  const fmtTime=iso=>{try{const d=new Date(iso);return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');}catch{return'';}};
  const triggerPhoto=l=>{setPending(l);photoRef.current?.click();};
  const onPhotoChange=e=>{
    const f=e.target.files?.[0];if(!f||!pendingPhotoStep)return;
    const r=new FileReader();r.onload=ev=>{
      const b64=ev.target.result;
      setStepPhotos(p=>({...p,[pendingPhotoStep]:b64}));
      if(job)addCheckpointWithData(job.jobId,pendingPhotoStep,{photo:b64});
    };r.readAsDataURL(f);
    e.target.value='';setPending(null);
  };
  const saveVitals=()=>{if(job&&(bp||spo2)){addCheckpointWithData(job.jobId,'vitals',{vitals:{bp,spo2}});setBp('');setSpo2('');}};
  const showVitalsStep=STEPS[activeIdx]?.vitals;
  return <div style={{padding:'8px 9px',background:C.bg}}>
    <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={onPhotoChange}/>
    <PatientBrief/>
    <div style={{background:'#1E3A8A',borderRadius:9,padding:'7px 10px',marginBottom:6,textAlign:'center'}}><div style={{fontSize:8,color:'rgba(255,255,255,0.6)',marginBottom:2}}>{"🔐 PIN ยืนยันตัวตน"}</div><div style={{fontSize:28,fontWeight:900,letterSpacing:8,color:'#93C5FD'}}>{"7421"}</div></div>
    {STEPS.map((s,i)=>{const done=!!cpMap[s.l];const active=i===activeIdx;const ph=cpPhotoMap[s.l]||stepPhotos[s.l];return<div key={i} style={{marginBottom:3}}>
      <div onClick={()=>active&&handleStep(s.l)} style={{display:'flex',alignItems:'center',gap:7,padding:'5px 8px',borderRadius:8,background:done?'#ECFDF5':active?C.pri:'#fff',border:`1px solid ${done?'#6EE7B7':active?C.pri:C.bdr}`,cursor:active?'pointer':'default'}}>
        <span style={{fontSize:14}}>{done?'✅':s.ic}</span>
        <div style={{flex:1,fontSize:10,fontWeight:active?700:400,color:active?'#fff':done?C.suc:C.txt}}>{s.l}{active&&<span style={{fontSize:8,opacity:0.7}}>{" · กดเพื่อบันทึก"}</span>}</div>
        {done&&s.photo&&<div onClick={e=>{e.stopPropagation();triggerPhoto(s.l);}} style={{fontSize:10,cursor:'pointer',padding:'2px 5px',borderRadius:4,background:ph?'transparent':'rgba(255,255,255,0.15)',color:ph?C.suc:'rgba(255,255,255,0.7)'}}>{ph?'📷✅':'📷'}</div>}
        {cpMap[s.l]&&<span style={{fontSize:8,color:active?'rgba(255,255,255,0.6)':C.mid}}>{fmtTime(cpMap[s.l])}</span>}
      </div>
      {ph&&<img src={ph} style={{width:'100%',height:54,objectFit:'cover',borderRadius:'0 0 7px 7px',border:'1px solid '+C.bdr,borderTop:'none'}}/>}
    </div>;})}
    {showVitalsStep&&activeIdx>=0&&<Crd s={{border:'1px solid '+C.wrn+'60',background:'#FFFBEB'}}>
      <ST ic="🩺" ch="บันทึก Vitals (optional)"/>
      <div style={{display:'flex',gap:5,marginBottom:4}}>
        <input value={bp} onChange={e=>setBp(e.target.value)} placeholder="BP เช่น 120/80" style={{flex:1,padding:'5px 7px',borderRadius:6,border:'1px solid '+C.bdr,fontSize:9,outline:'none'}}/>
        <input value={spo2} onChange={e=>setSpo2(e.target.value)} placeholder="SpO2 %" style={{flex:1,padding:'5px 7px',borderRadius:6,border:'1px solid '+C.bdr,fontSize:9,outline:'none'}}/>
      </div>
      {cpVitals?<div style={{fontSize:9,color:C.suc}}>{"✅ บันทึกแล้ว · BP "+cpVitals.bp+" · SpO2 "+cpVitals.spo2+"%"}</div>:<Btn ch="💾 บันทึก Vitals" col={C.wrn} sm s={{width:'100%'}} fn={saveVitals}/>}
    </Crd>}
    {activeIdx===-1&&job&&<Alrt t="success" ch="✅ ครบทุกขั้นตอนแล้วค่ะ — กด 🏁 ปิดงานได้เลยค่ะ"/>}
    <div style={{display:'flex',gap:4,marginTop:6}}>
      <div onClick={()=>activeIdx>=0&&triggerPhoto(STEPS[activeIdx]?.l)} style={{flex:1,padding:'8px 6px',textAlign:'center',borderRadius:8,border:`1.5px solid ${Object.keys(stepPhotos).length>0?C.suc:C.bdr}`,background:Object.keys(stepPhotos).length>0?'#ECFDF5':'#F8FAFC',cursor:'pointer'}}>
        <div style={{fontSize:18}}>{Object.keys(stepPhotos).length>0?'✅':'📷'}</div>
        <div style={{fontSize:8,color:Object.keys(stepPhotos).length>0?C.suc:C.mid}}>{"ถ่ายรูป"+(Object.keys(stepPhotos).length>0?' ('+Object.keys(stepPhotos).length+'รูป)':'')}</div>
      </div>
      <div style={{flex:1,padding:'8px 6px',textAlign:'center',borderRadius:8,border:'1.5px solid '+C.bdr,background:'#F8FAFC',cursor:'pointer'}}>
        <div style={{fontSize:18}}>{"📍"}</div>
        <div style={{fontSize:8,color:C.mid}}>{"แชร์ Location"}</div>
      </div>
    </div>
  </div>;
}

function KHomeMain({openHam,goTo}){
  const[todayJob,setTodayJob]=useState(null);
  const MOB={'wheelchair':'วีลแชร์ 🚐','bedridden':'เปล 🚑','assisted':'ต้องพยุง','independent':'เดินได้เอง'};
  useEffect(()=>{const load=()=>{const j=getJobs().find(j=>j.status==='assigned');setTodayJob(j||null);};load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const bd=todayJob?.bookingData||{};
  return <div style={{background:C.bg}}>
    <div style={{background:C.drk,padding:'8px 11px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <button onClick={openHam} style={{background:'none',border:'none',color:'white',fontSize:15,cursor:'pointer',padding:0}}>{"☰"}</button>
      <span style={{color:'white',fontWeight:700,fontSize:11}}>{"คุณสมชาย "}<Tag ch="Driver" col='#5DCAA5'/></span>
      <span style={{color:'white',fontSize:11}}>{"🔔"}</span>
    </div>
    <div style={{padding:'8px 9px'}}>
      {todayJob?<Crd s={{background:'#EEEDFE',border:'1px solid #AFA9EC'}}><div style={{fontWeight:700,color:C.pri}}>{"⏰ "+(bd.schedule?.time||'08:00')+' · '+(bd.patient?.name||'-')}</div><div style={{fontSize:9,color:C.mid}}>{(bd.locations?.pickup||'-')+' → '+(bd.locations?.dropoff||'-')+' · '+(MOB[bd.patient?.mobilityLevel]||'-')}</div><div style={{fontSize:8,color:'#94A3B8',marginTop:2}}>{todayJob.jobId}</div>{goTo&&<Btn ch="→ เริ่มงานเลย" col={C.pri} sm s={{marginTop:4,width:'100%'}} fn={()=>goTo(1)}/>}</Crd>:<Crd s={{background:'#EEEDFE',border:'1px solid #AFA9EC'}}><div style={{fontWeight:700,color:C.pri}}>{"⏰ 08:00 · คุณแม่มุก"}</div><div style={{fontSize:9,color:C.mid}}>{"ลาดพร้าว ซ.12 → รพ.จุฬาฯ · วีลแชร์ 🚐"}</div></Crd>}
      <div style={{display:'flex',gap:4,marginTop:4}}>
        <div style={{flex:1,background:'#E1F5EE',border:'1px solid #9FE1CB',borderRadius:8,padding:'6px',textAlign:'center'}}><div style={{fontSize:13,fontWeight:700,color:'#085041'}}>{"฿4,200"}</div><div style={{fontSize:8,color:C.suc}}>{"ถอนได้เลย"}</div></div>
        <div style={{flex:1,background:'#FAEEDA',border:'1px solid #FAC775',borderRadius:8,padding:'6px',textAlign:'center'}}><div style={{fontSize:13,fontWeight:700,color:'#633806'}}>{"฿600"}</div><div style={{fontSize:8,color:'#854F0B'}}>{"งานวันนี้"}</div></div>
      </div>
    </div>
  </div>;
}

function KBriefPIN(){
  const{booking}=useCtx();const[gps,sg]=useState(false);const[ok,so]=useState(false);
  return <div style={{padding:'8px 9px',background:C.bg}}>
    <PatientBrief/>
    <div style={{display:'flex',gap:4,marginBottom:5}}>
      <button onClick={()=>sg(false)} style={{flex:1,padding:'5px',borderRadius:7,border:`1.5px solid ${!gps?C.dan:C.bdr}`,background:!gps?'#FFF1F2':'#fff',fontSize:10,cursor:'pointer',color:!gps?C.dan:C.mid}}>{"🔒 GPS >3km"}</button>
      <button onClick={()=>sg(true)} style={{flex:1,padding:'5px',borderRadius:7,border:`1.5px solid ${gps?C.suc:C.bdr}`,background:gps?'#ECFDF5':'#fff',fontSize:10,cursor:'pointer',color:gps?C.suc:C.mid}}>{"✅ GPS <3km"}</button>
    </div>
    <Crd s={{background:'#1E3A8A',opacity:gps?1:.5}}><div style={{fontSize:8,color:'rgba(255,255,255,0.6)',textAlign:'center',marginBottom:2}}>{"🔐 PIN ยืนยัน"}</div><div style={{fontSize:30,fontWeight:900,letterSpacing:8,color:gps?'#93C5FD':'#666',textAlign:'center'}}>{"7421"}</div></Crd>
    {gps&&!ok&&<Btn ch="จำลอง: คุณยายกด PIN สำเร็จ" col={C.mid} out sm s={{width:'100%',marginTop:4}} fn={()=>{const j=getActiveJob();if(j){addCheckpoint(j.jobId,'PIN ✓ เริ่มงาน');}so(true);}}/>}
    {ok&&<Crd s={{background:'#ECFDF5',border:'1px solid #6EE7B7',textAlign:'center'}}><div style={{fontWeight:700,color:C.suc}}>{"✅ PIN ✓ เริ่มงานแล้ว!"}</div></Crd>}
  </div>;
}

function CDHomeMain({openHam,goTo}){
  const[todayJob,setTodayJob]=useState(null);
  useEffect(()=>{const load=()=>{const j=getJobs().find(j=>j.status==='assigned');setTodayJob(j||null);};load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const bd=todayJob?.bookingData||{};
  return <div style={{background:C.bg}}>
    <div style={{background:C.drk,padding:'8px 11px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <button onClick={openHam} style={{background:'none',border:'none',color:'white',fontSize:15,cursor:'pointer',padding:0}}>{"☰"}</button>
      <span style={{color:'white',fontWeight:700,fontSize:11}}>{"คุณนิภา "}<Tag ch="CG" col='#5DCAA5'/></span>
      <span style={{color:'white',fontSize:11}}>{"🔔"}</span>
    </div>
    <div style={{padding:'8px 9px'}}>
      <Crd s={{background:'#EEEDFE',border:'1px solid #AFA9EC'}}><div style={{fontWeight:700,color:C.pri}}>{todayJob?('💊 '+(bd.patient?.name||'คุณแม่มุก')):'💊 คิว A-042 · คุณแม่มุก'}</div><div style={{fontSize:9,color:C.mid}}>{todayJob?(bd.locations?.dropoff||'รพ.จุฬาฯ อายุรกรรม ชั้น 3'):'รพ.จุฬาฯ อายุรกรรม ชั้น 3'}</div>{todayJob&&<div style={{fontSize:8,color:'#94A3B8',marginTop:2}}>{todayJob.jobId}</div>}{todayJob&&goTo&&<Btn ch="→ ไปที่งาน" col={C.pri} sm s={{marginTop:4,width:'100%'}} fn={()=>goTo(1)}/>}</Crd>
      <div style={{display:'flex',gap:4,marginTop:4}}>
        <div style={{flex:1,background:'#E1F5EE',border:'1px solid #9FE1CB',borderRadius:8,padding:'6px',textAlign:'center'}}><div style={{fontSize:13,fontWeight:700,color:'#085041'}}>{"฿2,100"}</div><div style={{fontSize:8,color:C.suc}}>{"ถอนได้เลย"}</div></div>
        <div style={{flex:1,background:'#FAEEDA',border:'1px solid #FAC775',borderRadius:8,padding:'6px',textAlign:'center'}}><div style={{fontSize:13,fontWeight:700,color:'#633806'}}>{"฿400"}</div><div style={{fontSize:8,color:'#854F0B'}}>{"งานวันนี้"}</div></div>
      </div>
    </div>
  </div>;
}

function CDashOCR(){
  const SLOTS=['ใบสั่งยา','ใบเสร็จ'];
  const[photos,setPhotos]=useState({});
  const[medicines,setMedicines]=useState([]);
  const[verified,setVerified]=useState({});
  const[scanning,setScanning]=useState(false);
  const[pendingSlot,setPendingSlot]=useState(null);
  const photoRef=useRef(null);
  const job=getActiveJob();
  const triggerCapture=slot=>{setPendingSlot(slot);photoRef.current?.click();};
  const onCapture=e=>{
    const f=e.target.files?.[0];if(!f||!pendingSlot)return;
    const r=new FileReader();r.onload=ev=>{setPhotos(p=>({...p,[pendingSlot]:ev.target.result}));};
    r.readAsDataURL(f);e.target.value='';setPendingSlot(null);
  };
  const runOCR=async()=>{
    const img=photos['ใบสั่งยา'];if(!img)return;
    const k=getApiKey();setScanning(true);
    try{
      const result=k?await scanPrescription(img,k):[{name:'AMLODIPINE',dose:'5mg',frequency:'วันละครั้ง'},{name:'Warfarin',dose:'2mg',frequency:'วันละครั้งตอนเย็น'},{name:'Multivitamin',dose:'1เม็ด',frequency:'หลังอาหารเช้า'}];
      setMedicines(result.length>0?result:[{name:'AMLODIPINE',dose:'5mg',frequency:'วันละครั้ง'},{name:'Multivitamin',dose:'1เม็ด',frequency:'ทุกเช้า'}]);
    }catch{setMedicines([{name:'AMLODIPINE',dose:'5mg',frequency:'วันละครั้ง'}]);}
    finally{setScanning(false);}
  };
  const verifyMed=(name)=>{
    setVerified(v=>({...v,[name]:!v[name]}));
    if(job&&!verified[name])addCheckpointWithData(job.jobId,'ตรวจยา: '+name,{});
  };
  const allVerified=medicines.length>0&&medicines.every(m=>verified[m.name]);
  return <div style={{padding:'8px 9px',background:C.bg}}>
    <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={onCapture}/>
    <Alrt t={job?'danger':'info'} ch={job?'🔔 '+(job.bookingData?.patient?.name||'ผู้ป่วย')+' เข้าพบหมอแล้ว! → รับใบสั่งยา':'📷 ถ่ายรูปใบสั่งยาเพื่อ OCR'}/>
    <ST ic="📷" ch="ถ่ายเอกสาร"/>
    <div style={{display:'flex',gap:4,marginBottom:6}}>
      {SLOTS.map(s=><div key={s} onClick={()=>triggerCapture(s)} style={{flex:1,borderRadius:8,border:`1.5px solid ${photos[s]?C.suc:C.bdr}`,background:photos[s]?'#ECFDF5':'#F8FAFC',overflow:'hidden',cursor:'pointer',minHeight:60,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        {photos[s]?<img src={photos[s]} style={{width:'100%',height:60,objectFit:'cover'}}/>:<><div style={{fontSize:20}}>{"📷"}</div><div style={{fontSize:8,color:C.mid,padding:'0 4px',textAlign:'center'}}>{s}</div></>}
      </div>)}
    </div>
    {photos['ใบสั่งยา']&&medicines.length===0&&<Btn ch={scanning?'⏳ กำลังสแกน…':'🔍 OCR สแกนรายการยา'} col={C.pri} s={{width:'100%',marginBottom:5,opacity:scanning?.6:1}} fn={runOCR} disabled={scanning}/>}
    {medicines.length>0&&<><ST ic="💊" ch={"รายการยา ("+medicines.filter(m=>verified[m.name]).length+"/"+medicines.length+" ตรวจแล้ว)"}/>
      {medicines.map((m,i)=><div key={i} onClick={()=>verifyMed(m.name)} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:8,marginBottom:3,background:verified[m.name]?'#ECFDF5':'#fff',border:`1px solid ${verified[m.name]?'#6EE7B7':C.bdr}`,cursor:'pointer'}}>
        <span style={{fontSize:16}}>{verified[m.name]?'✅':'💊'}</span>
        <div style={{flex:1}}><div style={{fontSize:10,fontWeight:700,color:verified[m.name]?C.suc:C.txt}}>{m.name}</div><div style={{fontSize:9,color:C.mid}}>{m.dose+' · '+m.frequency}</div></div>
      </div>)}
      <Btn ch={allVerified?'✅ ยาครบ → เรียก Grab':'ยาครบ → เรียก Grab (รอตรวจ '+medicines.filter(m=>!verified[m.name]).length+' รายการ)'} col={allVerified?C.suc:C.pri} s={{width:'100%',opacity:allVerified?1:.5,cursor:allVerified?'pointer':'default'}} fn={allVerified?()=>{if(job)addCheckpoint(job.jobId,'รับยาครบแล้ว');}:undefined}/>
    </>}
  </div>;
}

// Care Team Ham — V15 style (no training/quiz - instruction 16)
const CTHistory=()=><div style={{background:C.bg,padding:'8px 9px'}}><ST ic="📋" ch="ประวัติธุรกรรม"/>{[{date:'15 พ.ค.',j:'แม่มุก รพ.จุฬา',amt:'฿1,500'},{date:'12 พ.ค.',j:'ยายวิมล รพ.รามา',amt:'฿1,200'}].map((tx,i)=><Crd key={i}><div style={{fontSize:10,fontWeight:700}}>{tx.date+" · "+tx.j}</div><span style={{fontSize:12,fontWeight:800,color:C.suc}}>{tx.amt}</span></Crd>)}</div>;
const CTGetFriend=()=><div style={{background:C.bg,padding:'8px 9px',textAlign:'center'}}><div style={{fontSize:36,margin:'10px 0'}}>{"🎁"}</div><div style={{fontSize:16,fontWeight:800,marginBottom:6}}>{"แนะนำเพื่อน รับ ฿300"}</div><Crd s={{background:'#EEEDFE',border:'1px solid #AFA9EC'}}><div style={{fontWeight:700,color:C.pri,marginBottom:3}}>{"รหัสของคุณ"}</div><div style={{fontSize:22,fontWeight:900,color:C.pri,letterSpacing:4}}>{"TIPH25"}</div></Crd><Btn ch="📲 แชร์ผ่าน LINE" col={C.lin} s={{width:'100%',marginBottom:5}}/></div>;
function CTLeaderboard(){
  const data=[{r:'🥇',n:'คุณดูแล B',t:'Admin',j:45,rt:4.9,h:38,s:982,bg:'#FAEEDA'},{r:'🥈',n:'คุณรู้ใจ A',t:'RN',j:38,rt:4.8,h:32,s:945,bg:'#F1EFE8'},{r:'🥉',n:'คุณขับดี C',t:'Driver',j:52,rt:4.7,h:29,s:921,bg:'#FAECE7'},{r:'4',n:'คุณรู้ใจ D',t:'PN',j:33,rt:4.6,h:24,s:876},{r:'5',n:'คุณดูแล E',t:'CG',j:28,rt:4.5,h:19,s:812},{r:'10',n:'คุณทิพย์ ← คุณ',t:'PN',j:14,rt:4.9,h:8,s:612,bg:'#EEEDFE',cc:C.pri}];
  return <div style={{background:C.bg,padding:'8px 9px'}}><div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{"🏆 Ranking 10 อันดับแรก"}</div><table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}><thead><tr style={{background:'#EFF6FF'}}>{['#','ชื่อ','งาน','⭐','❤️','Pts'].map((h,i)=><th key={i} style={{padding:'5px 4px',textAlign:'left',fontWeight:700,fontSize:9}}>{h}</th>)}</tr></thead><tbody>{data.map((r,i)=><tr key={i} style={{background:r.bg||'#fff',borderBottom:'1px solid '+C.bdr}}><td style={{padding:'5px 4px',fontWeight:700}}>{r.r}</td><td style={{padding:'5px 4px'}}><div style={{color:r.cc||C.txt,fontSize:10,fontWeight:600}}>{r.n}</div><Tag ch={r.t} col={C.pri}/></td><td style={{padding:'5px 4px',textAlign:'center'}}>{r.j}</td><td style={{padding:'5px 4px',color:C.wrn}}>{"⭐"+r.rt}</td><td style={{padding:'5px 4px',color:C.dan}}>{"❤️"+r.h}</td><td style={{padding:'5px 4px',fontWeight:800,color:C.pri}}>{r.s}</td></tr>)}</tbody></table></div>;
}

// E-KYC 3 Steps (instruction 14)
function CTEKYC(){
  const[step,setStep]=useState(0);
  const stepL=['1 ข้อมูล','2 เอกสาร','3 BG Check'];
  return <div style={{background:C.bg,padding:'8px 9px'}}>
    <div style={{display:'flex',gap:2,marginBottom:8}}>{stepL.map((l,i)=><div key={i} style={{flex:1,textAlign:'center',padding:'4px 0',background:i<=step?C.pri:C.bg,border:`1px solid ${i<=step?C.pri:C.bdr}`,borderRadius:5,fontSize:7,color:i<=step?'#fff':C.mid,fontWeight:i===step?700:400}}>{l}</div>)}</div>
    {step===0&&<>
      <ST ic="👤" ch="ข้อมูลส่วนตัว"/>
      <InpBox ph="ชื่อ-นามสกุล"/><InpBox ph="เลขบัตรประชาชน 13 หลัก"/><InpBox ph="เลขทะเบียน / ใบอนุญาต (ถ้ามี)"/><InpBox ph="เบอร์โทรศัพท์"/><InpBox ph="LINE ID"/>
      <HR/><ST ic="🏦" ch="บัญชีรับเงิน"/>
      <InpBox ph="ธนาคาร"/><InpBox ph="เลขบัญชี"/>
      <Btn ch="ถัดไป → เอกสาร" col={C.pri} s={{width:'100%'}} fn={()=>setStep(1)}/>
    </>}
    {step===1&&<>
      <ST ic="📄" ch="เอกสารยืนยันตัวตน"/>
      <Photo l="บัตรประชาชน ด้านหน้า" done={false}/>
      <Photo l="บัตรประชาชน ด้านหลัง" done={false}/>
      <Photo l="Selfie ถือบัตร (AI Face Check)" done={false}/>
      <Alrt t="info" ch="📲 ส่ง LINE ก็ได้ค่ะ · Ops ตรวจ 1-3 วันทำการ"/>
      <div style={{display:'flex',gap:4}}>
        <Btn ch="← กลับ" col={C.mid} out sm fn={()=>setStep(0)} s={{flex:1}}/>
        <Btn ch="ส่งตรวจสอบ →" col={C.suc} fn={()=>setStep(2)} s={{flex:2}}/>
      </div>
    </>}
    {step===2&&<>
      <ST ic="🔍" ch="สถานะ BG Check"/>
      <Crd s={{background:'#FFFBEB',border:'1px solid #F59E0B'}}>
        <div style={{fontSize:10,fontWeight:700,color:'#92400E',marginBottom:4}}>{"⏳ รอการตรวจสอบ"}</div>
        <div style={{fontSize:9,color:C.mid,lineHeight:1.7}}>{"Ops กำลังตรวจสอบเอกสาร\nปกติใช้เวลา 1-3 วันทำการ\nจะแจ้งผลผ่าน LINE ค่ะ"}</div>
      </Crd>
      <Crd>
        <div style={{fontSize:9,color:C.mid,marginBottom:4}}>{"ขั้นตอน BG Check:"}</div>
        {[{l:'ตรวจเอกสาร',done:false},{l:'Background Check (ประวัติอาชญากรรม)',done:false},{l:'อนุมัติเริ่มงาน',done:false}].map((c,i)=><div key={i} style={{display:'flex',gap:6,padding:'4px 0',fontSize:9,alignItems:'center',borderBottom:i<2?'1px solid '+C.bdr:'none'}}><span>{c.done?'✅':'⏳'}</span><span style={{color:c.done?C.suc:C.mid}}>{c.l}</span></div>)}
      </Crd>
      <div style={{background:'#ECFDF5',border:'1px solid #6EE7B7',borderRadius:8,padding:'8px 10px',textAlign:'center'}}><div style={{fontSize:9,color:C.suc,fontWeight:700}}>{"📲 ส่งเอกสารสำเร็จแล้วค่ะ"}</div><div style={{fontSize:8,color:C.mid}}>{"รอผลการตรวจสอบผ่าน LINE"}</div></div>
    </>}
  </div>;
}

// ctHam - no training/quiz (instruction 16)
const ctHam=[{ic:'📋',label:'ประวัติธุรกรรม',hamPage:<CTHistory/>},{ic:'👥',label:'Get Friend Affiliate',hamPage:<CTGetFriend/>},'---',{ic:'🏆',label:'Leaderboard',hamPage:<CTLeaderboard/>},'---',{ic:'🪪',label:'E-KYC + BG Check',hamPage:<CTEKYC/>},'---',{ic:'🚪',label:'ออกจากระบบ'}];

// ── OPS DASHBOARD (V15V7 style with tabs - instruction 17) ────────
function OpsWebDash(){
  const[tab,st]=useState('daily');const[oF,sO]=useState(5);const[wF,sW]=useState(25);const[ai,sa]=useState(false);const[pickJobId,setPick]=useState(null);
  const[lsBooks,setLsBooks]=useState([]);
  useEffect(()=>{const load=()=>{try{setLsBooks(getJobs().filter(b=>b.status!=='cancelled'));}catch{setLsBooks([]);}};load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const actv=lsBooks.filter(b=>b.status==='active'||b.status==='assigned').length;
  const done=lsBooks.filter(b=>b.status==='completed').length;
  const pend=lsBooks.filter(b=>!b.status||b.status==='pending').length;
  const kpiData=[{l:'งานทั้งหมด',v:String(lsBooks.length+15),c:C.pri},{l:'กำลังทำ',v:String(actv+10),c:C.wrn},{l:'เสร็จ',v:String(done+3),c:C.suc},{l:'ปัญหา',v:'1',c:C.dan},{l:'CT active',v:'14',c:C.pur},{l:'Unmatched',v:String(pend+2),c:C.org}];
  const liveJobs=lsBooks.filter(b=>b.status==='active'||b.status==='assigned');
  return <div style={{background:'#fff',borderRadius:12,border:'1px solid '+C.bdr,overflow:'hidden'}}>
    <div style={{background:C.drk,padding:'9px 13px',display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:5}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{color:'#fff',fontWeight:800}}>{"🏥 Welcares Ops Dashboard"}</span><Tag ch="LIVE" col='#60A5FA'/></div>
      <div style={{display:'flex',gap:4}}><Tag ch="⚠️ 2 SLA" col={C.wrn}/><Tag ch="🖤 3 Black" col='#374151'/><Tag ch={'🟢 '+kpiData[0].v+' งาน'} col={C.suc}/></div>
    </div>
    <div style={{background:C.bg,padding:'7px 11px',display:'flex',gap:4,flexWrap:'wrap',borderBottom:'1px solid '+C.bdr}}>
      {kpiData.map((k,i)=><KPI key={i} l={k.l} v={k.v} col={k.c}/>)}
    </div>
    <div style={{borderBottom:'2px solid '+C.bdr,display:'flex',overflowX:'auto'}}>
      {[['daily','📍 Daily'],['emotional','💝 Emotional'],['lb','🏆 Leaderboard'],['backlog','📋 Backlog'],['settings','⚙️ Settings']].map(([id,l])=><button key={id} onClick={()=>st(id)} style={{padding:'7px 9px',background:'none',border:'none',borderBottom:`2px solid ${tab===id?C.pri:'transparent'}`,color:tab===id?C.pri:C.mid,fontWeight:tab===id?700:400,fontSize:11,cursor:'pointer',whiteSpace:'nowrap',marginBottom:-2}}>{l}</button>)}
    </div>
    <div style={{padding:12}}>
      {tab==='daily'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1.5fr 1fr',gap:10}}>
        <div><ST ic="🗺️" ch="Live Fleet Radar"/><BX l="GPS ทุกคน" h={120} bg='#ECFDF5'/>{[{n:'รู้ใจ A',s:'🟢',l:'รพ.รามา'},{n:'ขับดี B',s:'🟡',l:'ระหว่างทาง'},{n:'ดูแล C',s:'🔵',l:'รพ.จุฬา'}].map((p,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid '+C.bdr,fontSize:10}}><span>{p.s+" คุณ"+p.n}</span><span style={{color:C.mid}}>{p.l}</span></div>)}</div>
        <div><ST ic="📋" ch="Active Jobs"/>{[...liveJobs.map((b,i)=>{const bd=b.bookingData||{};const lastCp=b.checkpoints?.slice(-1)[0]?.label||'รับงานแล้ว';const pct=Math.min(100,Math.round((b.checkpoints?.length||0)/5*100));return<div key={'ls'+i} style={{background:C.bg,borderRadius:7,padding:'5px 7px',marginBottom:4,border:'1px solid '+C.bdr}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontSize:11,fontWeight:700}}>{bd.patient?.name||b.jobId}</span><Tag ch={lastCp} col={C.pri}/></div><div style={{height:4,background:'#E2E8F0',borderRadius:2}}><div style={{height:4,width:`${pct||5}%`,background:C.pri,borderRadius:2}}/></div></div>;}),{n:'คุณยายสมจิตร',st:'ในรพ.',pct:60,c:C.wrn},{n:'คุณยายวิมล',st:'รอพบแพทย์',pct:45,c:C.pri},{n:'คุณตาประสิทธิ์',st:'รับยา',pct:80,c:C.org}].map((j,i)=>j.jobId?null:<div key={i} style={{background:C.bg,borderRadius:7,padding:'5px 7px',marginBottom:4,border:'1px solid '+C.bdr}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontSize:11,fontWeight:700}}>{j.n}</span><Tag ch={j.st} col={j.c}/></div><div style={{height:4,background:'#E2E8F0',borderRadius:2}}><div style={{height:4,width:`${j.pct}%`,background:j.c,borderRadius:2}}/></div></div>)}<Alrt t="warning" ch="⏰ คุณยายวิมล รอยา 45+ นาที (SLA)"/><Alrt t="danger" ch="🖤 Black Heart Alert x3"/></div>
        <div><ST ic="⚡" ch="Actions"/>{[{t:'🔴 โทรร้องเรียน',a:'โทร',c:C.dan},{t:'🖤 วิเคราะห์ Hearts',a:'ดู',c:C.drk},{t:'📋 KYC 3 ใบ',a:'อนุมัติ',c:C.pri}].map((a,i)=><div key={i} style={{background:C.bg,border:'1px solid '+C.bdr,borderRadius:8,padding:'6px 8px',marginBottom:4}}><div style={{fontSize:10,fontWeight:700,marginBottom:2}}>{a.t}</div><Btn ch={a.a} col={a.c} sm/></div>)}<div style={{background:'#FFF1F2',border:'2px solid '+C.dan,borderRadius:8,padding:8,textAlign:'center'}}><div style={{fontSize:10,fontWeight:700,color:C.dan,marginBottom:3}}>{"🚨 SOS War Room"}</div><Btn ch="📞 1669" col='#7F1D1D' sm s={{width:'100%'}}/></div></div>
      </div>}
      {tab==='emotional'&&(()=>{
        const rmap={};lsBooks.filter(b=>b.rating&&b.assignedTo).forEach(b=>{if(!rmap[b.assignedTo])rmap[b.assignedTo]={total:0,count:0};rmap[b.assignedTo].total+=b.rating.score;rmap[b.assignedTo].count++;});
        const realScores=Object.entries(rmap).map(([n,r])=>({n,s:+(r.total/r.count).toFixed(1),count:r.count})).sort((a,b)=>b.s-a.s);
        const mockScores=[{n:'คุณรู้ใจ A',s:4.8},{n:'คุณขับดี C',s:4.5},{n:'คุณดูแล B',s:4.9},{n:'คุณรู้ใจ D',s:3.9,flag:true}];
        const scores=realScores.length>0?realScores:mockScores;
        const jobsWithSentiment=lsBooks.filter(b=>b.voiceSentiment);
        const avgSentiment=jobsWithSentiment.length>0?(jobsWithSentiment.reduce((s,b)=>s+b.voiceSentiment.score,0)/jobsWithSentiment.length).toFixed(1):null;
        const allFlags=lsBooks.flatMap(b=>b.voiceSentiment?.flags||[]);
        return<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div><ST ic="🤖" ch="AI Voice Sentiment"/>
            {avgSentiment?<Alrt t={avgSentiment>=4?'success':avgSentiment>=3?'warning':'danger'} ch={'📊 เฉลี่ย '+avgSentiment+'/5 · '+jobsWithSentiment.length+' งาน'}/>:<Alrt t="danger" ch="🔴 Risk: คุณรู้ใจ B · ฟังเสียง"/>}
            {allFlags.length>0&&allFlags.slice(0,3).map((f,i)=><Alrt key={i} t="warning" ch={'⚠️ '+f}/>)}
            <BX l="Sentiment timeline วันนี้" h={60}/><div style={{display:'flex',gap:4,marginTop:4}}><div style={{flex:1,background:'#FFF1F2',borderRadius:8,padding:'7px',textAlign:'center'}}><div style={{fontSize:16}}>{"❤️"}</div><div style={{fontSize:14,fontWeight:800,color:C.dan}}>{"24"}</div><div style={{fontSize:9,color:C.mid}}>{"หัวใจแดง"}</div></div><div style={{flex:1,background:'#1E293B',borderRadius:8,padding:'7px',textAlign:'center'}}><div style={{fontSize:16}}>{"🖤"}</div><div style={{fontSize:14,fontWeight:800,color:'#fff'}}>{"3"}</div><div style={{fontSize:9,color:'#94A3B8'}}>{"หัวใจดำ"}</div></div></div>
          </div>
          <div><ST ic="⭐" ch={"360° Scores"+(realScores.length>0?' (จริง)':'')}/>{scores.map((p,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 7px',background:p.flag||p.s<4?'#FFF1F2':C.bg,borderRadius:6,marginBottom:3,fontSize:11}}><span>{(p.flag||p.s<4)&&'⚠️ '}<span style={{fontWeight:700}}>{p.n}</span>{p.count&&<span style={{fontSize:9,color:C.mid}}>{' ('+p.count+')'}</span>}</span><span style={{fontWeight:700,color:p.s>=4.5?C.suc:p.s>=4?C.wrn:C.dan}}>{"⭐ "+p.s}</span></div>)}</div>
        </div>;})()}
      {tab==='lb'&&<div><ST ic="🏆" ch="Leaderboard เดือนนี้"/><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:'#EFF6FF'}}>{['#','ชื่อ','Tier','งาน','⭐','❤️','Score'].map((h,i)=><th key={i} style={{padding:'6px 8px',textAlign:'left',fontWeight:700,borderBottom:'2px solid '+C.bdr}}>{h}</th>)}</tr></thead><tbody>{[{r:'🥇',n:'คุณดูแล B',t:'Admin',j:45,rt:4.9,h:38,s:982},{r:'🥈',n:'คุณรู้ใจ A',t:'RN',j:38,rt:4.8,h:32,s:945},{r:'🥉',n:'คุณขับดี C',t:'Driver',j:52,rt:4.7,h:29,s:921}].map((r,i)=><tr key={i} style={{borderBottom:'1px solid '+C.bdr}}><td style={{padding:'6px 8px'}}>{r.r}</td><td style={{padding:'6px 8px',fontWeight:700}}>{r.n}</td><td style={{padding:'6px 8px'}}><Tag ch={r.t} col={C.pri}/></td><td style={{padding:'6px 8px'}}>{r.j}</td><td style={{padding:'6px 8px',color:C.wrn}}>{"⭐"+r.rt}</td><td style={{padding:'6px 8px',color:C.dan}}>{"❤️"+r.h}</td><td style={{padding:'6px 8px',fontWeight:800,color:C.pri}}>{r.s}</td></tr>)}</tbody></table></div>}
      {tab==='backlog'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ST ic="📋" ch={"Unmatched ("+(lsBooks.length+2)+")"}/>
          {lsBooks.map((b,i)=>{const bd=b.bookingData||{};const tr={'independent':'CG','assisted':'CG','wheelchair':'PN','bedridden':'RN'};const isAssigned=b.status==='assigned';return<Crd key={'ls'+i} s={{borderLeft:'3px solid '+(isAssigned?C.suc:C.org)}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontWeight:700,fontSize:10,color:isAssigned?C.suc:C.org}}>{isAssigned?'✅':'🆕'} {b.jobId}</span><Tag ch="฿1,500" col={isAssigned?C.suc:C.dan}/></div><div style={{fontSize:9,color:C.mid,marginBottom:2}}>{bd.patient?.name||'-'}{" · "}{tr[bd.patient?.mobilityLevel]||'CG'}</div><div style={{fontSize:9,color:C.mid,marginBottom:3}}>{[bd.schedule?.date,bd.schedule?.time].filter(Boolean).join(' ')||'-'}</div>{isAssigned?<div style={{fontSize:9,color:C.suc,fontWeight:700}}>{"✅ จับคู่แล้ว · "+b.assignedTo}</div>:pickJobId===b.jobId?<div style={{display:'flex',gap:3,flexWrap:'wrap',marginTop:2}}>{['คุณทิพย์','คุณสมชาย','คุณนิภา'].map(n=><button key={n} onClick={()=>{assignJob(b.jobId,n);setPick(null);}} style={{padding:'2px 7px',borderRadius:4,background:C.suc,color:'#fff',border:'none',fontSize:8,cursor:'pointer',fontWeight:700}}>{n}</button>)}<button onClick={()=>setPick(null)} style={{padding:'2px 6px',borderRadius:4,background:'#F1F5F9',border:'1px solid '+C.bdr,fontSize:8,cursor:'pointer'}}>{"✕"}</button></div>:<Btn ch="จับคู่" col={C.pri} sm fn={()=>setPick(b.jobId)}/>}</Crd>;})}
          {[{d:'19 มี.ค.',s:'RN+Driver',z:'ลาดพร้าว',v:'฿850'},{d:'20 มี.ค.',s:'CG+Driver',z:'สุขุมวิท',v:'฿650'}].map((b,i)=><Crd key={i}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontWeight:700,fontSize:10}}>{b.d+" · "+b.s}</span><Tag ch={b.v} col={C.dan}/></div><div style={{fontSize:9,color:C.mid,marginBottom:3}}>{b.z}</div><Btn ch="จับคู่" col={C.pri} sm/></Crd>)}
        </div>
        <div><ST ic="⏱️" ch="Pending"/>{[{p:'🔴',t:'โทรร้องเรียน',tm:'15 นาที',a:'โทร',c:C.dan},{p:'🟡',t:'ตรวจ KYC 3 ใบ',tm:'วันนี้',a:'ตรวจ',c:C.wrn},{p:'🟢',t:'Tier Upgrade',tm:'สัปดาห์นี้',a:'อนุมัติ',c:C.suc}].map((a,i)=><div key={i} style={{display:'flex',gap:7,padding:'5px 0',borderBottom:'1px solid '+C.bdr,alignItems:'center'}}><span>{a.p}</span><div style={{flex:1}}><div style={{fontSize:10,fontWeight:700}}>{a.t}</div><div style={{fontSize:9,color:C.mid}}>{"⏰ "+a.tm}</div></div><Btn ch={a.a} col={a.c} sm/></div>)}</div>
      </div>}
      {tab==='settings'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div><ST ic="⚙️" ch="Platform Fees"/><Crd>{[{l:'Ops Fee',v:oF,sv:sO,mn:1,mx:15},{l:'Welcares Fee',v:wF,sv:sW,mn:10,mx:40}].map((f,i)=><div key={i} style={{marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontSize:11,fontWeight:700}}>{f.l}</span><span style={{fontSize:13,fontWeight:800,color:C.pri}}>{f.v+"%"}</span></div><input type="range" min={f.mn} max={f.mx} value={f.v} onChange={e=>f.sv(+e.target.value)} style={{width:'100%'}}/></div>)}<Btn ch="💾 บันทึก" col={C.suc} s={{width:'100%',marginTop:4}}/></Crd></div>
        <div><div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}><ST ic="💰" ch="Tier Pricing"/><Btn ch={ai?'⏳':'🤖 AI ราคา'} col={C.pur} sm fn={()=>{sa(true);setTimeout(()=>sa(false),1500);}}/></div>{ai&&<Alrt t="info" ch="🤖 กำลังค้นหาราคาตลาด…"/>}{[{t:'CG',mn:600,mx:900,c:C.mid},{t:'PN',mn:900,mx:1400,c:C.suc},{t:'RN',mn:1400,mx:1800,c:C.pur}].map((ti,i)=><Crd key={i} s={{border:`1px solid ${ti.c}30`}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><Tag ch={ti.t} col={ti.c}/><span style={{fontSize:9,color:C.mid}}>{"฿"+ti.mn+"–฿"+ti.mx}</span></div></Crd>)}<Btn ch="💾 บันทึก Tier" col={C.suc} s={{width:'100%'}}/></div>
      </div>}
    </div>
  </div>;
}

function MgmtWebDash(){
  const[tab,st]=useState('financial');
  const[mjobs,setMJobs]=useState(()=>getJobs());
  useEffect(()=>{const load=()=>setMJobs(getJobs());window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const completedJobs=mjobs.filter(j=>j.status==='completed');
  const realGMV=completedJobs.length*1500;
  const realRevenue=Math.round(realGMV*0.255);
  return <div style={{background:'#fff',borderRadius:12,border:'1px solid '+C.bdr,overflow:'hidden'}}>
    <div style={{background:C.nvy,padding:'10px 13px',display:'flex',justifyContent:'space-between'}}>
      <div><div style={{color:'#fff',fontWeight:800,fontSize:14}}>{"📊 Welcares Management"}</div><div style={{color:'rgba(255,255,255,0.5)',fontSize:9}}>{"Strategic Command Center · Q1 2568"}</div></div>
      <Tag ch="Web" col='#93C5FD'/>
    </div>
    <div style={{background:'#EFF6FF',padding:'7px 11px',display:'flex',gap:4,flexWrap:'wrap',borderBottom:'1px solid '+C.bdr}}>
      {[{l:'GMV',v:realGMV>0?'฿'+realGMV.toLocaleString():'฿2.4M',sub:'+18%',c:C.suc},{l:'Revenue',v:realRevenue>0?'฿'+realRevenue.toLocaleString():'฿612K',sub:'+24%',c:C.pri},{l:'Expenses',v:'฿328K',sub:'+11%',c:C.dan},{l:'EBITDA',v:'฿284K',sub:'+31%',c:C.tel},{l:'Customers',v:'847',sub:'+12%',c:C.pur},{l:'LTV/CAC',v:'8.4x',c:C.org}].map((k,i)=><KPI key={i} l={k.l} v={k.v} sub={k.sub} col={k.c}/>)}
    </div>
    <div style={{borderBottom:'2px solid '+C.bdr,display:'flex',overflowX:'auto'}}>
      {[['financial','💰 Financial'],['customer','👥 Customer'],['growth','📈 Growth'],['ai','🤖 AI Insights'],['projection','📊 Projection']].map(([id,l])=><button key={id} onClick={()=>st(id)} style={{padding:'7px 9px',background:'none',border:'none',borderBottom:`2px solid ${tab===id?C.nvy:'transparent'}`,color:tab===id?C.nvy:C.mid,fontWeight:tab===id?700:400,fontSize:11,cursor:'pointer',whiteSpace:'nowrap',marginBottom:-2}}>{l}</button>)}
    </div>
    <div style={{padding:12}}>
      {tab==='financial'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
        <div><ST ic="💰" ch="Revenue"/>{[{l:'GMV',v:'฿2,401,500',c:C.suc},{l:'Welcares 25%',v:'฿450,280',c:C.pri},{l:'Net Revenue',v:'฿612,381',c:C.suc}].map((r,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid '+C.bdr,fontSize:10}}><span style={{color:C.mid}}>{r.l}</span><span style={{fontWeight:700,color:r.c}}>{r.v}</span></div>)}<BX l="Revenue trend 12 เดือน" h={55} bg='#ECFDF5'/></div>
        <div><ST ic="📊" ch="Unit Economics"/>{[{l:'Avg Order Value',v:'฿2,340'},{l:'Gross Margin',v:'46.4%'},{l:'Repeat Rate',v:'68%'},{l:'CAC',v:'฿280'},{l:'LTV',v:'฿2,350'},{l:'NPS',v:'+68'}].map((m,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid '+C.bdr,fontSize:10}}><span style={{color:C.mid}}>{m.l}</span><span style={{fontWeight:700,color:C.nvy}}>{m.v}</span></div>)}</div>
        <div><ST ic="📉" ch="Cost Structure"/>{[{l:'Care Team Wages',v:'฿228K',c:C.mid},{l:'Platform/Infra',v:'฿52K',c:C.wrn},{l:'Marketing',v:'฿29K',c:C.org}].map((r,i)=><div key={i} style={{marginBottom:5}}><div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}><span>{r.l}</span><span style={{fontWeight:700,color:r.c}}>{r.v}</span></div></div>)}</div>
      </div>}
      {tab==='customer'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ST ic="👥" ch="Customer Segments"/>{[{seg:'Busy Professional',n:412,pct:49,c:C.pri},{seg:'Senior Adult 65+',n:198,pct:23,c:C.suc},{seg:'Caregiver Family',n:156,pct:18,c:C.wrn}].map((s,i)=><div key={i} style={{marginBottom:6}}><div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}><span>{s.seg}</span><span style={{fontWeight:700,color:s.c}}>{s.n+"("+s.pct+"%)"}</span></div><div style={{height:5,background:'#E2E8F0',borderRadius:3}}><div style={{height:5,width:`${s.pct}%`,background:s.c,borderRadius:3}}/></div></div>)}</div>
        <div><ST ic="♻️" ch="Retention"/><BX l="Cohort retention" h={90}/>{[{l:'Month 1',v:'78%',c:C.suc},{l:'Month 3',v:'62%',c:C.wrn},{l:'NPS',v:'+68',c:C.tel}].map((m,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid '+C.bdr,fontSize:10}}><span style={{color:C.mid}}>{m.l}</span><span style={{fontWeight:800,color:m.c}}>{m.v}</span></div>)}</div>
      </div>}
      {tab==='growth'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ST ic="📈" ch="Growth Metrics"/><BX l="MAU 12 เดือน" h={90}/>{[{l:'MoM Growth',v:'+18%',c:C.suc},{l:'New Customers',v:'94/mo',c:C.pri},{l:'Organic %',v:'54%',c:C.tel}].map((m,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid '+C.bdr,fontSize:10}}><span style={{color:C.mid}}>{m.l}</span><span style={{fontWeight:800,color:m.c}}>{m.v}</span></div>)}</div>
        <div><ST ic="🗺️" ch="Geographic"/>{[{zone:'Bangkok Core',orders:612,color:C.pri},{zone:'Bangkok Ring',orders:158,color:C.suc},{zone:'Nonthaburi',orders:51,color:C.wrn}].map((z,i)=><div key={i} style={{marginBottom:6}}><div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}><span style={{fontWeight:700}}>{z.zone}</span><Tag ch={""+z.orders} col={z.color}/></div><div style={{height:5,background:'#E2E8F0',borderRadius:3}}><div style={{height:5,width:`${(z.orders/612)*100}%`,background:z.color,borderRadius:3}}/></div></div>)}<Alrt t="info" ch="📍 Chiang Mai pilot: Q3 2568"/></div>
      </div>}
      {tab==='ai'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ST ic="🤖" ch="AI Performance"/>{[{l:'Match Accuracy',v:'94.2%',c:C.suc},{l:'Sentiment True+',v:'88.7%',c:C.pri},{l:'OCR Med Accuracy',v:'97.1%',c:C.tel},{l:'Unmatched Rate',v:'3.2%',c:C.wrn}].map((m,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid '+C.bdr,fontSize:10}}><span style={{color:C.mid}}>{m.l}</span><span style={{fontWeight:800,color:m.c}}>{m.v}</span></div>)}</div>
        <div><ST ic="💡" ch="AI Recommendations"/>{[{ic:'📈',t:'เพิ่ม RN ในโซน รามา+ศิริราช',p:'High',c:C.dan},{ic:'💰',t:'Dynamic Pricing 7-9am',p:'Med',c:C.wrn},{ic:'📦',t:'Batch ยา → ลด cost 18%',p:'High',c:C.suc}].map((r,i)=><div key={i} style={{display:'flex',gap:8,padding:'5px 0',borderBottom:'1px solid '+C.bdr,alignItems:'center'}}><span style={{fontSize:14}}>{r.ic}</span><div style={{flex:1,fontSize:10,fontWeight:700}}>{r.t}</div><Tag ch={r.p} col={r.c}/></div>)}</div>
      </div>}
      {tab==='projection'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ST ic="📊" ch="12-Month Projection"/><BX l="Revenue vs Target" h={110}/>{[{l:'EOY GMV',v:'฿9.6M',c:C.suc},{l:'EOY Customers',v:'2,400',c:C.pri},{l:'Break-even',v:'Month 8',c:C.wrn},{l:'EBITDA',v:'฿1.2M',c:C.tel}].map((m,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid '+C.bdr,fontSize:10}}><span style={{color:C.mid}}>{m.l}</span><span style={{fontWeight:800,color:m.c}}>{m.v}</span></div>)}</div>
        <div><ST ic="🎯" ch="Milestones"/>{[{q:'Q2 2568',t:'1,200 customers · Chiang Mai',c:C.pri},{q:'Q3 2568',t:'B2B Corporate · 3 hospitals MOU',c:C.wrn},{q:'Q4 2568',t:'Series A · ฿50M raise',c:C.pur},{q:'Q1 2569',t:'2,400 customers · Break-even',c:C.suc}].map((m,i)=><div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'1px solid '+C.bdr}}><Tag ch={m.q} col={m.c}/><div style={{fontSize:10,flex:1}}>{m.t}</div></div>)}<Alrt t="success" ch="📈 On track for Q4 break-even"/></div>
      </div>}
    </div>
  </div>;
}

// ── LINE per entity (instruction 18) ────────────────────────────
const LINE_DATA={
  daughter:[{time:'วันพุธ 15 พ.ค.',title:'✅ ยืนยันการจองแล้ว',body:'📅 พ 15 พ.ค. 09:00\n🏥 รพ.จุฬาฯ\n👵 แม่มุก · วีลแชร์',cta:'ดูรายละเอียด'},{title:'🌅 แจ้งเตือนพรุ่งนี้',body:'⏰ คุณสมชายจะมาถึง 08:00 น.\n⚠️ งดน้ำ/อาหาร'},{time:'09:05',title:'📍 Checkpoint 1',body:'✅ คุณทิพย์รับแม่มุกจากบ้านแล้วค่ะ 😊'},{title:'💊 รับยาแล้ว',body:'✅ คุณนิภาตรวจยาครบ 3 รายการ'},{title:'🏡 กลับถึงบ้านแล้ว',body:'แม่มุกปลอดภัยแล้วค่ะ 🥰',cta:'ดู Medical Report'}],
  rujai:[{time:'1 วันก่อน',title:'📋 งานพรุ่งนี้',body:'คุณทิพย์ 💛\n👵 คุณยายมุก อายุ 72 · ความดัน\n📍 ลาดพร้าว ซ.12 · ⏰ 08:00\n💬 ชอบขนมหวาน · กลัวแมว'},{time:'08:55',title:'🔑 PIN พร้อม (GPS <500m)',body:'PIN: 7421 · active 5 นาทีค่ะ'},{time:'16:00',title:'💝 ได้รับหัวใจ ❤️ ❤️',body:'จาก คุณสมชาย: "ทีมเวิร์คดีมาก 🙌"'}],
  khabdi:[{time:'1 วันก่อน',title:'📋 งานพรุ่งนี้',body:'คุณสมชาย 💛\n👵 คุณยายมุก · 📍 ลาดพร้าว ซ.12\n⏰ 08:00 · รพ.จุฬาฯ · วีลแชร์ 🚐'},{time:'07:45',title:'⏰ ออกจากบ้านได้เลยค่ะ',body:'ระยะทาง ~12km · ETA ~35 นาที'},{time:'08:52',title:'🔑 PIN พร้อม (GPS <500m)',body:'PIN: 7421 · ให้คุณยายกดยืนยัน'},{time:'16:00',title:'💝 ได้รับหัวใจ ❤️',body:'จากคุณทิพย์: "ขับปลอดภัยมาก 🙌"'}],
  dulaeh:[{time:'11:30',title:'🔔 คุณยายเข้าพบหมอแล้ว',body:'คุณนิภา 💛\nโปรดรับใบสั่งยาจากคุณทิพย์ ชั้น 3 ค่ะ'},{time:'12:15',title:'✅ ยาครบ — เรียก Grab ได้เลย',body:'ยาครบ 3/3 · 🏠 ลาดพร้าว ซ.12'}],
  grandma:[{time:'สัปดาห์หน้า',title:'🔔 มีนัดหมอสัปดาห์หน้าค่ะ',body:'วันพุธ 15 พฤษภาคม เวลา 9 โมงเช้า\nที่โรงพยาบาลจุฬาลงกรณ์ค่ะ',cta:'รับทราบ ✅'},{time:'วันงาน 08:00',title:'💊 ถึงเวลากินยาค่ะ',body:'ยาความดัน 1 เม็ด หลังอาหารนะคะ',cta:'กินแล้ว ✅'}],
};

function LineView(){
  const[ent,setEnt]=useState('daughter');
  const[realMsgs,setRealMsgs]=useState([]);
  const labels={daughter:'👩 ลูกสาว',rujai:'🤝 คุณรู้ใจ',khabdi:'🚗 คุณขับดี',dulaeh:'💊 คุณดูแล',grandma:'👵 คุณยาย'};
  useEffect(()=>{const load=()=>{const jobs=getJobs().filter(j=>j.status&&j.status!=='cancelled');const cpIcons={'รับจากบ้าน':'📍','ถึง รพ.':'🏥','รอพบแพทย์':'👨‍⚕️','รอรับยา':'💊','ส่งกลับบ้าน':'🏡','PIN ✓ เริ่มงาน':'🔑','ปิดงาน':'🏁'};const msgs=[];const svc={'hospital-visit':'พบแพทย์','dialysis':'ล้างไต','chemotherapy':'เคมีบำบัด','physical-therapy':'กายภาพบำบัด','checkup':'ตรวจสุขภาพ','vaccination':'วัคซีน','other':'บริการทั่วไป'};jobs.forEach(j=>{const bd=j.bookingData||{};msgs.push({time:'🆕 ใหม่',title:'✅ ยืนยันการจองแล้ว',body:'📋 '+j.jobId+'\n🏥 '+(svc[bd.service?.type]||bd.service?.type||'-')+'\n📅 '+([bd.schedule?.date,bd.schedule?.time].filter(Boolean).join(' ')||'-')+'\n📍 '+(bd.locations?.dropoff||'-')+'\n👤 '+(bd.patient?.name||'-'),cta:'ดูรายละเอียด',_real:true});(j.checkpoints||[]).filter(cp=>!cp.vitals&&cp.label!=='vitals'&&!cp.label.startsWith('ตรวจยา:')).forEach(cp=>{try{const d=new Date(cp.time);const tm=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');msgs.push({time:tm,title:(cpIcons[cp.label]||'📍')+' '+cp.label,body:'บันทึกแล้วค่ะ ✅',photo:cp.photo||undefined,_real:true});}catch{}});if(j.status==='completed'){const firstPhoto=(j.checkpoints||[]).find(cp=>cp.photo)?.photo;const vitals=(j.checkpoints||[]).find(cp=>cp.vitals)?.vitals;const sent=j.voiceSentiment;const bodyLines=[(bd.patient?.name||'ผู้ป่วย')+'ปลอดภัยแล้วค่ะ 🥰',j.assignedTo?'ดูแลโดย '+j.assignedTo:'',(vitals?.bp?'🩺 BP: '+vitals.bp+(vitals.spo2?' · SpO2: '+vitals.spo2+'%':''):''),sent?'😊 ประเมิน '+sent.score+'/5':'',j.reportApproved?'📋 Medical Report พร้อมแล้ว':''].filter(Boolean);msgs.push({time:'✅',title:'🏡 กลับถึงบ้านแล้วค่ะ',body:bodyLines.join('\n'),photo:firstPhoto,cta:j.reportApproved?'ดู Medical Report':undefined,_real:true});}if(j.rating?.score){msgs.push({time:'⭐',title:'ขอบคุณที่ให้คะแนนค่ะ',body:'คุณให้ '+j.rating.score+' ดาว'+(j.assignedTo?' · '+j.assignedTo:''),_real:true});}});setRealMsgs(msgs);};load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const msgs=ent==='daughter'?[...realMsgs,...LINE_DATA[ent]||[]]:LINE_DATA[ent]||[];
  return <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
    <div style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center'}}>
      {Object.entries(labels).map(([k,l])=><button key={k} onClick={()=>setEnt(k)} style={{padding:'4px 8px',borderRadius:6,border:`1px solid ${ent===k?C.lin:C.bdr}`,background:ent===k?C.lin:'#fff',color:ent===k?'#fff':C.mid,fontSize:9,cursor:'pointer',fontWeight:ent===k?700:400}}>{l}</button>)}
    </div>
    <LPhone msgs={msgs}/>
  </div>;
}

// ── MAIN APP ──────────────────────────────────────────────────────
const SCENARIOS=[
  {id:'new',label:'🆕 ลูกค้าใหม่',scen:'new',lastRating:null},
  {id:'old_appt_good',label:'📅 มีนัด ⭐4.9',scen:'old_appt',lastRating:4.9},
  {id:'old_appt_bad',label:'📅 มีนัด ⭐3.2',scen:'old_appt',lastRating:3.2},
  {id:'old_no_appt_good',label:'🕐 ไม่มีนัด ⭐4.9',scen:'old_no_appt',lastRating:4.9},
  {id:'old_no_appt_bad',label:'🕐 ไม่มีนัด ⭐3.2',scen:'old_no_appt',lastRating:3.2},
];
const TABS=[{id:'daughter',l:'👩 ลูกสาว'},{id:'grandma',l:'👵 คุณยาย'},{id:'rujai',l:'🤝 คุณรู้ใจ'},{id:'khabdi',l:'🚗 คุณขับดี'},{id:'dulaeh',l:'💊 คุณดูแล'},{id:'intake-chat',l:'💬 แชทจอง'},{id:'intake',l:'📝 Intake Agent'},{id:'booking-agent',l:'🤖 Booking Agent'},{id:'ops_web',l:'🖥️ Ops Web'},{id:'ops_mob',l:'📱 Ops Mobile'},{id:'mgmt_web',l:'📊 Mgmt Web'},{id:'line',l:'💚 LINE'}];

function OpsMobView(){
  const[tab,st]=useState('overview');
  const[lsBooks,setLsBooks]=useState([]);
  useEffect(()=>{const load=()=>{try{setLsBooks(getJobs().filter(b=>b.status!=='cancelled'));}catch{setLsBooks([]);}};load();window.addEventListener(JOB_UPDATED_EVENT,load);return()=>window.removeEventListener(JOB_UPDATED_EVENT,load);},[]);
  const actv=lsBooks.filter(b=>b.status==='active'||b.status==='assigned').length;
  const done=lsBooks.filter(b=>b.status==='completed').length;
  const pendJobs=lsBooks.filter(b=>!b.status||b.status==='pending');
  const TR={'independent':'CG','assisted':'CG','wheelchair':'PN','bedridden':'RN'};
  return <div style={{background:C.bg}}>
    <div style={{background:C.drk,padding:'8px 11px',display:'flex',justifyContent:'space-between'}}><span style={{color:'#fff',fontWeight:800}}>{"🏥 Ops Mobile"}</span><div style={{display:'flex',gap:4}}><Tag ch="⚠️ 2" col={C.wrn}/><Tag ch="🔴 1" col={C.dan}/></div></div>
    <div style={{display:'flex',borderBottom:'2px solid '+C.bdr,background:'#fff'}}>{[['overview','📊'],['actions','🔴'],['backlog','📋']].map(([id,l])=><button key={id} onClick={()=>st(id)} style={{flex:1,padding:'6px 2px',border:'none',borderBottom:`2px solid ${tab===id?C.dan:'transparent'}`,background:'none',fontSize:9,color:tab===id?C.dan:C.mid,cursor:'pointer',fontWeight:tab===id?700:400,marginBottom:-2}}>{l+" "+id}</button>)}</div>
    {tab==='overview'&&<div style={{padding:'8px 9px'}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:5}}>{[{l:'งานทั้งหมด',v:String(lsBooks.length+15),c:C.pri},{l:'กำลังทำ',v:String(actv+10),c:C.wrn},{l:'เสร็จ',v:String(done+3),c:C.suc},{l:'CT active',v:'14',c:C.pur}].map((k,i)=><div key={i} style={{background:'#fff',borderRadius:8,padding:'7px',textAlign:'center',border:'1px solid '+C.bdr}}><div style={{fontSize:16,fontWeight:800,color:k.c}}>{k.v}</div><div style={{fontSize:9,color:C.mid}}>{k.l}</div></div>)}</div><BX l="Fleet Radar" h={80} bg='#ECFDF5'/></div>}
    {tab==='actions'&&<div style={{padding:'8px 9px'}}>{[{ic:'📞',t:'ร้องเรียน: ขับหวาดเสียว',c:C.dan,a:'โทร'},{ic:'⏰',t:'SLA: คุณยายวิมล รอยา 45+ นาที',c:C.dan,a:'ดูงาน'}].map((a,i)=><div key={i} style={{background:C.bg,border:`1px solid ${a.c}30`,borderRadius:8,padding:'7px 9px',marginBottom:4,display:'flex',gap:7,alignItems:'center'}}><span style={{fontSize:16}}>{a.ic}</span><div style={{flex:1,fontSize:10,fontWeight:700,color:a.c}}>{a.t}</div><Btn ch={a.a} col={a.c} sm/></div>)}</div>}
    {tab==='backlog'&&<div style={{padding:'8px 9px'}}>
      {pendJobs.map((b,i)=>{const bd=b.bookingData||{};const isAssigned=b.status==='assigned';return<Crd key={'ls'+i} s={{borderLeft:'3px solid '+(isAssigned?C.suc:C.org)}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontWeight:700,fontSize:10,color:isAssigned?C.suc:C.org}}>{isAssigned?'✅':'🆕'} {b.jobId}</span><Tag ch={TR[bd.patient?.mobilityLevel]||'CG'} col={C.pri}/></div><div style={{fontSize:9,color:C.mid,marginBottom:2}}>{bd.patient?.name||'-'}{' · '}{[bd.schedule?.date,bd.schedule?.time].filter(Boolean).join(' ')||'-'}</div>{isAssigned?<div style={{fontSize:9,color:C.suc,fontWeight:700}}>{"✅ จับคู่แล้ว · "+b.assignedTo}</div>:<Btn ch="จับคู่" col={C.pri} sm fn={()=>assignJob(b.jobId,'Ops')}/>}</Crd>;})}
      {[{d:'19 มี.ค.',s:'RN+Driver',z:'ลาดพร้าว',v:'฿850'},{d:'20 มี.ค.',s:'CG+Driver',z:'สุขุมวิท',v:'฿650'}].map((b,i)=><Crd key={i}><div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{fontWeight:700,fontSize:10}}>{b.d+" · "+b.s}</span><Tag ch={b.v} col={C.dan}/></div><div style={{fontSize:9,color:C.mid,marginBottom:3}}>{b.z}</div><Btn ch="จับคู่" col={C.pri} sm/></Crd>)}
    </div>}
  </div>;
}

export default function App(){
  const[tab,setTab]=useState('daughter');
  const[scenId,setScenId]=useState('old_appt_good');
  const[vpDone,setVpDone]=useState(false);
  const[booking,setBooking]=useState({has_rujai:true,has_khabdi:true,has_dulaeh:true,transport_go:'grab',transport_back:'grab'});
  const sc=SCENARIOS.find(s=>s.id===scenId)||SCENARIOS[0];
  const ctx={booking,setBooking,scen:sc.scen,lastRating:sc.lastRating};
  const handleScenChange=id=>{setScenId(id);if(id==='new')setVpDone(false);};

  const dNewNav=[
    {icon:'🏠',label:'หน้าหลัก',pages:[{label:'หน้าหลัก',content:({openHam})=>vpDone?<DHomeNew openHam={openHam}/>:<DVP onDone={()=>setVpDone(true)}/>}]},
    {icon:'📅',label:'จอง',pages:[{label:'📍 ปักหมุด+เดินทาง',content:()=><DNStep1/>},{label:'📷 บัตรนัด',content:()=><DNStep2/>},{label:'💬 ข้อมูล',content:()=><DNStep3/>},{label:'🎯 ทีม',content:()=><DNStep4/>},{label:'✅ จ่าย+ลงทะเบียน',content:()=><DNStep5/>}]},
    {icon:'📍',label:'Live',pages:[{label:'Live',content:()=><DLiveView/>},{label:'รายงาน',content:()=><DReport/>}]},
    {icon:'🤖',label:'น้องแคร์',pages:[{label:'น้องแคร์',content:()=><DNCare/>}]},
  ];
  const dOldApptNav=[
    {icon:'🏠',label:'หน้าหลัก',pages:[{label:'หน้าหลัก',content:({openHam})=><DHomeOldAppt openHam={openHam}/>}]},
    {icon:'📅',label:'จอง',pages:[{label:'ยืนยันนัด+เดินทาง',content:()=><DOldApptBook/>},{label:'เลือกทีม',content:()=><DOldTeamSelect/>},{label:'✅ จ่ายเงิน',content:()=><DConfirmPay/>}]},
    {icon:'📍',label:'Live',pages:[{label:'Live',content:()=><DLiveView/>},{label:'รายงาน',content:()=><DReport/>}]},
    {icon:'🤖',label:'น้องแคร์',pages:[{label:'น้องแคร์',content:()=><DNCare/>}]},
  ];
  const dOldNoApptNav=[
    {icon:'🏠',label:'หน้าหลัก',pages:[{label:'หน้าหลัก',content:({openHam})=><DHomeOldNoAppt openHam={openHam}/>}]},
    {icon:'📅',label:'จอง',pages:[{label:'วันนัด+เดินทาง',content:()=><DOldNoApptBook/>},{label:'เลือกทีม',content:()=><DOldTeamSelect/>},{label:'✅ จ่ายเงิน',content:()=><DConfirmPay/>}]},
    {icon:'📍',label:'Live',pages:[{label:'Live',content:()=><DLiveView/>},{label:'รายงาน',content:()=><DReport/>}]},
    {icon:'🤖',label:'น้องแคร์',pages:[{label:'น้องแคร์',content:()=><DNCare/>}]},
  ];
  const getDNav=()=>{if(sc.scen==='new')return dNewNav;if(sc.scen==='old_appt')return dOldApptNav;return dOldNoApptNav;};
  const gNav=[{icon:'🏠',label:'หน้าหลัก',pages:[{label:'หน้าหลัก',content:()=><GHome/>}]},{icon:'📅',label:'นัดหมอ',pages:[{label:'สัปดาห์หน้า',content:()=><GUpcoming/>}]},{icon:'🔑',label:'PIN+Status',pages:[{label:'PIN+Timeline',content:()=><GPINTimeline/>}]},{icon:'🌙',label:'หลังกลับ',pages:[{label:'ให้คะแนน',content:()=><GPraise/>},{label:'กินยา',content:()=><GMed/>}]},{icon:'🤖',label:'น้องแคร์',pages:[{label:'น้องแคร์',content:()=><GNCare/>}]}];
  const rNav=[{icon:'🏠',label:'หน้าหลัก',pages:[{label:'หน้าหลัก',content:({openHam,goTo})=><RHomeMain openHam={openHam} goTo={goTo}/>}]},{icon:'🏥',label:'งานวันนี้',pages:[{label:'Brief+Steps',content:()=><RJobToday/>},{label:'ปิดงาน',content:()=><CloseHearts/>}]},{icon:'📋',label:'รับงาน',pages:[{label:'รับงาน',content:({goTo})=><CTJobBoard goTo={goTo} myTier="PN"/>}]},{icon:'🤖',label:'น้องแคร์',pages:[{label:'Contact',content:()=><CTOpContact/>}]}];
  const kNav=[{icon:'🏠',label:'หน้าหลัก',pages:[{label:'หน้าหลัก',content:({openHam,goTo})=><KHomeMain openHam={openHam} goTo={goTo}/>}]},{icon:'🔑',label:'Brief+PIN',pages:[{label:'Brief+PIN',content:()=><KBriefPIN/>},{label:'ปิดงาน',content:()=><CloseHearts/>}]},{icon:'📋',label:'รับงาน',pages:[{label:'รับงาน',content:({goTo})=><CTJobBoard goTo={goTo} myTier="Driver"/>}]},{icon:'🤖',label:'น้องแคร์',pages:[{label:'Contact',content:()=><CTOpContact/>}]}];
  const cNav=[{icon:'🏠',label:'หน้าหลัก',pages:[{label:'หน้าหลัก',content:({openHam,goTo})=><CDHomeMain openHam={openHam} goTo={goTo}/>}]},{icon:'💊',label:'ตรวจยา',pages:[{label:'OCR',content:()=><CDashOCR/>},{label:'ปิดงาน',content:()=><CloseHearts/>}]},{icon:'📋',label:'รับงาน',pages:[{label:'รับงาน',content:({goTo})=><CTJobBoard goTo={goTo} myTier="CG"/>}]},{icon:'🤖',label:'น้องแคร์',pages:[{label:'Contact',content:()=><CTOpContact/>}]}];
  const opsMobNav=[{icon:'📊',label:'Overview',pages:[{label:'Ops',content:()=><OpsMobView/>}]}];

  return(
    <Ctx.Provider value={ctx}>
      <div style={{background:'#F1F5F9',minHeight:'100vh',padding:12,fontFamily:'system-ui,sans-serif'}}>
        <div style={{textAlign:'center',marginBottom:8}}>
          <div style={{fontSize:14,fontWeight:900,color:C.drk}}>{"🏥 Welcares Wireframe v17"}</div>
          <div style={{fontSize:9,color:C.mid}}>{"Transport ในขั้นแรก · นโยบายยกเลิก · Note+AI · E-KYC 3 Steps · Income Graph · LINE ทุก entity"}</div>
        </div>
        <div style={{background:'white',borderRadius:10,padding:'7px 11px',border:'1px solid '+C.bdr,marginBottom:8,display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:10,fontWeight:700,color:C.drk,flexShrink:0}}>{"⚙️ Scenario:"}</span>
          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>{SCENARIOS.map(s=><button key={s.id} onClick={()=>handleScenChange(s.id)} style={{padding:'3px 8px',borderRadius:5,border:`1px solid ${scenId===s.id?C.pri:C.bdr}`,background:scenId===s.id?C.pri:'#fff',color:scenId===s.id?'#fff':C.mid,fontSize:9,cursor:'pointer',fontWeight:scenId===s.id?700:400}}>{s.label}</button>)}</div>
          <span style={{fontSize:9,color:'#CBD5E1'}}>{"·"}</span>
          <div style={{display:'flex',gap:3,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:9,color:C.mid}}>{"Party:"}</span>
            {[{k:'has_khabdi',l:'🚗 ขับดี'},{k:'has_dulaeh',l:'💊 ดูแล'}].map(({k,l})=><button key={k} onClick={()=>setBooking(b=>({...b,[k]:!b[k]}))} style={{padding:'3px 8px',borderRadius:5,border:`1px solid ${booking[k]?C.suc:C.bdr}`,background:booking[k]?'#ECFDF5':'#fff',color:booking[k]?C.suc:C.mid,fontSize:9,cursor:'pointer',fontWeight:booking[k]?700:400}}>{l+" "+(booking[k]?'✓':'✗')}</button>)}
          </div>
        </div>
        <div style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center',marginBottom:14}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'5px 10px',borderRadius:8,border:`1.5px solid ${tab===t.id?C.pri:C.bdr}`,background:tab===t.id?C.pri:'#fff',color:tab===t.id?'#fff':C.txt,fontWeight:tab===t.id?700:400,fontSize:10,cursor:'pointer'}}>{t.l}</button>)}
        </div>
        <div style={{display:'flex',gap:16,flexWrap:'wrap',justifyContent:'center'}}>
          {tab==='daughter'&&<PhoneShell navItems={getDNav()} hamItems={dHam} title="👩 ลูกสาว (เจดา)"/>}
          {tab==='grandma'&&<PhoneShell navItems={gNav} grandma title="👵 คุณยายมุก"/>}
          {tab==='rujai'&&<PhoneShell navItems={rNav} hamItems={ctHam} title="🤝 คุณทิพย์ (PN)"/>}
          {tab==='khabdi'&&<PhoneShell navItems={kNav} hamItems={ctHam} title="🚗 คุณสมชาย"/>}
          {tab==='dulaeh'&&<PhoneShell navItems={cNav} hamItems={ctHam} title="💊 คุณนิภา (CG)"/>}
          {tab==='ops_mob'&&<PhoneShell navItems={opsMobNav} title="📱 Ops Mobile"/>}
          {tab==='ops_web'&&<div style={{width:'100%',maxWidth:960}}><OpsWebDash/></div>}
          {tab==='mgmt_web'&&<div style={{width:'100%',maxWidth:960}}><MgmtWebDash/></div>}
          {tab==='line'&&<LineView/>}
          {tab==='intake-chat'&&<div style={{width:'100%',maxWidth:400,margin:'0 auto',height:700}}><AgentChat/></div>}
          {tab==='intake'&&<div style={{width:'100%',maxWidth:800,margin:'0 auto'}}><div style={{background:'#fff',borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,0.08)',overflow:'hidden'}}><div style={{background:C.pri,padding:'16px 24px',display:'flex',alignItems:'center',gap:'12px'}}><div style={{width:'40px',height:'40px',background:'white',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px'}}>💚</div><div><div style={{color:'white',fontWeight:700,fontSize:'18px'}}>Intake Agent MVP</div><div style={{color:'rgba(255,255,255,0.8)',fontSize:'12px'}}>ระบบรับข้อมูลจองบริการอัตโนมัติ</div></div></div><div style={{padding:'24px'}}><IntakeAgentDemo/></div></div></div>}
          {tab==='booking-agent'&&<ChatBookingAgentDemo/>}
        </div>
      </div>
    </Ctx.Provider>
  );
}