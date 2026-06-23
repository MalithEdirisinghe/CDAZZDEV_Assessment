'use client';

import React, { useState, useEffect, Suspense } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Folder, Plus, LogOut, Menu, X, Briefcase, 
  FolderPlus, Loader2, User as UserIcon, Shield 
} from 'lucide-react';
import styles from './dashboard.module.css';

const projectSchema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters'),
  description: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

// fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate } = useSWRConfig();
  const activeProjectId = searchParams.get('projectId') || '';

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);

  // Retrieve user info from cookie
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        try {
          return JSON.parse(decodeURIComponent(parts.pop()!.split(';').shift()!));
        } catch {
          return null;
        }
      }
      return null;
    };
    
    const user = getCookie('user');
    if (user) {
      setCurrentUser(user);
    } else {
      router.push('/login');
    }
  }, [router]);

  // Fetch projects list via BFF Proxy
  const { data: projects = [], error: fetchError } = useSWR('/api/proxy/projects', fetcher, {
    revalidateOnFocus: false,
  });

  // Automatically select first project if none is active
  useEffect(() => {
    if (projects && Array.isArray(projects) && projects.length > 0 && !activeProjectId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('projectId', projects[0].id);
      router.push(`/dashboard?${params.toString()}`);
    }
  }, [projects, activeProjectId, router, searchParams]);

  // Form for creating project
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
  });

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const onSubmitProject = async (values: ProjectFormValues) => {
    setProjectError(null);
    setProjectLoading(true);

    try {
      const res = await fetch('/api/proxy/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create project');
      }

      // Revalidate projects list
      mutate('/api/proxy/projects');
      setIsModalOpen(false);
      reset();
      
      // Select the newly created project
      const params = new URLSearchParams(searchParams.toString());
      params.set('projectId', data.id);
      router.push(`/dashboard?${params.toString()}`);
    } catch (err: any) {
      setProjectError(err.message || 'Failed to create project');
    } finally {
      setProjectLoading(false);
    }
  };

  const isPrivilegedUser = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  return (
    <div className={styles.layout}>
      {/* Drawer Backdrop for Mobile */}
      <div 
        className={`${styles.drawerBackdrop} ${sidebarOpen ? styles.drawerBackdropOpen : ''}`} 
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar Panel */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brand}>
            <Shield size={24} />
            <span>TeamSync</span>
          </div>
          <button 
            className={styles.closeBtn} 
            style={{ display: sidebarOpen ? 'block' : 'none' }}
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {currentUser && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{currentUser.name}</span>
            <span className={`${styles.userRole} ${styles[`role${currentUser.role}`]}`}>
              {currentUser.role}
            </span>
          </div>
        )}

        <div className={styles.navSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Projects</span>
            {isPrivilegedUser && (
              <button 
                className={styles.addBtn}
                title="Create Project"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          {Array.isArray(projects) && projects.length > 0 ? (
            <ul className={styles.projectList}>
              {projects.map((proj: any) => (
                <li key={proj.id}>
                  <button
                    className={`${styles.projectItem} ${activeProjectId === proj.id ? styles.projectActive : ''}`}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('projectId', proj.id);
                      router.push(`/dashboard?${params.toString()}`);
                      setSidebarOpen(false);
                    }}
                  >
                    <Folder size={16} />
                    <span>{proj.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.captionText} style={{ padding: '0 8px' }}>
              No projects found.
            </p>
          )}
        </div>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className={styles.main}>
        <header className={styles.header}>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div style={{ flex: 1 }} />
          <div className={styles.brand} style={{ display: 'none' }}>TeamSync</div>
        </header>

        {children}
      </div>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.brand} style={{ color: 'var(--foreground)' }}>
                <FolderPlus size={20} />
                <span>New Project</span>
              </h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {projectError && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <span>{projectError}</span>
              </div>
            )}

            <form className={styles.form} onSubmit={handleSubmit(onSubmitProject)}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="projName">Project Name</label>
                <input
                  id="projName"
                  type="text"
                  placeholder="e.g. Website Redesign"
                  className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                  style={{ padding: '10px 12px' }}
                  {...register('name')}
                  disabled={projectLoading}
                />
                {errors.name && <span className={styles.errorText}>{errors.name.message}</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="projDesc">Description (Optional)</label>
                <textarea
                  id="projDesc"
                  placeholder="Provide project objectives..."
                  className={styles.input}
                  style={{ padding: '10px 12px', minHeight: '80px', resize: 'vertical' }}
                  {...register('description')}
                  disabled={projectLoading}
                />
              </div>

              <div className={styles.modalFooter}>
                <button 
                  type="button" 
                  className={styles.btnSecondary}
                  onClick={() => setIsModalOpen(false)}
                  disabled={projectLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.btnPrimary}
                  disabled={projectLoading}
                >
                  {projectLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Project</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
      </div>
    }>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
