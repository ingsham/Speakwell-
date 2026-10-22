"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AudioLines, Camera, CameraOff, Mic, MicOff, PhoneOff, RefreshCw, ShieldCheck, Volume2 } from "lucide-react";
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from "livekit-client";

type Props={roomId:string;kind:"room"|"call";title:string;canSpeak:boolean;backHref:string;};
export default function LiveAudioSession({roomId,kind,title,canSpeak,backHref}:Props){
 const roomRef=useRef<Room|null>(null); const audioEls=useRef<Map<string,HTMLAudioElement>>(new Map()); const videoContainer=useRef<HTMLDivElement|null>(null);
 const [state,setState]=useState<"ready"|"connecting"|"connected"|"ended"|"error">("ready");
 const [mic,setMic]=useState(false); const [cameraOn,setCameraOn]=useState(false); const [showVideo,setShowVideo]=useState(false); const [error,setError]=useState(""); const [people,setPeople]=useState<string[]>([]);
 const refreshPeople=useCallback((room:Room)=>setPeople([room.localParticipant.name||"You",...Array.from(room.remoteParticipants.values()).map(p=>p.name||"Speakwell member")]),[]);
 const connect=useCallback(async()=>{
  setState("connecting");setError("");
  try{
   const response=await fetch("/api/livekit/token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomId,kind})});
   const body=await response.json(); if(!response.ok)throw new Error(body.error||"Could not connect.");
   const room=new Room({adaptiveStream:true,dynacast:true}); roomRef.current=room;
   room.on(RoomEvent.TrackSubscribed,(track:RemoteTrack,_publication:RemoteTrackPublication,participant:RemoteParticipant)=>{
    if(track.kind===Track.Kind.Audio){const el=track.attach();el.autoplay=true;el.setAttribute("playsinline","true");el.dataset.participant=participant.identity;document.body.appendChild(el);audioEls.current.set(`${participant.identity}-${track.sid}`,el);}
    if(track.kind===Track.Kind.Video){const el=track.attach() as HTMLVideoElement;el.autoplay=true;el.playsInline=true;el.className="w-full max-h-72 rounded-xl bg-black object-contain";videoContainer.current?.appendChild(el);setShowVideo(true);}
    refreshPeople(room);
   });
   room.on(RoomEvent.TrackUnsubscribed,(track:RemoteTrack)=>{track.detach().forEach(el=>el.remove());if(track.kind===Track.Kind.Video)setShowVideo(!!room.localParticipant.getTrackPublication(Track.Source.Camera)?.track);refreshPeople(room);});
   room.on(RoomEvent.ParticipantConnected,()=>refreshPeople(room)); room.on(RoomEvent.ParticipantDisconnected,()=>refreshPeople(room));
   room.on(RoomEvent.Disconnected,()=>{setState("ended");setMic(false);});
   await room.connect(body.url,body.token); refreshPeople(room);setState("connected");
  }catch(e){setState("error");setError(e instanceof Error?e.message:"Unable to connect to audio.");}
 },[roomId,kind,refreshPeople]);
 const toggleMic=useCallback(async()=>{const room=roomRef.current;if(!room||!canSpeak)return;try{await room.localParticipant.setMicrophoneEnabled(!mic);setMic(!mic);}catch{setError("Microphone access failed. Check browser permissions and try again.");}},[canSpeak,mic]);
 const toggleCamera=useCallback(async()=>{const room=roomRef.current;if(!room)return;try{if(cameraOn){const publication=room.localParticipant.getTrackPublication(Track.Source.Camera);await room.localParticipant.setCameraEnabled(false);publication?.track?.detach().forEach(el=>el.remove());setCameraOn(false);setShowVideo(false);}else{await room.localParticipant.setCameraEnabled(true);const publication=room.localParticipant.getTrackPublication(Track.Source.Camera);if(publication?.track){const el=publication.track.attach() as HTMLVideoElement;el.autoplay=true;el.playsInline=true;el.muted=true;el.className="w-full max-h-72 rounded-xl bg-black object-contain";videoContainer.current?.appendChild(el);}setCameraOn(true);setShowVideo(true);}}catch{setError("Camera access was not available. You can continue with audio only.");}},[cameraOn]);
 const disconnect=useCallback(async()=>{await roomRef.current?.disconnect();roomRef.current=null;audioEls.current.forEach(el=>el.remove());audioEls.current.clear();if(videoContainer.current)videoContainer.current.replaceChildren();setState("ended");setMic(false);setCameraOn(false);setShowVideo(false);},[]);
 useEffect(()=>()=>{void roomRef.current?.disconnect();audioEls.current.forEach(el=>el.remove());},[]);
 return <section className="rounded-2xl border border-forest/10 bg-white p-6 shadow-sm sm:p-8">
  <div className="flex items-start gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E5F3E5] text-[#245C43]"><AudioLines className="h-6 w-6"/></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-widest text-muted">{kind==="call"?"Private audio call":"Live audio room"}</p><h2 className="mt-1 text-xl font-semibold text-forest">{title}</h2><p className="mt-1 text-sm text-muted">{cameraOn?"Camera is on because you chose to enable it.":"Audio-first. Camera stays off until you choose to turn it on."}</p></div><span className="rounded-full bg-[#E5F3E5] px-3 py-1 text-xs font-semibold text-[#245C43]">{state==="connected"?"Connected":state==="connecting"?"Connecting…":state==="ended"?"Ended":"Not connected"}</span></div>
  {state==="connected"&&<div className="mt-6 rounded-xl bg-[#F5F8F4] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-forest"><Volume2 className="h-4 w-4"/> In this conversation ({people.length})</div><div className="mt-3 flex flex-wrap gap-2">{people.map((p,i)=><span key={`${p}-${i}`} className="rounded-full border border-forest/10 bg-white px-3 py-1.5 text-sm">{p}</span>)}</div><p className="mt-3 text-xs leading-5 text-muted">If you join as a listener, your microphone stays off. A room host must approve your request to speak.</p></div>}
  <div ref={videoContainer} className={showVideo?"mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2":"hidden"} aria-label="Optional camera video" />
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  <div className="mt-6 flex flex-wrap gap-2">
   {state==="ready"&&<button onClick={()=>void connect()} className="btn btn-primary">Connect to audio</button>}
   {state==="error"&&<button onClick={()=>void connect()} className="btn btn-primary"><RefreshCw className="h-4 w-4"/> Try again</button>}
   {state==="connecting"&&<button disabled className="btn btn-ghost">Connecting…</button>}
   {state==="connected"&&canSpeak&&<button onClick={()=>void toggleMic()} className={mic?"btn btn-primary":"btn btn-ghost"}>{mic?<Mic className="h-4 w-4"/>:<MicOff className="h-4 w-4"/>}{mic?"Mute microphone":"Turn on microphone"}</button>}
   {state==="connected"&&!canSpeak&&<p className="self-center text-sm text-muted">You are listening. Your microphone is unavailable until you are approved to speak.</p>}
   {state==="connected"&&<button onClick={()=>void toggleCamera()} className="btn btn-ghost">{cameraOn?<CameraOff className="h-4 w-4"/>:<Camera className="h-4 w-4"/>}{cameraOn?"Turn camera off":"Turn camera on (optional)"}</button>}
   {state==="connected"&&<button onClick={()=>void disconnect()} className="btn border border-red-200 text-red-700 hover:bg-red-50"><PhoneOff className="h-4 w-4"/> Leave audio</button>}
   <Link href={backHref} className="btn btn-ghost">Back</Link>
  </div>
  <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>Calls are not recorded by Speakwell. Only connect when you feel comfortable, and leave or report uncomfortable interactions.</p>
 </section>;
}
