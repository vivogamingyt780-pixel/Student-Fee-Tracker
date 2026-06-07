import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Upload, Download, RotateCcw, CheckCircle2, Cloud } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { changePassword } from "@/services/auth";
import type { CoachingProfile } from "@/services/data";

const profileSchema = z.object({
  name:      z.string().min(2, "Coaching name is required"),
  ownerName: z.string().optional(),
  mobile:    z.string().optional(),
  address:   z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword:     z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileValues  = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { profile, updateProfile, backup, restore } = useData();
  const { session } = useAuth();
  const [logoPreview,     setLogoPreview]     = useState(profile?.logoBase64 || "");
  const [profileSuccess,  setProfileSuccess]  = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError,   setPasswordError]   = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [restoreMsg,      setRestoreMsg]      = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name:      profile?.name      || "",
      ownerName: profile?.ownerName || "",
      mobile:    profile?.mobile    || "",
      address:   profile?.address   || "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert("Logo must be under 500KB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = (values: ProfileValues) => {
    const updated: CoachingProfile = {
      id:         profile?.id || session?.coachingId || "",
      userId:     session?.userId || "",
      name:       values.name,
      ownerName:  values.ownerName  || "",
      mobile:     values.mobile     || "",
      address:    values.address    || "",
      logoBase64: logoPreview,
    };
    updateProfile(updated);
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 3000);
  };

  const handlePasswordSubmit = async (values: PasswordValues) => {
    setPasswordError("");
    setPasswordLoading(true);
    try {
      const result = await changePassword(
        session!.userId,
        values.currentPassword,
        values.newPassword,
      );
      if (result.success) {
        setPasswordSuccess(true);
        passwordForm.reset();
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError(result.error || "Failed to change password");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleBackup = () => {
    const json = backup();
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `fee-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json   = ev.target?.result as string;
      const result = restore(json);
      setRestoreMsg(
        result.success ? "Data restored successfully." : (result.error || "Restore failed."),
      );
      setTimeout(() => setRestoreMsg(""), 4000);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <AppLayout title="Settings">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Cloud Sync Status ────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Data Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <Cloud className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Google Sheets — Connected</p>
                <p className="text-xs text-green-700 mt-0.5">
                  All student, fee, and receipt data is automatically saved to Google Sheets
                  and available on any device when you log in.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Coaching Profile ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Coaching Profile</CardTitle>
            <CardDescription>This information appears on your PDF receipts.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Logo */}
            <div className="mb-5">
              <p className="text-sm font-medium text-foreground mb-2">Logo</p>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground text-center px-1">No logo</span>
                  )}
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    data-testid="button-upload-logo"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">JPEG or PNG, max 500KB</p>
                  {logoPreview && (
                    <button
                      className="text-xs text-destructive mt-1 hover:underline"
                      onClick={() => setLogoPreview("")}
                    >
                      Remove logo
                    </button>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
            </div>

            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                <FormField control={profileForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coaching / Institute Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-profile-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={profileForm.control} name="ownerName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Name</FormLabel>
                      <FormControl><Input {...field} data-testid="input-owner-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={profileForm.control} name="mobile" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl><Input {...field} data-testid="input-profile-mobile" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={profileForm.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} data-testid="input-profile-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {profileSuccess && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-700">Profile saved successfully.</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" data-testid="button-save-profile">
                  <Save className="w-4 h-4 mr-2" />
                  Save Profile
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* ── Change Password ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-current-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} data-testid="input-new-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} data-testid="input-confirm-new-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                {passwordError && (
                  <Alert variant="destructive">
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}
                {passwordSuccess && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-700">Password changed successfully.</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" disabled={passwordLoading} data-testid="button-change-password">
                  {passwordLoading ? "Saving…" : "Change Password"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* ── Backup & Restore ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Backup & Restore</CardTitle>
            <CardDescription>
              Export all your data as a JSON file or restore from a previous backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {restoreMsg && (
              <Alert
                className={
                  restoreMsg.includes("success")
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }
              >
                <AlertDescription
                  className={restoreMsg.includes("success") ? "text-green-700" : "text-red-700"}
                >
                  {restoreMsg}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBackup} data-testid="button-backup">
                <Download className="w-4 h-4 mr-2" />
                Download Backup
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-restore"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore from Backup
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleRestore}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Restoring from a backup will merge the backup data with your existing data.
            </p>
          </CardContent>
        </Card>

        {/* ── Account Info ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username</span>
                <span className="font-medium">{session?.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID</span>
                <span className="font-mono text-xs text-muted-foreground">{session?.userId}</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
