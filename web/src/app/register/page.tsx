'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, ShieldAlert, Loader2, UserPlus, Shield } from 'lucide-react';
import styles from '../login/login.module.css';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'MEMBER',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Something went wrong during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Shield size={28} />
            <span>TeamSync</span>
          </div>
          <h1 className={styles.title}>Create account</h1>
          <p className={styles.subtitle}>Sign up to start organizing projects and tasks</p>
        </div>

        {error && (
          <div className={`${styles.alert} ${styles.alertError}`}>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className={styles.alert} style={{ backgroundColor: 'rgba(22, 163, 74, 0.08)', border: '1px solid rgba(22, 163, 74, 0.15)', color: 'var(--success)' }}>
            <span>Account created! Redirecting to login...</span>
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="name">
              Full Name
            </label>
            <div className={styles.inputWrapper}>
              <User className={styles.inputIcon} size={18} />
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                {...register('name')}
                disabled={loading || success}
              />
            </div>
            {errors.name && <span className={styles.errorText}>{errors.name.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="email">
              Email Address
            </label>
            <div className={styles.inputWrapper}>
              <Mail className={styles.inputIcon} size={18} />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                {...register('email')}
                disabled={loading || success}
              />
            </div>
            {errors.email && <span className={styles.errorText}>{errors.email.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} size={18} />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                {...register('password')}
                disabled={loading || success}
              />
            </div>
            {errors.password && <span className={styles.errorText}>{errors.password.message}</span>}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="role">
              Global Role
            </label>
            <div className={styles.inputWrapper}>
              <ShieldAlert className={styles.inputIcon} size={18} />
              <select
                id="role"
                className={`${styles.input} ${errors.role ? styles.inputError : ''}`}
                style={{ paddingLeft: '38px', height: '42px', cursor: 'pointer' }}
                {...register('role')}
                disabled={loading || success}
              >
                <option value="MEMBER">Member (standard team member)</option>
                <option value="MANAGER">Manager (can create projects)</option>
                <option value="ADMIN">Admin (unrestricted global access)</option>
              </select>
            </div>
            {errors.role && <span className={styles.errorText}>{errors.role.message}</span>}
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading || success}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Sign Up</span>
              </>
            )}
          </button>
        </form>

        <div className={styles.footer}>
          Already have an account?{' '}
          <Link href="/login" className={styles.footerLink}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
