"use client";
import { useEffect, useState } from "react";
import { AudioLines } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
export default function VoiceNotePlayer({path}:{path:string}){
 const [url,setUrl]=useState("");const [error,setError]=useState("");
 useEffect(()=>{let active=true;const load=async()=>{const supabase=createClient();const {data,error}=await supabase.storage.from("speakwell-voice-notes").createSignedUrl(path,300);if(!active)return;if(error){setError("This voice note is not available to your account.");return;}setUrl(data.signedUrl);};void load();return()=>{active=false;};},[path]);
 return <div className="mt-3 rounded-xl border border-forest/10 bg-[#F7F9F6] p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-forest"><AudioLines className="h-4 w-4"/>Voice note</div>{url?<audio controls preload="none" src={url} className="w-full"/>:<p className="text-xs text-muted">{error||"Loading audio…"}</p>}</div>;
}
