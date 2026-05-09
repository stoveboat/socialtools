import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginWithPassword } from "./actions";
import { GoogleButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-svh flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use your email and password, or continue with Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={loginWithPassword} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="bg-card relative z-10 px-2">or</span>
            <div className="absolute inset-y-1/2 inset-x-0 border-t" />
          </div>
          <GoogleButton />
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          No account?{" "}
          <Link className="ml-1 underline" href="/signup">
            Sign up
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
