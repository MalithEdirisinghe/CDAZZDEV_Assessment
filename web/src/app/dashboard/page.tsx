'use client';

import React, { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Plus, Calendar, AlertCircle, ArrowLeft, ArrowRight, 
  ChevronRight, Filter, Info, Loader2, Play, PlusCircle, CheckCircle, HelpCircle, X, Circle
} from 'lucide-react';
import Link from 'next/link';
import styles from './dashboard.module.css';

const taskSchema = z.object({
  title: z.string().min(3, 'Task title must be at least 3 characters'),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  
  const projectId = searchParams.get('projectId') || '';
  
  // Local Filter & Pagination States
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const limit = 6;

  // Task Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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
    }
  }, []);

  // Fetch projects list (to find active project details)
  const { data: projects = [] } = useSWR('/api/proxy/projects', fetcher);
  
  const activeProject = Array.isArray(projects) 
    ? projects.find((p: any) => p.id === projectId) 
    : null;

  // Build API Query URL
  let taskQueryUrl = `/api/proxy/projects/${projectId}/tasks?page=${page}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
  if (statusFilter) taskQueryUrl += `&status=${statusFilter}`;
  if (priorityFilter) taskQueryUrl += `&priority=${priorityFilter}`;
  if (assigneeFilter) taskQueryUrl += `&assigneeId=${assigneeFilter}`;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, assigneeFilter, sortBy, sortOrder]);

  // Fetch project tasks using SWR (auto-refreshes when query url changes)
  const { data: tasksData, error: tasksError, isLoading: tasksLoading } = useSWR(
    projectId ? taskQueryUrl : null,
    fetcher
  );

  const tasks = tasksData?.data || [];
  const meta = tasksData?.meta || { total: 0, page: 1, limit: 6, pages: 1 };

  // Task creation Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status: 'TODO',
      priority: 'MEDIUM',
    },
  });

  const onSubmitTask = async (values: TaskFormValues) => {
    setTaskError(null);
    setTaskLoading(true);

    try {
      // Map empty strings to undefined/null
      const payload = {
        ...values,
        description: values.description || undefined,
        assigneeId: values.assigneeId === '' ? undefined : values.assigneeId,
        dueDate: values.dueDate === '' ? undefined : new Date(values.dueDate).toISOString(),
      };

      const res = await fetch(`/api/proxy/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create task');
      }

      setIsModalOpen(false);
      reset();
      
      // Revalidate tasks list
      mutate(taskQueryUrl);
    } catch (err: any) {
      setTaskError(err.message || 'Failed to create task');
    } finally {
      setTaskLoading(false);
    }
  };

  // Determine permissions
  // The creator can be the project's manager, or a global Admin
  const isProjectManager = activeProject?.members?.some(
    (m: any) => m.userId === currentUser?.id && m.role === 'MANAGER'
  );
  const isPrivileged = currentUser?.role === 'ADMIN' || isProjectManager;

  if (!projectId) {
    return (
      <div className={styles.content}>
        <div className={styles.emptyState}>
          <Info size={40} className="text-muted" />
          <h2>Select a project</h2>
          <p className={styles.emptyText}>Please select or create a project from the sidebar to view tasks.</p>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.content}>
      {activeProject && (
        <div className={styles.projectTitleSection}>
          <div className={styles.projectInfo}>
            <h1>{activeProject.name}</h1>
            {activeProject.description && (
              <p className={styles.projectDesc}>{activeProject.description}</p>
            )}
          </div>

          {isPrivileged && (
            <button className={styles.createTaskBtn} onClick={() => setIsModalOpen(true)}>
              <Plus size={18} />
              <span>New Task</span>
            </button>
          )}
        </div>
      )}

      {/* Filters Area */}
      <div className={styles.filtersCard}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status</label>
          <select 
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Priority</label>
          <select 
            className={styles.filterSelect}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Assignee</label>
          <select 
            className={styles.filterSelect}
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">All Assignees</option>
            {activeProject?.members?.map((member: any) => (
              <option key={member.userId} value={member.userId}>
                {member.user.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Sort By</label>
          <select 
            className={styles.filterSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="dueDate">Due Date</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Sort Order</label>
          <select 
            className={styles.filterSelect}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {tasksLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
        </div>
      ) : tasksError ? (
        <div className={styles.emptyState}>
          <AlertCircle size={40} style={{ color: 'var(--danger)' }} />
          <h2>Failed to load tasks</h2>
          <p className={styles.emptyText}>An error occurred while fetching tasks from the backend.</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className={styles.emptyState}>
          <HelpCircle size={40} className="text-muted" />
          <h2>No tasks found</h2>
          <p className={styles.emptyText}>Try adjusting your filters, or create a new task to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.tasksList}>
            {tasks.map((task: any) => (
              <Link 
                href={`/dashboard/tasks/${task.id}?projectId=${projectId}`} 
                key={task.id} 
                className={styles.taskCard}
              >
                <div className={styles.taskMain}>
                  <h3 className={styles.taskTitle}>{task.title}</h3>
                  {task.description && (
                    <p className={styles.taskDescSnippet}>{task.description}</p>
                  )}
                </div>

                <div className={styles.taskMeta}>
                  <span className={`${styles.badge} ${styles[`badge${task.status}`]}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                  
                  <span className={`${styles.priorityBadge} ${styles[`priority${task.priority}`]}`}>
                    <Circle size={10} fill="currentColor" />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{task.priority}</span>
                  </span>

                  {task.dueDate && (
                    <span className={styles.dueDateInfo}>
                      <Calendar size={14} />
                      <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                    </span>
                  )}

                  {task.assignee ? (
                    <span className={styles.assigneeBadge} title={task.assignee.name}>
                      {task.assignee.name}
                    </span>
                  ) : (
                    <span className={styles.captionText}>Unassigned</span>
                  )}

                  <ChevronRight size={18} className="text-muted" />
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination Controls */}
          {meta.pages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ArrowLeft size={16} />
                <span>Prev</span>
              </button>

              <span className={styles.pageInfo}>
                Page {meta.page} of {meta.pages} ({meta.total} tasks)
              </span>

              <button
                className={styles.pageBtn}
                disabled={page >= meta.pages}
                onClick={() => setPage(page + 1)}
              >
                <span>Next</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.brand} style={{ color: 'var(--foreground)' }}>
                <PlusCircle size={20} />
                <span>New Task</span>
              </h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {taskError && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <span>{taskError}</span>
              </div>
            )}

            <form className={styles.form} onSubmit={handleSubmit(onSubmitTask)}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="taskTitle">Task Title</label>
                <input
                  id="taskTitle"
                  type="text"
                  placeholder="e.g. Implement middleware routing"
                  className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
                  style={{ padding: '10px 12px' }}
                  {...register('title')}
                  disabled={taskLoading}
                />
                {errors.title && <span className={styles.errorText}>{errors.title.message}</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="taskDesc">Description</label>
                <textarea
                  id="taskDesc"
                  placeholder="Enter detailed description..."
                  className={styles.input}
                  style={{ padding: '10px 12px', minHeight: '60px', resize: 'vertical' }}
                  {...register('description')}
                  disabled={taskLoading}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label} htmlFor="taskStatus">Status</label>
                  <select
                    id="taskStatus"
                    className={styles.filterSelect}
                    {...register('status')}
                    disabled={taskLoading}
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label} htmlFor="taskPriority">Priority</label>
                  <select
                    id="taskPriority"
                    className={styles.filterSelect}
                    {...register('priority')}
                    disabled={taskLoading}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label} htmlFor="taskAssignee">Assignee</label>
                  <select
                    id="taskAssignee"
                    className={styles.filterSelect}
                    {...register('assigneeId')}
                    disabled={taskLoading}
                  >
                    <option value="">Unassigned</option>
                    {activeProject?.members?.map((member: any) => (
                      <option key={member.userId} value={member.userId}>
                        {member.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label} htmlFor="taskDueDate">Due Date</label>
                  <input
                    id="taskDueDate"
                    type="date"
                    className={styles.filterSelect}
                    style={{ padding: '6px 10px' }}
                    {...register('dueDate')}
                    disabled={taskLoading}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button 
                  type="button" 
                  className={styles.btnSecondary}
                  onClick={() => setIsModalOpen(false)}
                  disabled={taskLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.btnPrimary}
                  disabled={taskLoading}
                >
                  {taskLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Task</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
