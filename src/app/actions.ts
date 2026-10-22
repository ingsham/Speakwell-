"use server";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser, type Db } from "@/lib/auth";
import {
  postSchema, commentSchema, reportSchema, communitySchema, profileSchema, announcementSchema, exerciseSchema,
} from "@/lib/validation";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const back = (f: FormData, fallback = "/") => {
  const b = str(f, "back");
  return b.startsWith("/") && !b.startsWith("//") ? b : fallback;
};
/** Redirect back to a page with a visible message. */
function done(path: string, kind: "error" | "ok", message?: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(message ? `${path}${sep}${kind}=${encodeURIComponent(message)}` : path);
}
const friendly = (m?: string) => {
  const t = (m ?? "").toLowerCase();
  if (t.includes("row-level security") || t.includes("not allowed") || t.includes("forbidden")) return "That isn't allowed right now.";
  if (t.includes("duplicate") || t.includes("unique")) return "That name or value is already taken.";
  if (t.includes("slow down")) return "You're sending messages too quickly. Wait a moment.";
  return m && m.length < 140 ? m : "Something went wrong. Please try again.";
};
async function check(db: Db, p: PromiseLike<{ error: { message: string } | null }>, path: string) {
  const { error } = await p;
  if (error) done(path, "error", friendly(error.message));
  void db;
}

// FOLLOW / BLOCK / REPORT ---------------------------------------------------
export async function toggleFollow(f: FormData) {
  const { supabase, user } = await requireUser();
  const target = str(f, "profileId"), path = back(f);
  if (str(f, "following") === "1") await check(supabase, supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", target), path);
  else await check(supabase, supabase.from("follows").insert({ follower_id: user.id, followee_id: target }), path);
  revalidatePath(path); done(path, "ok");
}
export async function toggleBlock(f: FormData) {
  const { supabase, user } = await requireUser();
  const target = str(f, "profileId"), path = back(f, "/settings");
  if (str(f, "blocked") === "1") {
    await check(supabase, supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", target), path);
  } else {
    await check(supabase, supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: target }), path);
    await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", target);
  }
  revalidatePath("/", "layout"); done(path, "ok", str(f, "blocked") === "1" ? "Unblocked." : "Blocked.");
}
export async function submitReport(f: FormData) {
  const { supabase, user } = await requireUser();
  const path = back(f);
  const parsed = reportSchema.safeParse({ reason: str(f, "reason") });
  if (!parsed.success) done(path, "error", parsed.error.issues[0].message);
  await check(supabase, supabase.from("reports").insert({
    reporter_id: user.id, target_type: str(f, "targetType"), target_id: str(f, "targetId"), reason: parsed.data!.reason,
  }), path);
  done(path, "ok", "Thanks. A moderator will review your report.");
}

// MESSAGES ---------------------------------------------------------------------
export async function startConversation(f: FormData) {
  const { supabase } = await requireUser();
  const path = back(f);
  const { data, error } = await supabase.rpc("start_conversation", { other: str(f, "profileId") });
  if (error) done(path, "error", friendly(error.message.includes("must follow") ? "They need to follow you first, or accept a practice invitation, before you can message." : error.message));
  redirect(`/messages/${data}`);
}

// PRACTICE INVITATIONS ------------------------------------------------------------
export async function sendInvitation(f: FormData) {
  const { supabase, user } = await requireUser();
  const path = back(f);
  const message = str(f, "message").trim().slice(0, 280) || null;
  await check(supabase, supabase.from("practice_invitations").insert({
    sender_id: user.id, recipient_id: str(f, "profileId"), message, status: "pending",
  }), path);
  done(path, "ok", "Invitation sent.");
}
export async function respondInvitation(f: FormData) {
  const { supabase } = await requireUser();
  const path = "/practice/invitations";
  const { error } = await supabase.rpc("respond_invitation", { inv: str(f, "id"), new_status: str(f, "status") });
  if (error) done(path, "error", friendly(error.message));
  revalidatePath(path); done(path, "ok");
}

// POSTS / COMMENTS / LIKES ----------------------------------------------------------
export async function createPost(f: FormData) {
  const { supabase, user } = await requireUser();
  const path = back(f, "/feed");
  const submittedPostId = str(f, "postId");
  const postId = submittedPostId || randomUUID();
  const audioPath = str(f, "audioPath");
  const rawBody = str(f, "body");
  const bodyInput = rawBody.trim() || (audioPath ? "Shared a voice note" : "");
  const parsed = postSchema.safeParse({ body: bodyInput });
  if (!parsed.success) done(path, "error", parsed.error.issues[0].message);
  if (submittedPostId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) done(path, "error", "Please refresh the feed and try again.");
  if (audioPath && !submittedPostId) done(path, "error", "Please refresh the feed before attaching a voice note.");
  if (audioPath && audioPath !== `${user.id}/${postId}/voice.webm` && audioPath !== `${user.id}/${postId}/voice.mp4`) done(path, "error", "That voice note could not be attached safely.");
  if (audioPath) {
    const { data: uploadedFiles, error: uploadCheckError } = await supabase.storage.from("speakwell-voice-notes").list(`${user.id}/${postId}`);
    if (uploadCheckError || !uploadedFiles?.some((file) => file.name === audioPath.split("/").pop())) done(path, "error", "Your voice note has not finished uploading. Please attach it again.");
  }
  // audience: "public" | "followers" | a community id. Community pages send communityId directly.
  const audience = str(f, "audience") || "public";
  const communityId = str(f, "communityId") || (audience !== "public" && audience !== "followers" ? audience : "");
  await check(supabase, supabase.from("posts").insert({
    id: postId, author_id: user.id, body: parsed.data!.body, audio_path: audioPath || null,
    community_id: communityId || null, visibility: audience === "followers" && !communityId ? "followers" : "public",
  }), path);
  revalidatePath(path); done(path, "ok", "Posted.");
}
export async function sharePost(f: FormData) {
  const { supabase, user } = await requireUser();
  const path = back(f, "/feed");
  const note = str(f, "body").trim().slice(0, 3000);
  const { data: src } = await supabase.from("posts").select("id,shared_post_id").eq("id", str(f, "postId")).maybeSingle();
  if (!src) done(path, "error", "That post is no longer available.");
  const { error } = await supabase.from("posts").insert({
    author_id: user.id, body: note, community_id: null, visibility: "public", shared_post_id: src!.shared_post_id ?? src!.id,
  });
  if (error) done(path, "error", "This post can't be shared because it's in a private space.");
  revalidatePath("/feed"); done(path, "ok", "Shared to your profile.");
}
export async function addComment(f: FormData) {
  const { supabase, user } = await requireUser();
  const path = back(f, "/feed");
  const parsed = commentSchema.safeParse({ body: str(f, "body") });
  if (!parsed.success) done(path, "error", parsed.error.issues[0].message);
  await check(supabase, supabase.from("comments").insert({ post_id: str(f, "postId"), author_id: user.id, body: parsed.data!.body }), path);
  revalidatePath(path); done(path, "ok");
}
export async function toggleLike(f: FormData) {
  const { supabase, user } = await requireUser();
  const path = back(f, "/feed"), postId = str(f, "postId");
  if (str(f, "liked") === "1") await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id).eq("kind", "like");
  else await supabase.from("reactions").insert({ post_id: postId, user_id: user.id, kind: "like" });
  revalidatePath(path); done(path, "ok");
}
export async function deletePost(f: FormData) {
  const { supabase, user } = await requireUser();
  const path = back(f, "/feed");
  const postId = str(f, "postId");
  const { data: post } = await supabase.from("posts").select("audio_path,author_id").eq("id", postId).maybeSingle();
  if (post?.audio_path && post.author_id === user.id) await supabase.storage.from("speakwell-voice-notes").remove([post.audio_path]);
  await check(supabase, supabase.from("posts").delete().eq("id", postId), path);
  revalidatePath(path); done(path, "ok", "Post deleted.");
}
export async function deleteComment(f: FormData) {
  const { supabase } = await requireUser();
  const path = back(f, "/feed");
  await check(supabase, supabase.from("comments").delete().eq("id", str(f, "commentId")), path);
  revalidatePath(path); done(path, "ok");
}
export async function setPostFlag(f: FormData) { // community moderators: pin / remove
  const { supabase } = await requireUser();
  const path = back(f, "/feed");
  const patch = str(f, "flag") === "pinned" ? { pinned: str(f, "value") === "1" } : { removed: true };
  await check(supabase, supabase.from("posts").update(patch).eq("id", str(f, "postId")), path);
  revalidatePath(path); done(path, "ok");
}

// COMMUNITIES ---------------------------------------------------------------------
export async function createCommunity(f: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = communitySchema.safeParse({
    name: str(f, "name"), description: str(f, "description"), category: str(f, "category"),
    guidelines: str(f, "guidelines"), visibility: str(f, "visibility"),
  });
  if (!parsed.success) done("/communities/new", "error", parsed.error.issues[0].message);
  const v = parsed.data!;
  const { data, error } = await supabase.from("communities").insert({
    owner_id: user.id, name: v.name, description: v.description || null, category: v.category || null,
    guidelines: v.guidelines || null, visibility: v.visibility,
  }).select("id").single();
  if (error) done("/communities/new", "error", friendly(error.message));
  redirect(`/communities/${data!.id}`);
}
export async function joinCommunity(f: FormData) {
  const { supabase } = await requireUser();
  const path = back(f, "/communities");
  const { data, error } = await supabase.rpc("join_community", { cid: str(f, "communityId") });
  if (error) done(path, "error", friendly(error.message.includes("invitation") ? "This community is invite-only." : error.message));
  revalidatePath("/communities", "layout");
  done(path, "ok", data === "requested" ? "Request sent. A moderator will review it." : undefined);
}
export async function leaveCommunity(f: FormData) {
  const { supabase, user } = await requireUser();
  const path = back(f, "/communities");
  await check(supabase, supabase.from("community_members").delete().eq("community_id", str(f, "communityId")).eq("user_id", user.id), path);
  revalidatePath("/communities", "layout"); done("/communities", "ok", "You left the community.");
}
export async function decideJoinRequest(f: FormData) {
  const { supabase } = await requireUser();
  const path = back(f, "/communities");
  const { error } = await supabase.rpc("decide_join_request", { req: str(f, "requestId"), approve: str(f, "approve") === "1" });
  if (error) done(path, "error", friendly(error.message));
  revalidatePath(path); done(path, "ok");
}
export async function inviteToCommunity(f: FormData) {
  const { supabase, user } = await requireUser();
  const path = back(f, "/communities");
  const username = str(f, "username").trim().toLowerCase().replace(/^@/, "");
  const { data: target } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (!target) done(path, "error", "No public user with that username.");
  await check(supabase, supabase.from("community_invitations").insert({
    community_id: str(f, "communityId"), invitee_id: target!.id, inviter_id: user.id, status: "pending",
  }), path);
  done(path, "ok", "Invitation sent.");
}
export async function declineCommunityInvite(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("community_invitations").update({ status: "declined" }).eq("id", str(f, "id"));
  revalidatePath("/communities"); done("/communities", "ok");
}
export async function setMemberRole(f: FormData) {
  const { supabase } = await requireUser();
  const path = back(f, "/communities");
  const { error } = await supabase.rpc("set_member_role", { cid: str(f, "communityId"), uid: str(f, "userId"), new_role: str(f, "role") });
  if (error) done(path, "error", friendly(error.message));
  revalidatePath(path); done(path, "ok");
}
export async function removeMember(f: FormData) {
  const { supabase } = await requireUser();
  const path = back(f, "/communities");
  await check(supabase, supabase.from("community_members").delete().eq("community_id", str(f, "communityId")).eq("user_id", str(f, "userId")), path);
  revalidatePath(path); done(path, "ok");
}

// NOTIFICATIONS ---------------------------------------------------------------------
export async function markAllRead() {
  const { supabase, user } = await requireUser();
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  revalidatePath("/", "layout"); done("/notifications", "ok");
}

// SETTINGS -------------------------------------------------------------------------------
export async function updateProfile(f: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = profileSchema.safeParse({
    displayName: str(f, "displayName"), username: str(f, "username"), bio: str(f, "bio"), goals: str(f, "goals"),
    country: str(f, "country"),
    interests: str(f, "interests").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  });
  if (!parsed.success) done("/settings", "error", parsed.error.issues[0].message);
  const v = parsed.data!;
  await check(supabase, supabase.from("profiles").update({
    display_name: v.displayName, username: v.username, bio: v.bio || null, goals: v.goals || null,
    country: v.country || null, interests: v.interests, is_public: f.get("isPublic") === "on", onboarded: true,
  }).eq("id", user.id), "/settings");
  const weekly = Math.min(21, Math.max(1, parseInt(str(f, "weekly"), 10) || 3));
  await supabase.from("practice_goals").upsert({ user_id: user.id, weekly_sessions: weekly });
  await supabase.from("user_preferences").upsert({
    user_id: user.id, notify_messages: f.get("nMessages") === "on", notify_invitations: f.get("nInvites") === "on",
    notify_followers: f.get("nFollowers") === "on",
  });
  revalidatePath("/", "layout"); done("/settings", "ok", "Saved.");
}
export async function deleteMyAccount() {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) done("/settings", "error", friendly(error.message));
  await supabase.auth.signOut(); redirect("/");
}

// ADMIN ----------------------------------------------------------------------------------
export async function adminSuspend(f: FormData) {
  const { supabase } = await requireUser();
  const path = back(f, "/admin/users");
  const why = str(f, "why").trim();
  if (why.length < 3) done(path, "error", "Add a reason (3+ characters).");
  const { error } = await supabase.rpc("admin_set_suspended", { target: str(f, "userId"), suspend: str(f, "suspend") === "1", why });
  if (error) done(path, "error", friendly(error.message));
  revalidatePath(path); done(path, "ok");
}
export async function adminSetRole(f: FormData) {
  const { supabase } = await requireUser();
  const path = back(f, "/admin/users");
  const { error } = await supabase.rpc("admin_set_role", { target: str(f, "userId"), new_role: str(f, "role") });
  if (error) done(path, "error", friendly(error.message));
  revalidatePath(path); done(path, "ok", "Role updated.");
}
export async function adminResolveReport(f: FormData) {
  const { supabase } = await requireUser();
  const path = "/admin/reports";
  const { error } = await supabase.rpc("admin_resolve_report", {
    rid: str(f, "reportId"), dismiss: str(f, "outcome") === "dismiss", note: str(f, "note"),
    remove_content: str(f, "outcome") === "remove",
  });
  if (error) done(path, "error", friendly(error.message.includes("reason") ? "Add a reason (3+ characters)." : error.message));
  revalidatePath(path); done(path, "ok");
}
export async function adminSetSetting(f: FormData) {
  const { supabase } = await requireUser();
  const key = str(f, "key");
  const value = key.endsWith("_enabled") ? (f.get("value") === "on" ? "true" : "false") : str(f, "value");
  const { error } = await supabase.rpc("admin_set_setting", { k: key, v: value });
  if (error) done("/admin/settings", "error", friendly(error.message));
  revalidatePath("/", "layout"); done("/admin/settings", "ok", "Saved.");
}
export async function adminCreateAnnouncement(f: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = announcementSchema.safeParse({ title: str(f, "title"), body: str(f, "body"), kind: str(f, "kind") });
  if (!parsed.success) done("/admin/settings", "error", parsed.error.issues[0].message);
  await check(supabase, supabase.from("announcements").insert({ ...parsed.data!, body: parsed.data!.body || null, created_by: user.id }), "/admin/settings");
  revalidatePath("/", "layout"); done("/admin/settings", "ok", "Announcement published.");
}
export async function adminToggleAnnouncement(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("announcements").update({ active: str(f, "active") === "1" }).eq("id", str(f, "id"));
  revalidatePath("/", "layout"); done("/admin/settings", "ok");
}
export async function adminSaveExercise(f: FormData) {
  const { supabase } = await requireUser();
  const parsed = exerciseSchema.safeParse({
    category: str(f, "category"), title: str(f, "title"), prompt: str(f, "prompt"),
    suggestedSeconds: parseInt(str(f, "seconds"), 10) || 120,
  });
  if (!parsed.success) done("/admin/settings", "error", parsed.error.issues[0].message);
  const v = parsed.data!;
  await check(supabase, supabase.from("practice_exercises").insert({
    category: v.category, title: v.title, prompt: v.prompt, suggested_seconds: v.suggestedSeconds,
  }), "/admin/settings");
  done("/admin/settings", "ok", "Exercise added.");
}
export async function adminToggleExercise(f: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("practice_exercises").update({ is_active: str(f, "active") === "1" }).eq("id", str(f, "id"));
  revalidatePath("/admin/settings"); done("/admin/settings", "ok");
}
export async function adminSetCommunityRemoved(f: FormData) {
  const { supabase } = await requireUser();
  const path = "/admin/communities";
  await check(supabase, supabase.from("communities").update({ removed: str(f, "removed") === "1" }).eq("id", str(f, "communityId")), path);
  revalidatePath("/communities", "layout"); done(path, "ok");
}
export async function adminCreateGeneral() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("join_general");
  if (error || !data) done("/admin/communities", "error", "Couldn't create it. Only works once an admin exists.");
  revalidatePath("/communities", "layout"); done("/admin/communities", "ok", "Speakwell Lounge is ready.");
}
