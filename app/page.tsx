'use client';
import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Plus, Send, LogOut, MessageCircle, Trash2, Menu, X, Image as ImageIcon, Download } from 'lucide-react';

type ChatSession = { id:string; title:string; created_at:string };
type ChatMessage = { id:string; role:'user'|'assistant'; content:string; created_at:string };

export default function Home() {
  const [user,setUser]=useState<User|null>(null); const [sessions,setSessions]=useState<ChatSession[]>([]);
  const [active,setActive]=useState<string|null>(null); const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [input,setInput]=useState(''); const [imageMode,setImageMode]=useState(false); const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true);
  const [sidebar,setSidebar]=useState(false); const bottom=useRef<HTMLDivElement>(null); const router=useRouter();

  useEffect(()=>{ let mounted=true; if(!isSupabaseConfigured){setLoading(false);return;}
    supabase.auth.getUser().then(({data,error})=>{if(!mounted)return;if(error)console.error('Supabase auth:',error.message);setUser(data.user);setLoading(false);if(data.user) void loadSessions(data.user.id);}).catch((error)=>{if(mounted){console.error(error);setLoading(false);}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(!mounted)return;setUser(session?.user??null);if(!session?.user){setSessions([]);setMessages([]);setActive(null)}else void loadSessions(session.user.id)});
    return ()=>{mounted=false;subscription.unsubscribe()}; },[]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'})},[messages,busy]);

  async function loadSessions(uid:string){const {data,error}=await supabase.from('chat_sessions').select('id,title,created_at').eq('user_id',uid).order('created_at',{ascending:false});if(error){console.error('Gagal memuat sesi:',error.message);return;}setSessions(data??[]);}
  async function openSession(id:string){setActive(id);setSidebar(false);const {data,error}=await supabase.from('chat_messages').select('id,role,content,created_at').eq('session_id',id).order('created_at',{ascending:true});if(error){alert(`Gagal membuka obrolan: ${error.message}`);return;}setMessages((data??[]) as ChatMessage[]);}
  async function newChat(){if(!isSupabaseConfigured)return alert('Supabase belum dikonfigurasi. Isi environment variables terlebih dahulu.');if(!user)return router.push('/auth');const {data,error}=await supabase.from('chat_sessions').insert({user_id:user.id,title:'Obrolan baru'}).select('id,title,created_at').single();if(error)return alert(error.message);setSessions(prev=>[data,...prev]);setActive(data.id);setMessages([]);setSidebar(false)}
  async function send(){const content=input.trim();if(!content||busy)return;if(!isSupabaseConfigured)return alert('Supabase belum dikonfigurasi. Isi environment variables terlebih dahulu.');if(!user)return router.push('/auth');let sessionId=active;
    if(!sessionId){const {data,error}=await supabase.from('chat_sessions').insert({user_id:user.id,title:content.slice(0, 40)}).select('id,title,created_at').single();if(error)return alert(error.message);sessionId=data.id;setActive(sessionId);setSessions(prev=>[data,...prev]);}
    const optimistic:ChatMessage={id:crypto.randomUUID(),role:'user',content,created_at:new Date().toISOString()};setMessages(prev=>[...prev,optimistic]);setInput('');setBusy(true);
    const {error:saveError}=await supabase.from('chat_messages').insert({session_id:sessionId,user_id:user.id,role:'user',content});
    if(saveError){setBusy(false);return alert(saveError.message)}
    try{const {data:{session}}=await supabase.auth.getSession();const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token??''}`},body:JSON.stringify({message:content})});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||`Gagal menghubungi Yumna (HTTP ${res.status}).`);
      const answer:ChatMessage={id:crypto.randomUUID(),role:'assistant',content:body.reply,created_at:new Date().toISOString()};setMessages(prev=>[...prev,answer]);const {error:assistantError}=await supabase.from('chat_messages').insert({session_id:sessionId,user_id:user.id,role:'assistant',content:body.reply});if(assistantError)console.error(assistantError);
    }catch(e){const msg=e instanceof Error?e.message:'Terjadi kesalahan.';setMessages(prev=>[...prev,{id:crypto.randomUUID(),role:'assistant',content:`Hmm. Ada masalah: ${msg}`,created_at:new Date().toISOString()}]);}finally{setBusy(false);}
  }
  async function generateImage(){
    const prompt=input.trim(); if(!prompt||busy)return; if(!isSupabaseConfigured)return alert('Supabase belum dikonfigurasi. Isi environment variables terlebih dahulu.'); if(!user)return router.push('/auth');
    let sessionId=active;
    if(!sessionId){const {data,error}=await supabase.from('chat_sessions').insert({user_id:user.id,title:prompt.slice(0,40)}).select('id,title,created_at').single();if(error)return alert(error.message);sessionId=data.id;setActive(sessionId);setSessions(prev=>[data,...prev]);}
    const userMessage:ChatMessage={id:crypto.randomUUID(),role:'user',content:`🖼️ Buat gambar: ${prompt}`,created_at:new Date().toISOString()};
    setMessages(prev=>[...prev,userMessage]);setInput('');setBusy(true);
    const {error:saveError}=await supabase.from('chat_messages').insert({session_id:sessionId,user_id:user.id,role:'user',content:userMessage.content});
    if(saveError){setBusy(false);return alert(saveError.message)}
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const res=await fetch('/api/image',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token??''}`},body:JSON.stringify({prompt})});
      const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||`Gagal membuat gambar (HTTP ${res.status}).`);if(typeof body.imageUrl!=='string'||!body.imageUrl)throw new Error('API tidak mengembalikan URL atau data gambar yang valid.');
      const stored=`YUMNA_IMAGE::${body.imageUrl}`;
      const assistantMessage:ChatMessage={id:crypto.randomUUID(),role:'assistant',content:stored,created_at:new Date().toISOString()};
      setMessages(prev=>[...prev,assistantMessage]);
      const {error:insertError}=await supabase.from('chat_messages').insert({session_id:sessionId,user_id:user.id,role:'assistant',content:stored});
      if(insertError)console.error(insertError);
    }catch(e){const msg=e instanceof Error?e.message:'Terjadi kesalahan.';setMessages(prev=>[...prev,{id:crypto.randomUUID(),role:'assistant',content:`Yah, gambarnya gagal dibuat: ${msg}`,created_at:new Date().toISOString()}]);}
    finally{setBusy(false);setImageMode(false)}
  }
  async function downloadImage(imageUrl:string){
    try{
      let blob:Blob;
      if(imageUrl.startsWith('data:image/')){const response=await fetch(imageUrl);blob=await response.blob();}
      else {const {data:{session}}=await supabase.auth.getSession();const response=await fetch(`/api/image/download?url=${encodeURIComponent(imageUrl)}`,{headers:{Authorization:`Bearer ${session?.access_token??''}`}});if(!response.ok)throw new Error('Download gagal.');blob=await response.blob();}
      const objectUrl=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download='yumna-ai-image.png';document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
    }catch(e){alert(e instanceof Error?e.message:'Tidak dapat mengunduh gambar.');}
  }
  async function removeSession(id:string){if(!confirm('Hapus obrolan ini?'))return;await supabase.from('chat_sessions').delete().eq('id',id);setSessions(prev=>prev.filter(s=>s.id!==id));if(active===id){setActive(null);setMessages([])}}
  async function logout(){await supabase.auth.signOut();router.push('/auth')}
  if(loading)return <main className="min-h-screen grid place-items-center font-black">YUMNA AI...</main>;
  if(!isSupabaseConfigured)return <main className="min-h-screen grid place-items-center p-5 dots"><div className="max-w-lg brutal bg-[#fff9e9] p-7"><div className="text-3xl font-black">YUMNA AI ✳</div><h1 className="mt-5 text-xl font-black">Konfigurasi belum lengkap</h1><p className="mt-3 text-sm leading-relaxed">Tambahkan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, dan NEOXR_API_KEY di file .env.local atau Vercel → Settings → Environment Variables, lalu deploy ulang.</p></div></main>;
  return <main className="min-h-screen md:h-screen md:overflow-hidden flex bg-[#fff9e9]">
    {sidebar&&<button aria-label="Tutup menu" onClick={()=>setSidebar(false)} className="fixed inset-0 bg-black/40 z-20 md:hidden"/>}
    <aside className={`${sidebar?'translate-x-0':'-translate-x-full'} md:translate-x-0 fixed md:static z-30 md:z-auto inset-y-0 left-0 w-[285px] shrink-0 bg-[#ffe45c] border-r-[3px] border-black p-4 flex flex-col transition-transform`}>
      <div className="flex justify-between items-center"><div className="font-black text-2xl tracking-tight">YUMNA<span className="text-[#ff5d83]">✳</span></div><button className="md:hidden" onClick={()=>setSidebar(false)}><X/></button></div>
      <div className="mt-2 text-xs font-bold">AI YANG KELIHATANNYA CUEK.</div>
      <button onClick={newChat} className="btn bg-white p-3 mt-7 flex items-center justify-center gap-2"><Plus size={18}/> CHAT BARU</button>
      <div className="mt-7 text-xs font-black tracking-widest">RIWAYAT OBROLAN</div>
      <div className="mt-3 flex-1 overflow-y-auto space-y-2">{sessions.map(s=><div key={s.id} className={`flex items-center gap-1 brutal-sm bg-white ${active===s.id?'!bg-[#ff9db5]':''}`}><button onClick={()=>openSession(s.id)} className="flex-1 text-left p-3 text-sm font-bold truncate"><MessageCircle size={14} className="inline mr-2"/>{s.title}</button><button onClick={()=>removeSession(s.id)} className="p-2" aria-label="Hapus sesi"><Trash2 size={15}/></button></div>)}{sessions.length===0&&<p className="text-xs font-semibold opacity-70">Belum ada obrolan. Ya sudah, mulai saja.</p>}</div>
      <div className="border-t-2 border-black pt-4 mt-4 flex items-center gap-2"><div className="w-9 h-9 rounded-full border-2 border-black bg-[#ff9db5] grid place-items-center font-black">{user?.email?.[0]?.toUpperCase()??'Y'}</div><div className="min-w-0 flex-1"><div className="font-black text-xs">{user?'KAMU':'TAMU'}</div><div className="text-[11px] truncate">{user?.email??'Login untuk menyimpan chat'}</div></div>{user&&<button onClick={logout} title="Logout"><LogOut size={18}/></button>}</div>
    </aside>
    <section className="flex-1 min-w-0 flex flex-col h-screen">
      <header className="h-[68px] shrink-0 border-b-[3px] border-black flex items-center justify-between px-4 md:px-7 bg-[#fff9e9]"><div className="flex items-center gap-3"><button className="md:hidden" onClick={()=>setSidebar(true)}><Menu/></button><div className="font-black text-lg">Yumna AI <span className="text-xs bg-[#a9d8ff] brutal-sm px-2 py-1 ml-1">BETA</span></div></div><div className="flex items-center gap-2">{user?<span className="hidden sm:block text-xs font-bold">{user.email}</span>:<button onClick={()=>router.push('/auth')} className="btn bg-[#ffe45c] px-4 py-2 text-sm">LOGIN / REGISTER</button>}</div></header>
      <div className="flex-1 overflow-y-auto px-4 py-7 md:px-10"><div className="max-w-3xl mx-auto">
        {messages.length===0?<div className="min-h-[55vh] flex flex-col justify-center items-center text-center"><div className="w-20 h-20 bg-[#ff9db5] brutal grid place-items-center text-4xl font-black rotate-3">Y.</div><div className="mt-7 bg-[#ffe45c] brutal-sm px-3 py-1 font-black text-xs -rotate-2">YOUR NOT-SO-SWEET AI</div><h1 className="mt-5 text-4xl md:text-6xl font-black tracking-tight">Mau cerita apa?</h1><p className="mt-4 max-w-md font-semibold text-sm md:text-base">“Aku nggak nungguin kamu, kok. Tapi kalau ada yang mau diceritain, sini.”</p><div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">{['Hari ini rasanya melelahkan.','Bantu aku menyusun rencana.','Aku lagi bingung soal sesuatu.','Temenin ngobrol sebentar.'].map(t=><button key={t} onClick={()=>setInput(t)} className="brutal-sm bg-white p-3 text-left text-sm font-bold hover:bg-[#a9d8ff]">↗ {t}</button>)}</div></div>:<div className="space-y-6 pb-8">{messages.map(m=><div key={m.id} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}><div className={`max-w-[88%] md:max-w-[78%] brutal p-4 ${m.role==='user'?'bg-[#a9d8ff]':'bg-white'}`}><div className="text-[10px] font-black tracking-widest mb-2">{m.role==='user'?'KAMU':'YUMNA ✳'}</div>{m.content.startsWith('YUMNA_IMAGE::')?<div className="space-y-3"><img src={m.content.slice('YUMNA_IMAGE::'.length)} alt="Gambar buatan Yumna AI" className="max-w-full rounded-sm border-2 border-black"/><button onClick={()=>downloadImage(m.content.slice('YUMNA_IMAGE::'.length))} className="btn bg-[#ffe45c] px-3 py-2 text-xs flex items-center gap-2"><Download size={15}/> DOWNLOAD GAMBAR</button></div>:<p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>}</div></div>)}{busy&&<div className="brutal bg-white p-4 inline-block text-sm font-bold">Yumna lagi mikir<span className="animate-pulse">...</span></div>}<div ref={bottom}/></div>}
      </div></div>
      <div className="shrink-0 border-t-[3px] border-black p-3 md:p-5 bg-[#fff9e9]"><div className="max-w-3xl mx-auto"><div className="brutal bg-white p-2"><div className="flex items-end gap-2"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();imageMode?generateImage():send()}}} rows={1} placeholder={imageMode?"Jelaskan gambar yang ingin dibuat...":"Ketik pesan ke Yumna..."} className="flex-1 resize-none outline-none bg-transparent p-2 text-sm max-h-32"/><button disabled={busy||!input.trim()} onClick={imageMode?generateImage:send} className="btn bg-[#ffe45c] p-3 disabled:opacity-40" aria-label={imageMode?"Buat gambar":"Kirim pesan"}>{imageMode?<ImageIcon size={18}/>:<Send size={18}/>}</button></div><div className="flex items-center justify-between px-2 pt-2"><button onClick={()=>setImageMode(v=>!v)} className={`brutal-sm px-3 py-2 text-xs font-black flex items-center gap-2 ${imageMode?'bg-[#ff9db5]':'bg-[#a9d8ff]'}`}><ImageIcon size={15}/>{imageMode?"MODE GAMBAR AKTIF":"BUAT GAMBAR"}</button><span className="text-[10px] font-bold opacity-60">{imageMode?"NEOXR BARDIMG":"ENTER UNTUK KIRIM"}</span></div></div><p className="text-center text-[10px] font-bold mt-3 opacity-60">YUMNA AI BISA SAJA SALAH. JANGAN BAGIKAN DATA SENSITIF.</p></div></div>
    </section>
  </main>;
}
