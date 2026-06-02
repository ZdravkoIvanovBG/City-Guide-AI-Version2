import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Compass } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const loginMutation = useLogin();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const result = await loginMutation.mutateAsync({ data: values });
      login(result.user, result.accessToken);
      toast({
        title: "Welcome back",
        description: "You have successfully signed in.",
      });
      setLocation("/profile");
    } catch (error: any) {
      toast({
        title: "Authentication failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background flex flex-col"
    >
      <Navbar />
      
      <div className="flex-1 flex items-center justify-center p-6 mt-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <Compass className="w-12 h-12 text-primary mx-auto mb-6" />
            <h1 className="font-serif text-4xl mb-3">Welcome Back</h1>
            <p className="text-muted-foreground">Continue your journey with City Guide.</p>
          </div>

          <div className="bg-card border border-border p-8 shadow-2xl">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Email</FormLabel>
                      <FormControl>
                        <Input placeholder="nomad@example.com" className="bg-background/50 border-border rounded-none focus-visible:ring-primary focus-visible:border-primary" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" className="bg-background/50 border-border rounded-none focus-visible:ring-primary focus-visible:border-primary" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-none h-12 text-lg"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </div>

          <p className="text-center mt-8 text-sm text-muted-foreground">
            Don't have an account? <button onClick={() => setLocation("/register")} className="text-primary hover:underline">Start here.</button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
