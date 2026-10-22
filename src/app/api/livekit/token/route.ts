import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

function b64url(value: unknown) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function makeToken(key: string, secret: string, identity: string, name: string, canPublish: boolean, canPublishCamera: boolean) {
 const now=Math.floor(Date.now()/1000);
 const header=b64url({alg:"HS256",typ:"JWT"});
 const video:Record<string,unknown>={roomJoin:true,room:name,canPublish:canPublish||canPublishCamera,canSubscribe:true,canPublishData:true};
 if(!canPublish&&canPublishCamera) video.canPublishSources=["camera"];
 const payload=b64url({iss:key,sub:identity,name,nbf:now-5,iat:now,exp:now+3600,video});
 const unsigned=`${header}.${payload}`;
 return `${unsigned}.${createHmac("sha256",secret).update(unsigned).digest("base64url")}`;
}
export async function POST(request: Request) {
 try {
  const {roomId,kind}=await request.json() as {roomId?:string;kind?:"room"|"call"};
  if(!roomId||!kind||!(["room","call"] as string[]).includes(kind)) return NextResponse.json({error:"Invalid session request."},{status:400});
  const key=process.env.LIVEKIT_API_KEY, secret=process.env.LIVEKIT_API_SECRET, url=process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if(!key||!secret||!url) return NextResponse.json({error:"Live audio is not configured yet. The site administrator must add the LiveKit environment variables."},{status:503});
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in to join an audio session."},{status:401});
  const {data:profile}=await supabase.from("profiles").select("display_name,suspended").eq("id",user.id).maybeSingle();
  if(profile?.suspended) return NextResponse.json({error:"Suspended accounts cannot join audio sessions."},{status:403});
  let roomName="", canPublish=false, canPublishCamera=false;
  if(kind==="room") {
   const {data:room}=await supabase.from("live_rooms").select("id,title,status,creator_id,visibility").eq("id",roomId).maybeSingle();
   if(!room||room.status!=="active") return NextResponse.json({error:"This room is not active."},{status:404});
   const {data:participant}=await supabase.from("live_room_participants").select("role,status").eq("room_id",roomId).eq("user_id",user.id).maybeSingle();
   if(!participant||participant.status!=="joined") return NextResponse.json({error:"Join the room before connecting to audio."},{status:403});
   roomName=`speakwell-room-${room.id}`; canPublish=participant.role==="host"||participant.role==="speaker"; canPublishCamera=true;
  } else {
   const {data:inv}=await supabase.from("call_invitations").select("id,sender_id,recipient_id,status,expires_at").eq("id",roomId).maybeSingle();
   if(!inv||inv.status!=="accepted"||new Date(inv.expires_at).getTime()<Date.now()||![inv.sender_id,inv.recipient_id].includes(user.id)) return NextResponse.json({error:"This private call has not been accepted or has expired."},{status:403});
   const other=inv.sender_id===user.id?inv.recipient_id:inv.sender_id;
   const {data:blocked,error:blockCheckError}=await supabase.rpc("is_blocked_between",{a:user.id,b:other});
   if(blockCheckError||blocked) return NextResponse.json({error:"This call is unavailable because of a block or a security check failed."},{status:403});
   roomName=`speakwell-call-${inv.id}`; canPublish=true; canPublishCamera=true;
  }
  const token=makeToken(key,secret,user.id,profile?.display_name||user.email||"Speakwell member",canPublish,canPublishCamera);
  return NextResponse.json({token,url,canPublish,canPublishCamera},{headers:{"Cache-Control":"no-store"}});
 } catch { return NextResponse.json({error:"Unable to prepare the audio session. Please try again."},{status:500}); }
}
