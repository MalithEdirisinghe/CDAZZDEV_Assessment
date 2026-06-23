'use client';

import { use, useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft, Calendar, User as UserIcon, Loader2, 
  MessageSquare, Circle, AlertCircle, Send, Check 
} from 'lucide-react';
import styles from './task-detail.module.css';

const commentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty'),
});

type CommentFormValues = z.infer<typeof commentSchema>;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
}

export default function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ projectId: string }>;
}) {
  const router = useRouter();
  const { taskId } = use(params);
  const { projectId } = use(searchParams);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);

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

  // Fetch Task Details (includes assignee & comments thread)
  const { data: task, error: taskError, isLoading: taskLoading, mutate: mutateTask } = useSWR(
    taskId ? `/api/proxy/tasks/${taskId}` : null,
    fetcher
  );

  // Fetch Projects (to obtain list of members for assignment dropdown and check manager rights)
  const { data: projects = [] } = useSWR('/api/proxy/projects', fetcher);
  
  const activeProject = Array.isArray(projects) 
    ? projects.find((p: any) => p.id === projectId) 
    : null;

  // Form for posting comments
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: commentErrors },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
  });

  const onSubmitComment = async (values: CommentFormValues) => {
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/proxy/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to post comment');
      }

      reset();
      mutateTask();
    } catch (err: any) {
      alert(err.message || 'Could not post comment');
    } finally {
      setCommentLoading(false);
    }
  };

  // Perform PATCH task updates (Status, Priority, Assignee)
  const handleTaskUpdate = async (fields: {
    status?: string;
    priority?: string;
    assigneeId?: string | null;
  }) => {
    setUpdateError(null);
    try {
      const res = await fetch(`/api/proxy/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fields),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update task');
      }

      mutateTask();
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update task details');
    }
  };

  // Check if current user is allowed to edit task metadata
  const isProjectManager = activeProject?.members?.some(
    (m: any) => m.userId === currentUser?.id && m.role === 'MANAGER'
  );
  
  const isAssignee = task?.assigneeId === currentUser?.id;
  const isGlobalAdmin = currentUser?.role === 'ADMIN';
  const canEdit = isGlobalAdmin || isProjectManager || isAssignee;

  if (taskLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (taskError || !task || task.message) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <AlertCircle size={40} style={{ color: 'var(--danger)' }} />
          <h2>Task not found</h2>
          <p className={styles.emptyText}>The requested task details could not be retrieved.</p>
          <button className={styles.backBtn} onClick={() => router.push(`/dashboard?projectId=${projectId}`)}>
            <ArrowLeft size={16} />
            <span>Go back to dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button 
        className={styles.backBtn} 
        onClick={() => router.push(`/dashboard?projectId=${projectId}`)}
      >
        <ArrowLeft size={16} />
        <span>Back to Project Dashboard</span>
      </button>

      {updateError && (
        <div className={styles.alert} style={{ backgroundColor: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.15)', color: 'var(--danger)' }}>
          <span>{updateError}</span>
        </div>
      )}

      <div className={styles.layout}>
        {/* Left Column: Title, Description, Comments */}
        <div className={styles.detailsCard}>
          <div className={styles.titleArea}>
            <input
              type="text"
              value={task.title}
              readOnly // For simplify, keep readOnly. It satisfies task viewing.
              className={styles.titleInput}
            />
          </div>

          <div className={styles.descriptionArea}>
            <span className={styles.descriptionLabel}>Description</span>
            <p className={styles.descriptionText}>
              {task.description || 'No description provided for this task.'}
            </p>
          </div>

          {/* Comments Feed */}
          <div className={styles.commentsArea}>
            <h3 className={styles.commentsTitle}>
              <MessageSquare size={18} style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'text-bottom' }} />
              <span>Comments ({task.comments?.length || 0})</span>
            </h3>

            <div className={styles.commentsList}>
              {task.comments && task.comments.length > 0 ? (
                task.comments.map((comment: any) => (
                  <div key={comment.id} className={styles.commentItem}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentAuthor}>{comment.author?.name}</span>
                      <span className={styles.commentTime}>
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className={styles.commentBody}>{comment.body}</p>
                  </div>
                ))
              ) : (
                <p className={styles.captionText} style={{ padding: '8px 0' }}>
                  No comments yet. Be the first to start the conversation!
                </p>
              )}
            </div>

            {/* Comment Form */}
            <form className={styles.commentForm} onSubmit={handleSubmit(onSubmitComment)}>
              <textarea
                placeholder="Write a comment..."
                className={`${styles.commentTextarea} input`}
                {...register('body')}
                disabled={commentLoading}
              />
              {commentErrors.body && (
                <span style={{ fontSize: '12px', color: 'var(--danger)' }}>
                  {commentErrors.body.message}
                </span>
              )}
              <button 
                type="submit" 
                className={`${styles.commentBtn} button`}
                disabled={commentLoading}
              >
                {commentLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <>
                    <Send size={14} style={{ display: 'inline-block', marginRight: '6px' }} />
                    <span>Comment</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Settings Card */}
        <div className={styles.controlCard}>
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Status</span>
            <select
              className={`${styles.controlSelect} select`}
              value={task.status}
              disabled={!canEdit}
              onChange={(e) => handleTaskUpdate({ status: e.target.value })}
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Priority</span>
            <select
              className={`${styles.controlSelect} select`}
              value={task.priority}
              disabled={!canEdit}
              onChange={(e) => handleTaskUpdate({ priority: e.target.value })}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Assignee</span>
            <select
              className={`${styles.controlSelect} select`}
              value={task.assigneeId || ''}
              disabled={!canEdit}
              onChange={(e) => handleTaskUpdate({ assigneeId: e.target.value === '' ? null : e.target.value })}
            >
              <option value="">Unassigned</option>
              {activeProject?.members?.map((member: any) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Due Date</span>
            <div className={styles.dueDateDisplay}>
              <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
              <span>
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
              </span>
            </div>
          </div>

          {!canEdit && (
            <p className={styles.captionText} style={{ textAlign: 'center', fontStyle: 'italic' }}>
              Only task assignee, project manager, or admin can edit metadata parameters.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
