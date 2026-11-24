
import { useState, useEffect, ChangeEvent, useRef } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Trash2,
  Edit,
  UploadCloud,
  Tag,
  CalendarDays,
  Loader2,
  Mail,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCurrentProfile,
  updateProfile,
  uploadAvatar,
  removeAvatar,
  type Profile,
} from "@/lib/profile";
import { supabase } from "@/lib/supabaseClient";
import Head from "next/head";

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [conditionTags, setConditionTags] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load current user's profile
  useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return null;
      }

      const data = await getCurrentProfile();

      if (!data) {
        router.push("/auth/login");
        return null;
      }

      setProfile(data);
      setFullName(data.full_name || "");
      setConditionTags((data.condition_tags || []).join(", "));
      setLoading(false);

      return data;
    },
  });

  // Generate and clean up avatar preview
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  // Subscribe to user-specific notifications
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function subscribeToUserChannel() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.push("/auth/login");
        return;
      }

      channel = supabase.channel(`user-channel-${user.id}`, {
        config: { broadcast: { self: false } },
      });

      broadcastChannelRef.current = channel;

      channel
        .on("broadcast", { event: "*" }, (payload: { payload: { message?: string } }) => {
          const message = payload?.payload?.message;

          if (message) {
            toast.success(
              `Notification: ${message.replace(/\./g, "")} from another device or tab.`
            );
          }
        })
        .subscribe((status) => {
          console.log("User-specific channel status:", status);
        });
    }

    subscribeToUserChannel();

    return () => {
      cancelled = true;

      if (channel) {
        supabase.removeChannel(channel);
      }

      broadcastChannelRef.current = null;
    };
  }, [router]);

  // Handle avatar selection
  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB.");
      return;
    }

    setAvatarFile(file);
  };

  // Update profile
  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setProfileLoading(true);

    try {
      let avatar_url = profile?.avatar_url || null;

      if (avatarFile) {
        avatar_url = await uploadAvatar(avatarFile);
      }

      const tagsArray = conditionTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const updatedProfile = await updateProfile({
        full_name: fullName.trim(),
        avatar_url,
        condition_tags: tagsArray,
      });

      if (!updatedProfile) {
        toast.error("Failed to update your profile. Please try again.");
        return;
      }

      setProfile(updatedProfile);
      setEditDialogOpen(false);
      toast.success("Profile updated successfully.");

      setProfile(updatedProfile);
      setFullName(updatedProfile.full_name || "");
      setConditionTags((updatedProfile.condition_tags || []).join(", "));
      setAvatarFile(null);
      setEditDialogOpen(false);

      toast.success("Profile updated successfully!");
    } catch (error: unknown) {
      toast.error(
        "Error updating profile: " +
          (error instanceof Error ? error.message : "Please try again.")
      );
    } finally {
      setProfileLoading(false);
    }
  };

  // Remove avatar
  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url) return;

    setProfileLoading(true);

    try {
      await removeAvatar();

      const updatedProfile = await updateProfile({
        full_name: fullName,
        avatar_url: null,
        condition_tags: profile.condition_tags,
      });

      setProfile(updatedProfile);
      setAvatarFile(null);
      setAvatarPreview(null);

      toast.success("Profile photo removed.");
    } catch (error: unknown) {
      toast.error(
        "Error removing avatar: " +
          (error instanceof Error ? error.message : "Please try again.")
      );
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f8]">
        <Loader2 className="h-9 w-9 animate-spin text-[#405f73]" />
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.full_name || "Your Profile";
  const initials = (profile.full_name || profile.email || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Not available";

  return (
    <>
      <Head>
        <title>SymptomSync | Your Profile</title>
        <meta
          name="description"
          content="View and manage your SymptomSync profile."
        />
      </Head>

      <main className="min-h-screen bg-[#f7f8f8] text-[#27333b]">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">

          {/* Page heading */}
          <div className="mb-9">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[2px] text-[#718b9b]">
              Account settings
            </p>

            <h1 className="text-3xl font-semibold tracking-[-1.3px] sm:text-4xl">
              Your profile
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#69747b]">
              Manage your personal information and the details associated
              with your account.
            </p>
          </div>

          {/* Profile overview */}
          <section className="overflow-hidden rounded-[26px] border border-[#e4e8e9] bg-white shadow-[0_8px_35px_rgba(39,51,59,0.035)]">

            {/* Profile banner */}
            <div className="h-28 bg-[#e6edf2] sm:h-36">
              <div className="flex h-full items-center justify-end px-6">
                <span className="text-xs font-medium tracking-wide text-[#718b9b]">
                  PERSONAL PROFILE
                </span>
              </div>
            </div>

            <div className="px-6 pb-7 sm:px-9 sm:pb-9">
              <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">

                {/* Avatar and name */}
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
                  <Avatar className="h-24 w-24 border-4 border-white bg-[#e6edf2] shadow-sm sm:h-28 sm:w-28">
                    {profile.avatar_url ? (
                      <AvatarImage
                        src={profile.avatar_url}
                        alt={displayName}
                      />
                    ) : (
                      <AvatarFallback className="bg-[#e6edf2] text-[#405f73]">
                        <span className="text-2xl font-semibold">
                          {initials}
                        </span>
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className="pb-1">
                    <h2 className="max-w-full truncate text-2xl font-semibold tracking-[-0.8px] sm:text-3xl">
                      {displayName}
                    </h2>

                    <p className="mt-1 text-sm text-[#69747b]">
                      {profile.email}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => setEditDialogOpen(true)}
                  className="h-10 w-full rounded-full bg-[#405f73] px-5 text-sm font-medium text-white transition-colors hover:bg-[#324e60] sm:mb-1 sm:w-auto"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit profile
                </Button>
              </div>

              <div className="my-8 border-t border-[#e9edef]" />

              {/* Profile details */}
              <div>
                <div className="mb-5">
                  <h3 className="text-base font-semibold tracking-tight">
                    Personal information
                  </h3>
                  <p className="mt-1 text-sm text-[#89949a]">
                    Your account details and profile information.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">

                  {/* Email */}
                  <div className="flex items-start gap-4 rounded-2xl border border-[#e9edef] bg-[#fcfcfc] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6edf2] text-[#587587]">
                      <Mail size={19} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#89949a]">
                        Email address
                      </p>
                      <p className="mt-1 break-all text-sm font-medium text-[#35434c]">
                        {profile.email}
                      </p>
                    </div>
                  </div>

                  {/* Join date */}
                  <div className="flex items-start gap-4 rounded-2xl border border-[#e9edef] bg-[#fcfcfc] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9ebf2] text-[#69758a]">
                      <CalendarDays size={19} />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[#89949a]">
                        Member since
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#35434c]">
                        {joinedDate}
                      </p>
                    </div>
                  </div>

                  {/* Full name */}
                  <div className="flex items-start gap-4 rounded-2xl border border-[#e9edef] bg-[#fcfcfc] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1ece5] text-[#8b7865]">
                      <UserRound size={19} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#89949a]">
                        Full name
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-[#35434c]">
                        {profile.full_name || "Not provided"}
                      </p>
                    </div>
                  </div>

                  {/* Profile status */}
                  <div className="flex items-start gap-4 rounded-2xl border border-[#e9edef] bg-[#fcfcfc] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6edf2] text-[#587587]">
                      <User size={19} />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[#89949a]">
                        Account
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#35434c]">
                        Active profile
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditions */}
              <div className="mt-9 border-t border-[#e9edef] pt-7">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">
                      Health conditions
                    </h3>
                    <p className="mt-1 text-sm text-[#89949a]">
                      Conditions you've added to your profile.
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6edf2] text-[#587587]">
                    <Tag size={19} />
                  </div>
                </div>

                {profile.condition_tags && profile.condition_tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.condition_tags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#dce4e8] bg-[#f4f7f8] px-4 py-2 text-sm font-medium text-[#587587]"
                      >
                        <Tag size={14} />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#dce2e5] bg-[#fcfcfc] px-5 py-7 text-center">
                    <Tag className="mx-auto mb-3 h-6 w-6 text-[#a0adb4]" />

                    <p className="text-sm font-medium text-[#58656d]">
                      No conditions added yet
                    </p>

                    <p className="mt-1 text-xs text-[#89949a]">
                      You can add health conditions when editing your profile.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Edit profile dialog */}
          <Dialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              if (!profileLoading) {
                setEditDialogOpen(open);

                if (!open) {
                  setFullName(profile.full_name || "");
                  setConditionTags(
                    (profile.condition_tags || []).join(", ")
                  );
                  setAvatarFile(null);
                }
              }
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[24px] border border-[#e4e8e9] bg-white p-6 shadow-xl sm:max-w-lg sm:p-8">
              <DialogHeader>
                <p className="text-xs font-semibold uppercase tracking-[2px] text-[#718b9b]">
                  Account settings
                </p>

                <DialogTitle className="text-2xl font-semibold tracking-tight text-[#27333b]">
                  Edit your profile
                </DialogTitle>

                <DialogDescription className="text-sm leading-6 text-[#69747b]">
                  Update your personal information and profile photo.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleUpdateProfile} className="mt-5 space-y-6">

                {/* Avatar editor */}
                <div className="rounded-2xl border border-[#e9edef] bg-[#fcfcfc] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Avatar className="h-20 w-20 border border-[#e4e8e9]">
                      {avatarPreview || profile.avatar_url ? (
                        <AvatarImage
                          src={avatarPreview || profile.avatar_url || ""}
                          alt="Profile preview"
                        />
                      ) : (
                        <AvatarFallback className="bg-[#e6edf2] text-[#405f73]">
                          <span className="text-xl font-semibold">
                            {initials}
                          </span>
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <Label
                        htmlFor="avatar"
                        className="mb-2 block text-sm font-semibold text-[#35434c]"
                      >
                        Profile photo
                      </Label>

                      <Input
                        id="avatar"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="h-auto cursor-pointer rounded-xl border-[#dce2e5] bg-white p-2 text-xs text-[#69747b] file:mr-3 file:rounded-lg file:border-0 file:bg-[#e6edf2] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#405f73] hover:file:bg-[#dce7ed]"
                      />

                      <p className="mt-2 text-xs text-[#89949a]">
                        JPG, PNG, or another image format. Maximum 5MB.
                      </p>
                    </div>
                  </div>

                  {profile.avatar_url && !avatarFile && (
                    <button
                      type="button"
                      disabled={profileLoading}
                      onClick={handleRemoveAvatar}
                      className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[#a35c5c] transition-colors hover:text-[#843e3e] disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      Remove profile photo
                    </button>
                  )}
                </div>

                {/* Name */}
                <div>
                  <Label
                    htmlFor="fullName"
                    className="mb-2 block text-sm font-medium text-[#35434c]"
                  >
                    Full name
                  </Label>

                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="h-11 rounded-xl border-[#dce2e5] bg-[#fcfcfc] px-4 text-sm focus-visible:border-[#718b9b] focus-visible:ring-2 focus-visible:ring-[#718b9b]/20"
                  />
                </div>

                {/* Conditions */}
                <div>
                  <Label
                    htmlFor="conditionTags"
                    className="mb-2 block text-sm font-medium text-[#35434c]"
                  >
                    Health conditions
                  </Label>

                  <Input
                    id="conditionTags"
                    type="text"
                    value={conditionTags}
                    onChange={(e) => setConditionTags(e.target.value)}
                    placeholder="e.g., Asthma, Diabetes"
                    className="h-11 rounded-xl border-[#dce2e5] bg-[#fcfcfc] px-4 text-sm focus-visible:border-[#718b9b] focus-visible:ring-2 focus-visible:ring-[#718b9b]/20"
                  />

                  <p className="mt-2 text-xs text-[#89949a]">
                    Separate multiple conditions with commas.
                  </p>
                </div>

                <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={profileLoading}
                    onClick={() => setEditDialogOpen(false)}
                    className="rounded-full border-[#dce2e5] px-5 text-sm text-[#58656d] hover:bg-[#f7f8f8]"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={profileLoading}
                    className="rounded-full bg-[#405f73] px-5 text-sm text-white hover:bg-[#324e60]"
                  >
                    {profileLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Save changes
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Footer */}
          <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-[#e4e8e9] py-5 text-xs text-[#89949a] sm:flex-row">
            <p>© {new Date().getFullYear()} SymptomSync</p>
            <p>Your health, in perspective.</p>
          </footer>
        </div>
      </main>
    </>
  );
}