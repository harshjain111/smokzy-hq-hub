import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import loginBackground from "@/assets/login-background.jpg";
import smokzyLogo from "@/assets/smokzy-logo.png";

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
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
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
    } catch (error: any) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden p-4"
      style={{
        backgroundImage: `url(${loginBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: 'hsl(var(--auth-background))',
      }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Golden accent gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-auth-gold/10 via-transparent to-auth-gold/5" />
      
      <Card className="w-full max-w-md relative z-10 bg-auth-card/95 backdrop-blur-md border-auth-gold/20 shadow-2xl">
        <CardHeader className="space-y-4 pb-8">
          <div className="flex justify-center mb-2">
            <img 
              src={smokzyLogo} 
              alt="Smokzy Logo" 
              className="h-16 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-auth-gold">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            Sign in to access Smokzy Operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="loginIdentifier" className="text-gray-300">
                Email or Mobile Number
              </Label>
              <Input
                id="loginIdentifier"
                type="text"
                placeholder="admin@example.com or 9876543210"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
                className="bg-auth-background/50 border-auth-gold/30 text-white placeholder:text-gray-500 focus:border-auth-gold focus:ring-auth-gold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-auth-background/50 border-auth-gold/30 text-white placeholder:text-gray-500 focus:border-auth-gold focus:ring-auth-gold"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-auth-gold hover:bg-auth-gold-muted text-black font-semibold min-h-[48px] shadow-lg shadow-auth-gold/20 transition-all" 
              disabled={loading}
            >
              {loading ? "Processing..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
