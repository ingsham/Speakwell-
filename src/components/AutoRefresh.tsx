"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
/** Keeps room rosters, speaker approvals, and pending call invitations in sync without a websocket subscription. */
export default function AutoRefresh({intervalMs=6000}:{intervalMs?:number}){
 const router=useRouter();
 useEffect(()=>{const timer=setInterval(()=>router.refresh(),intervalMs);return()=>clearInterval(timer);},[router,intervalMs]);
 return null;
}
