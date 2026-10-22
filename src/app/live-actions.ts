"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
const value = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
const go = (path: string, kind: "error"|"ok", msg: string): never => redirect(`${path}${path.includes("?")?"&":"?"}${kind}=${encodeURIComponent(msg)}`);
export async function createLiveRoom(f: FormData) {
 const {supabase,user}=await requireUser("/rooms");
 const title=value(f,"title"), description=value(f,"description").slice(0,500), topic=value(f,"topic").slice(0,60)||"Open conversation";
 if(title.length<3||title.length>90) go("/rooms","error","Give your room a title between 3 and 90 characters.");
 const {data,error}=await supabase.from("live_rooms").insert({creator_id:user.id,title,description:description||null,topic,visibility:value(f,"visibility")==="private"?"private":"public",capacity:12,status:"active"}).select("id").single();
 if(error||!data) go("/rooms","error",error?.message||"Could not create the room. Apply migration 0005 first.");
 const {error:hostError}=await supabase.from("live_room_participants").insert({room_id:data.id,user_id:user.id,role:"host",status:"joined",speaking_request:"none"});
 if(hostError){ await supabase.from("live_rooms").update({status:"ended",ended_at:new Date().toISOString()}).eq("id",data.id); go("/rooms","error","Room created but host setup failed. Please try again."); }
 revalidatePath("/rooms"); redirect(`/rooms/${data.id}`);
}
export async function joinLiveRoom(f: FormData) {
 const {supabase}=await requireUser("/rooms"); const id=value(f,"roomId");
 const {error}=await supabase.rpc("join_live_room",{room_uuid:id});
 if(error) go("/rooms","error",error.message);
 redirect(`/rooms/${id}`);
}
export async function leaveLiveRoom(f: FormData) {
 const {supabase}=await requireUser(); const id=value(f,"roomId");
 const {error}=await supabase.rpc("leave_live_room",{room_uuid:id}); if(error) go(`/rooms/${id}`,"error","Could not leave room. Please try again.");
 revalidatePath(`/rooms/${id}`); redirect("/rooms");
}
export async function requestSpeaker(f: FormData) {
 const {supabase}=await requireUser(); const id=value(f,"roomId");
 const {error}=await supabase.rpc("request_room_speaker",{room_uuid:id});
 if(error) go(`/rooms/${id}`,"error",error.message); revalidatePath(`/rooms/${id}`); go(`/rooms/${id}`,"ok","Your request to speak has been sent to the host.");
}
export async function decideSpeaker(f: FormData) {
 const {supabase}=await requireUser(); const id=value(f,"roomId"), target=value(f,"userId"), approve=value(f,"approve")==="true";
 const {error}=await supabase.rpc("decide_room_speaker",{room_uuid:id,target_user:target,approve});
 if(error) go(`/rooms/${id}`,"error",error.message); revalidatePath(`/rooms/${id}`); go(`/rooms/${id}`,"ok",approve?"Speaker approved.":"Request declined.");
}
export async function endLiveRoom(f: FormData) {
 const {supabase,user}=await requireUser(); const id=value(f,"roomId");
 const {error}=await supabase.from("live_rooms").update({status:"ended",ended_at:new Date().toISOString()}).eq("id",id).eq("creator_id",user.id);
 if(error) go(`/rooms/${id}`,"error",error.message); revalidatePath("/rooms"); redirect("/rooms");
}
export async function sendCallInvitation(f: FormData) {
 const {supabase,user}=await requireUser("/connections"); const username=value(f,"username").replace(/^@/,"").toLowerCase(); const message=value(f,"message").slice(0,280);
 if(!username) go("/connections","error","Enter the person's username.");
 const {data:target}=await supabase.from("profiles").select("id,username").eq("username",username).maybeSingle();
 if(!target||target.id===user.id) go("/connections","error","We couldn't find that person. Check the username.");
 const {error}=await supabase.from("call_invitations").insert({sender_id:user.id,recipient_id:target.id,message:message||null,status:"pending"});
 if(error) go("/connections","error",error.message.includes("duplicate")?"You already have a pending call invitation to this person.":error.message);
 revalidatePath("/connections"); go("/connections","ok","Audio call invitation sent. They must accept before the call can start.");
}
export async function respondCallInvitation(f: FormData) {
 const {supabase,user}=await requireUser("/connections"); const id=value(f,"id"), status=value(f,"status");
 if(!["accepted","declined","cancelled"].includes(status)) go("/connections","error","Invalid invitation response.");
 const {error}=await supabase.rpc("respond_call_invitation",{inv_uuid:id,new_status:status}); if(error) go("/connections","error",error.message);
 revalidatePath("/connections"); revalidatePath(`/calls/${id}`); go("/connections","ok",status==="accepted"?"Invitation accepted. You can now start your private audio call.":status==="declined"?"Invitation declined.":"Invitation cancelled.");
}

export async function endCallInvitation(f: FormData) {
 const {supabase,user}=await requireUser("/connections"); const id=value(f,"id");
 const {error}=await supabase.rpc("end_call_invitation",{inv_uuid:id});
 if(error) go(`/calls/${id}`,"error",error.message);
 revalidatePath("/connections"); redirect("/connections");
}

export async function sendRoomInvitation(f: FormData) {
 const {supabase,user}=await requireUser("/rooms"); const roomId=value(f,"roomId"),username=value(f,"username").replace(/^@/,"").toLowerCase();
 if(!username) go(`/rooms/${roomId}`,"error","Enter the person's username.");
 const {data:room}=await supabase.from("live_rooms").select("id,creator_id,status").eq("id",roomId).maybeSingle();
 if(!room||room.creator_id!==user.id||room.status!=="active") go("/rooms","error","Only the host can invite people to an active room.");
 const {data:target}=await supabase.from("profiles").select("id").eq("username",username).maybeSingle();
 if(!target||target.id===user.id) go(`/rooms/${roomId}`,"error","We couldn't find that person. Check their username.");
 const {error}=await supabase.from("live_room_invitations").insert({room_id:roomId,sender_id:user.id,recipient_id:target.id,status:"pending"});
 if(error) go(`/rooms/${roomId}`,"error",error.message.includes("duplicate")?"This person already has a pending invitation.":error.message);
 revalidatePath(`/rooms/${roomId}`); go(`/rooms/${roomId}`,"ok","Room invitation sent.");
}
export async function respondRoomInvitation(f: FormData) {
 const {supabase,user}=await requireUser("/rooms"); const id=value(f,"id"),status=value(f,"status");
 if(!["accepted","declined"].includes(status)) go("/rooms","error","Invalid room invitation response.");
 const {data:inv}=await supabase.from("live_room_invitations").select("room_id").eq("id",id).eq("recipient_id",user.id).eq("status","pending").maybeSingle();
 if(!inv) go("/rooms","error","This invitation is no longer available.");
 const {error}=await supabase.rpc("respond_room_invitation",{inv_uuid:id,new_status:status});
 if(error) go("/rooms","error",error.message); revalidatePath("/rooms"); if(status==="accepted") redirect(`/rooms/${inv!.room_id}`); go("/rooms","ok","Invitation declined.");
}
