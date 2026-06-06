import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Eye, EyeOff } from "lucide-react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const schema = z.object({
  coachingName: z.string().min(2, "Coaching name is required (min 2 chars)"),
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, underscores"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { signup } = useAuth();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { coachingName: "", username: "", password: "", confirmPassword: "" },
  });

  const handleSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setError("");
    const result = await signup(values.username, values.password, values.coachingName);
    setIsLoading(false);
    if (result.success) {
      setLocation("/dashboard");
    } else {
      setError(result.error || "Signup failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-md">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Fee Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">Set up your coaching fee management</p>
        </div>

        <div className="bg-card border border-card-border rounded-2xl shadow-md p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">Create your account</h2>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField control={form.control} name="coachingName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Coaching / Institute Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Brilliant Academy" {...field} data-testid="input-coaching-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Choose a username" {...field} data-testid="input-username" autoComplete="username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        {...field}
                        data-testid="input-password"
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Repeat your password"
                      {...field}
                      data-testid="input-confirm-password"
                      autoComplete="new-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signup">
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
