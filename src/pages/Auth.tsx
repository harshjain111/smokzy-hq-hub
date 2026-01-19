import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { motion } from "framer-motion";
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
      {/* Animated gradient overlays */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-gradient-start/30 via-transparent to-gradient-end/20"
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      
      {/* Animated glow orbs */}
      <motion.div 
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-start/20 rounded-full blur-3xl"
        animate={{
          x: [0, 30, 0],
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div 
        className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-gradient-end/20 rounded-full blur-3xl"
        animate={{
          x: [0, -25, 0],
          y: [0, 30, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Golden accent gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-auth-gold/10 via-transparent to-auth-gold/5" />
      
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="bg-auth-card/90 backdrop-blur-xl border-auth-gold/20 shadow-2xl overflow-hidden">
          {/* Gradient accent line at top */}
          <div className="h-1 w-full bg-gradient-to-r from-gradient-start via-auth-gold to-gradient-end" />
          
          <CardHeader className="space-y-4 pb-8 pt-8">
            <motion.div 
              className="flex justify-center mb-2"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <img 
                src={smokzyLogo} 
                alt="Smokzy Logo" 
                className="h-28 w-auto object-contain"
                style={{ filter: 'drop-shadow(0 4px 20px rgba(212, 175, 55, 0.5))' }}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-auth-gold via-yellow-300 to-auth-gold bg-clip-text text-transparent">
                Welcome Back
              </CardTitle>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <CardDescription className="text-center text-gray-400 text-base">
                Sign in to access Smokzy Operations
              </CardDescription>
            </motion.div>
          </CardHeader>
          
          <CardContent className="pb-8">
            <motion.form 
              onSubmit={handleSubmit} 
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <div className="space-y-2">
                <Label htmlFor="loginIdentifier" className="text-gray-300 text-sm font-medium">
                  Email or Mobile Number
                </Label>
                <Input
                  id="loginIdentifier"
                  type="text"
                  placeholder="admin@example.com or 9876543210"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  required
                  className="h-12 bg-auth-background/50 border-auth-gold/30 text-white placeholder:text-gray-500 focus:border-auth-gold focus:ring-auth-gold/50 focus:ring-2 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300 text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-auth-background/50 border-auth-gold/30 text-white placeholder:text-gray-500 focus:border-auth-gold focus:ring-auth-gold/50 focus:ring-2 transition-all"
                />
              </div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  type="submit" 
                  className="w-full h-14 bg-gradient-to-r from-auth-gold via-yellow-500 to-auth-gold hover:from-auth-gold-muted hover:via-yellow-400 hover:to-auth-gold-muted text-black font-bold text-lg shadow-lg shadow-auth-gold/30 transition-all border border-auth-gold/20" 
                  disabled={loading}
                >
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <img src={smokzyLogo} alt="" className="h-6 w-6" />
                    </motion.div>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </motion.div>
            </motion.form>
          </CardContent>
        </Card>
        
        {/* Subtle glow under card */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-gradient-to-r from-gradient-start/30 via-auth-gold/40 to-gradient-end/30 blur-xl" />
      </motion.div>
    </div>
  );
};

export default Auth;
