
"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/server/auth/actions";
import Link from "next/link";
import {
  Zap,
  Eye,
  EyeOff,
  LockKeyhole,
  ArrowRight,
} from "lucide-react";
import Input from "@/ui/components/forms/Input";
import Button from "@/ui/components/actions/Button";
import IconButton from "@/ui/components/actions/IconButton";
import "@/styles/login.css";

export default function LoginPage() {
  const [loginState, formAction, pending] = useActionState(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <main className="login-page">

      {/* BRANDING PANEL */}
      <section className="login-branding">

        {/* Background decoration */}
        <div className="login-decoration login-decoration-one" />
        <div className="login-decoration login-decoration-two" />
        <div className="login-decoration login-decoration-three" />

        {/* Brand */}
        <div className="login-brand">
          <div className="login-logo">
            <Zap size={23} strokeWidth={2.2} />
          </div>

          <span className="login-brand-name">
            Watt<span className="login-brand-accent">Pay</span>
          </span>
        </div>

        {/* Main content */}
        <div className="login-brand-message">
          <div className="login-brand-line" />

          <h1 className="login-brand-heading">
            Powering smarter
            <span className="login-brand-heading-accent">
              electricity management.
            </span>
          </h1>

          <p className="login-brand-description">
            One platform. Connected operations. Simpler payments.
          </p>
        </div>

        {/* Footer */}
        <div className="login-brand-footer">
          <p>© 2026 WattPay. All rights reserved.</p>
        </div>
      </section>

      {/* LOGIN SECTION */}
      <section className="login-content">

        {/* Mobile brand */}
        <div className="login-mobile-brand">
          <div className="login-logo">
            <Zap size={22} strokeWidth={2.2} />
          </div>

          <span className="login-brand-name">
            Watt<span className="login-brand-accent">Pay</span>
          </span>
        </div>

        <div className="login-form-container">

          {/* Heading */}
          <div className="login-heading">
            <h2>Welcome back</h2>

            <p>
              Sign in to your WattPay account to continue.
            </p>
          </div>

          {/* Login form */}
          <form
            className="login-form"
            action={formAction}
          >

            {/* Email */}
            {/* Email */}
<div className="login-field">
  <Input
    id="email"
    name="email"
    label="Email address"
    type="email"
    defaultValue={loginState.email}
    error={loginState.fieldErrors?.email}
    autoComplete="email"
    placeholder="Enter your email"
    required
    containerClassName="login-input-field"
  />
</div>

            {/* Password */}
            {/* Password */}
<div className="login-field">
  <div className="login-password-heading">
    <label htmlFor="password">
      Password
    </label>

    <Link
      href="/forgot-password"
      className="login-forgot-link"
    >
      Forgot password?
    </Link>
  </div>

  <Input
    id="password"
    name="password"
    type={showPassword ? "text" : "password"}
    error={loginState.fieldErrors?.password}
    autoComplete="current-password"
    placeholder="Enter your password"
    required
    containerClassName="login-input-field"
    rightIcon={
      <IconButton
        icon={
          showPassword ? (
            <EyeOff size={19} strokeWidth={1.8} />
          ) : (
            <Eye size={19} strokeWidth={1.8} />
          )
        }
        label={showPassword ? "Hide password" : "Show password"}
        onClick={() => setShowPassword((previous) => !previous)}
        size="sm"
      />
    }
  />
</div>

            {/* Remember me */}
            <div className="login-remember">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
                className="login-checkbox"
              />

              <label htmlFor="remember">
                Remember me
              </label>
            </div>

            {loginState.error && <p role="alert">{loginState.error}</p>}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={pending}
              variant="primary"
              size="lg"
              fullWidth
              rightIcon={
                <ArrowRight
                  size={17}
                  strokeWidth={2}
                  className="login-submit-icon"
                />
              }
              className="login-submit"
            >
              {pending ? "Signing in..." : "Sign in"}
            </Button>

          </form>

          {/* Security note */}
          <div className="login-security-note">
            <LockKeyhole size={15} strokeWidth={1.8} />

            <p>
              Secure access to your WattPay account
            </p>
          </div>

          {/* Mobile footer */}
          <p className="login-mobile-footer">
            © 2026 WattPay. All rights reserved.
          </p>

        </div>
      </section>
    </main>
  );
}
