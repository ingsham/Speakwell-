import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { endCallInvitation } from "@/app/live-actions";
import LiveAudioSession from "@/components/LiveAudioSession";
import AutoRefresh from "@/components/AutoRefresh";
import { Flash } from "@/components/ui";
export default async function PrivateCallPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{ok?:string;error?:string}>}){
 const {id}=await params,sp=await searchParams;const {supabase,user}=await requireUser(`/calls/${id}`);
 const {data:inv}=await supabase.from("call_invitations").select("id,sender_id,recipient_id,message,status,expires_at,sender:profiles!sender_id(username,display_name),recipient:profiles!recipient_id(username,display_name)").eq("id",id).maybeSingle();
 if(!inv||![inv.sender_id,inv.recipient_id].includes(user.id))notFound();
 const row=inv as unknown as {id:string;sender_id:string;recipient_id:string;message:string|null;status:string;expires_at:string;sender:{username:string;display_name:string}|null;recipient:{username:string;display_name:string}|null};
 const other=row.sender_id===user.id?row.recipient:row.sender;const expired=new Date(row.expires_at).getTime()<Date.now();
 if(row.status==="pending")return <main className="mx-auto max-w-2xl px-6 py-12"><AutoRefresh intervalMs={6000}/><Flash ok={sp.ok} error={sp.error}/><div className="rounded-2xl border border-forest/10 bg-white p-7"><h1 className="text-2xl font-semibold text-forest">Waiting for acceptance</h1><p className="mt-3 leading-7 text-muted">Your private audio call invitation to {other?.display_name||"this member"} is still pending. No call will start unless they accept.</p><Link href="/connections" className="btn btn-primary mt-5">Back to connections</Link></div></main>;
 if(row.status!=="accepted"||expired)return <main className="mx-auto max-w-2xl px-6 py-12"><div className="rounded-2xl border border-forest/10 bg-white p-7"><h1 className="text-2xl font-semibold text-forest">This call is unavailable</h1><p className="mt-3 leading-7 text-muted">The invitation may have expired, been declined, or ended.</p><Link href="/connections" className="btn btn-primary mt-5">Return to connections</Link></div></main>;
 return <main className="mx-auto max-w-3xl px-6 py-10"><AutoRefresh intervalMs={6000}/><Link href="/connections" className="text-sm font-medium text-forest underline">← Connections</Link><Flash ok={sp.ok} error={sp.error}/><div className="mt-5"><LiveAudioSession roomId={id} kind="call" title={`Private conversation with ${other?.display_name||"Speakwell member"}`} canSpeak={true} backHref="/connections"/></div><form action={endCallInvitation} className="mt-4"><input type="hidden" name="id" value={id}/><button className="btn border border-red-200 text-red-700 hover:bg-red-50">End this call for both people</button></form></main>;
}
