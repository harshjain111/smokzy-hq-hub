import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

const phoneAuthSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const emailAuthSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [loading, setLoading] = useState(false);

  const isEmail = (input: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  const isPhone = (input: string) => /^\d{10}$/.test(input);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignup) {
        // Validate phone for signup
        const validation = phoneAuthSchema.safeParse({
          phone,
          password,
        });

        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setLoading(false);
          return;
        }

        // Create a synthetic email for phone-based accounts
        const syntheticEmail = `${phone}@smokzy.com`;
        
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: syntheticEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
              phone: phone,
            },
          },
        });

        if (signUpError) {
          const msg = signUpError.message.toLowerCase();
          if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
            toast.info("Account already exists. Please sign in or reset your password.");
            setIsSignup(false);
          } else {
            toast.error(signUpError.message);
          }
        } else if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              full_name: fullName,
              phone,
            });

          if (profileError) {
            console.error("Profile error:", profileError);
          }

          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({
              user_id: data.user.id,
              role: role,
              venue_id: null,
            });

          if (roleError) {
            console.error("Role error:", roleError);
          }

          toast.success(`${role === "admin" ? "Admin" : "Employee"} account created! Please sign in.`);
          setIsSignup(false);
          setPassword("");
          setFullName("");
          setPhone("");
          setLoginIdentifier("");
          setRole("employee");
        }
      } else {
        // Determine if input is email or phone
        let emailToUse: string;
        
        if (isEmail(loginIdentifier)) {
          // Direct email login
          const validation = emailAuthSchema.safeParse({
            email: loginIdentifier,
            password,
          });

          if (!validation.success) {
            toast.error(validation.error.errors[0].message);
            setLoading(false);
            return;
          }
          emailToUse = loginIdentifier;
        } else if (isPhone(loginIdentifier)) {
          // Convert phone to synthetic email
          emailToUse = `${loginIdentifier}@smokzy.com`;
        } else {
          toast.error("Please enter a valid email or 10-digit mobile number");
          setLoading(false);
          return;
        }
        
        const { error } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid credentials");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Logged in successfully");
        }
      }
    } catch (error: any) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!loginIdentifier) {
      toast.info('Enter your email or mobile number above to reset your password');
      return;
    }

    let emailToUse: string;
    if (isEmail(loginIdentifier)) {
      emailToUse = loginIdentifier;
    } else if (isPhone(loginIdentifier)) {
      emailToUse = `${loginIdentifier}@smokzy.com`;
    } else {
      toast.error("Please enter a valid email or 10-digit mobile number");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
      redirectTo: `${window.location.origin}/auth`
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset link sent');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Smokzy Operations
          </CardTitle>
          <CardDescription className="text-center">
            {isSignup ? "Create new account" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  required={isSignup}
                />
              </div>
            )}
            {!isSignup && (
              <div className="space-y-2">
                <Label htmlFor="loginIdentifier">Email or Mobile Number</Label>
                <Input
                  id="loginIdentifier"
                  type="text"
                  placeholder="admin@example.com or 9876543210"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  required
                />
              </div>
            )}
            {isSignup && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isSignup}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as "admin" | "employee")}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    required={isSignup}
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Processing..." : isSignup ? "Create Account" : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-primary hover:underline"
            >
              {isSignup ? "Back to sign in" : "Create new account"}
            </button>
          </div>
          {!isSignup && (
            <div className="mt-2 text-center text-xs">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-primary hover:underline"
              >
                Forgot password? Send reset link
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;