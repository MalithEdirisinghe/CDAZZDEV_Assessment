import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  FlatList, ActivityIndicator, SafeAreaView, StatusBar, 
  RefreshControl, Platform, ScrollView, Alert, Switch, KeyboardAvoidingView
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTokens, getAccessToken, clearTokens } from './src/utils/SecureStorageHelper';
import { cacheTasks, getCachedTasks } from './src/utils/CacheHelper';
import { registerForPushNotificationsAsync } from './src/utils/PushNotificationHelper';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  assigneeId: string | null;
  projectId: string;
  dueDate: string | null;
}

interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
  isOptimistic?: boolean;
}

export default function App() {
  // Navigation State
  const [screen, setScreen] = useState<'Login' | 'TaskList' | 'TaskDetail'>('Login');
  
  // App Config
  const [apiUrl, setApiUrl] = useState('http://10.0.2.2:3000'); // Default for Android emulator

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Task List State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Task Detail State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState('');

  // Push Notifications State
  const [pushToken, setPushToken] = useState<string | null>(null);

  // Check login on startup
  useEffect(() => {
    async function checkAuth() {
      const token = await getAccessToken();
      const userString = await AsyncStorage.getItem('mobile_user');
      const savedApiUrl = await AsyncStorage.getItem('mobile_api_url');
      
      if (savedApiUrl) {
        setApiUrl(savedApiUrl);
      }

      if (token && userString) {
        try {
          const user = JSON.parse(userString);
          setCurrentUser(user);
          setScreen('TaskList');
          fetchTasks(user.id, savedApiUrl || apiUrl);
          setupNotifications();
        } catch {
          await handleLogout();
        }
      }
    }
    checkAuth();
  }, []);

  // Register push tokens
  const setupNotifications = async () => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      setPushToken(token);
    }
  };

  // Perform Log in
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter email and password.');
      return;
    }
    setAuthLoading(true);

    try {
      // Normalize API url ending slash
      const cleanUrl = apiUrl.replace(/\/$/, '');
      const response = await fetch(`${cleanUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      await saveTokens(data.accessToken, data.refreshToken);
      await AsyncStorage.setItem('mobile_user', JSON.stringify(data.user));
      await AsyncStorage.setItem('mobile_api_url', cleanUrl);

      setCurrentUser(data.user);
      setScreen('TaskList');
      fetchTasks(data.user.id, cleanUrl);
      setupNotifications();
      
      // Clear credentials form
      setPassword('');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Check your API base URL or credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Log out
  const handleLogout = async () => {
    await clearTokens();
    await AsyncStorage.removeItem('mobile_user');
    setCurrentUser(null);
    setTasks([]);
    setScreen('Login');
  };

  // Fetch tasks assigned to the user
  const fetchTasks = async (userId: string, activeApiUrl = apiUrl) => {
    setLoadingTasks(true);
    setIsOffline(false);
    try {
      const accessToken = await getAccessToken();
      
      // 1. Fetch user's projects
      const projectsRes = await fetch(`${activeApiUrl}/projects`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!projectsRes.ok) {
        throw new Error('Failed to retrieve projects');
      }

      const projects = await projectsRes.json();
      
      // 2. Fetch tasks matching user as assignee for each project
      let allUserTasks: Task[] = [];
      
      for (const project of projects) {
        const tasksRes = await fetch(`${activeApiUrl}/projects/${project.id}/tasks?assigneeId=${userId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          if (tasksData && Array.isArray(tasksData.data)) {
            allUserTasks = [...allUserTasks, ...tasksData.data];
          }
        }
      }

      setTasks(allUserTasks);
      await cacheTasks(allUserTasks); // Cache last successful fetch
    } catch (error) {
      console.warn('Failed to fetch tasks online, reading cache...', error);
      setIsOffline(true);
      const cached = await getCachedTasks();
      setTasks(cached);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleRefresh = async () => {
    if (!currentUser) return;
    setRefreshing(true);
    await fetchTasks(currentUser.id);
    setRefreshing(false);
  };

  // Fetch single task detail (includes comments)
  const fetchTaskDetail = async (taskId: string) => {
    setLoadingDetail(false);
    setSelectedTaskId(taskId);
    setScreen('TaskDetail');
    
    // First, show cached brief detail
    const cachedTask = tasks.find(t => t.id === taskId);
    if (cachedTask) {
      setTaskDetail(cachedTask);
    }

    setLoadingDetail(true);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch(`${apiUrl}/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!res.ok) throw new Error('Task detail fetch failed');

      const data = await res.json();
      setTaskDetail(data);
      setComments(data.comments || []);
      setIsOffline(false);
    } catch (err) {
      console.warn('Failed to load task details online.', err);
      setIsOffline(true);
      // Offline fallback: show comments as empty or notify
      setComments([]);
      Alert.alert('Offline Mode', 'Cannot load comments or live updates while offline.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Update task status online
  const updateTaskStatus = async (newStatus: 'TODO' | 'IN_PROGRESS' | 'DONE') => {
    if (!taskDetail) return;
    
    // Optimistic status update
    const previousStatus = taskDetail.status;
    setTaskDetail({ ...taskDetail, status: newStatus });
    setTasks(tasks.map(t => t.id === taskDetail.id ? { ...t, status: newStatus } : t));

    try {
      const accessToken = await getAccessToken();
      const res = await fetch(`${apiUrl}/tasks/${taskDetail.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status on server');
    } catch (err) {
      // Rollback on failure
      setTaskDetail({ ...taskDetail, status: previousStatus });
      setTasks(tasks.map(t => t.id === taskDetail.id ? { ...t, status: previousStatus } : t));
      Alert.alert('Error', 'Failed to update task status. Please try again.');
    }
  };

  // Add comment with Optimistic UI updates
  const handleAddComment = async () => {
    if (!newCommentBody.trim() || !taskDetail || !currentUser) return;

    const body = newCommentBody.trim();
    setNewCommentBody('');

    // 1. Create optimistic comment
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticComment: Comment = {
      id: optimisticId,
      taskId: taskDetail.id,
      authorId: currentUser.id,
      body: body,
      createdAt: new Date().toISOString(),
      author: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
      isOptimistic: true,
    };

    // 2. Append optimistically
    const previousComments = [...comments];
    setComments([...comments, optimisticComment]);

    // 3. Post to API in background
    try {
      const accessToken = await getAccessToken();
      const res = await fetch(`${apiUrl}/tasks/${taskDetail.id}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) throw new Error('Failed to post comment to server');

      const realComment = await res.json();
      
      // Replace optimistic comment with real one
      setComments(prev => prev.map(c => c.id === optimisticId ? realComment : c));
    } catch (error) {
      // Rollback on failure
      setComments(previousComments);
      Alert.alert('Failed to send comment', 'The comment could not be uploaded. Rolling back UI.');
    }
  };

  // Render Login Screen
  const renderLogin = () => (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.authCard}>
            <Text style={styles.authLogo}>TeamSync</Text>
            <Text style={styles.authTitle}>Mobile Companion</Text>
            <Text style={styles.authSubtitle}>Sign in to view your assigned tasks</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>API Server Base URL</Text>
              <TextInput
                style={styles.input}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="http://192.168.1.XX:3000"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.helpText}>
                Emulators: 10.0.2.2:3000. Devices: use host IP (e.g. 192.168.1.10:3000).
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color="#64748B" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.btnPrimary, authLoading && styles.btnDisabled]} 
              onPress={handleLogin}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // Render Task List Screen
  const renderTaskList = () => (
    <SafeAreaView style={styles.container}>
      {/* Offline banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>Showing Cached Data (Offline Mode)</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Tasks</Text>
          {currentUser && (
            <Text style={styles.headerSubtitle}>
              Logged in as <Text style={{ fontWeight: '700' }}>{currentUser.name}</Text>
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.btnLogout} onPress={handleLogout}>
          <Text style={styles.btnLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Capture info */}
      {pushToken && (
        <View style={styles.pushBanner}>
          <Text style={styles.pushBannerText} numberOfLines={1}>
            Push Token: {pushToken}
          </Text>
        </View>
      )}

      {/* List */}
      {loadingTasks && tasks.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563EB']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tasks assigned to you!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.taskCard} 
              onPress={() => fetchTaskDetail(item.id)}
            >
              <View style={styles.taskRow}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <View style={[styles.priorityBadge, styles[`priority${item.priority}`]]}>
                  <Text style={styles.priorityText}>{item.priority}</Text>
                </View>
              </View>

              {item.description && (
                <Text style={styles.taskDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              <View style={styles.taskFooter}>
                <View style={[styles.statusBadge, styles[`status${item.status}`]]}>
                  <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                </View>
                {item.dueDate && (
                  <Text style={styles.dueDateText}>
                    Due: {new Date(item.dueDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );

  // Render Task Detail Screen
  const renderTaskDetail = () => {
    if (!taskDetail) return null;

    return (
      <SafeAreaView style={styles.container}>
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>Showing Cached Data (Offline)</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.btnBack} 
            onPress={() => {
              setScreen('TaskList');
              setTaskDetail(null);
              setComments([]);
            }}
          >
            <Text style={styles.btnBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Details</Text>
        </View>

        {loadingDetail && !taskDetail.description ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.detailListContainer}
            ListHeaderComponent={
              <View style={styles.detailHeaderArea}>
                <Text style={styles.detailTitle}>{taskDetail.title}</Text>
                
                {taskDetail.description && (
                  <View style={styles.detailDescArea}>
                    <Text style={styles.detailDescLabel}>Description</Text>
                    <Text style={styles.detailDescText}>{taskDetail.description}</Text>
                  </View>
                )}

                {/* Inline Status Toggle Buttons */}
                <View style={styles.statusControlGroup}>
                  <Text style={styles.detailDescLabel}>Task Status</Text>
                  <View style={styles.statusBtnContainer}>
                    {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.statusToggleBtn,
                          taskDetail.status === st && styles.statusToggleBtnActive,
                        ]}
                        onPress={() => updateTaskStatus(st)}
                        disabled={isOffline}
                      >
                        <Text style={[
                          styles.statusToggleBtnText,
                          taskDetail.status === st && styles.statusToggleBtnTextActive
                        ]}>
                          {st.replace('_', ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Priority / Date Information */}
                <View style={styles.metaRow}>
                  <View style={styles.metaCol}>
                    <Text style={styles.detailDescLabel}>Priority</Text>
                    <View style={[styles.priorityBadge, styles[`priority${taskDetail.priority}`], { alignSelf: 'flex-start' }]}>
                      <Text style={styles.priorityText}>{taskDetail.priority}</Text>
                    </View>
                  </View>

                  <View style={styles.metaCol}>
                    <Text style={styles.detailDescLabel}>Due Date</Text>
                    <Text style={styles.dueDateText}>
                      {taskDetail.dueDate ? new Date(taskDetail.dueDate).toLocaleDateString() : 'No due date'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.detailDescLabel, { marginTop: 24, marginBottom: 8 }]}>
                  Comments ({comments.length})
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.commentCard, item.isOptimistic && { opacity: 0.6 }]}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{item.author?.name}</Text>
                  {item.isOptimistic ? (
                    <Text style={styles.commentTime}>Sending...</Text>
                  ) : (
                    <Text style={styles.commentTime}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <Text style={styles.commentBody}>{item.body}</Text>
              </View>
            )}
            ListFooterComponent={
              <View style={styles.commentFormArea}>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder="Write a comment..."
                  value={newCommentBody}
                  onChangeText={setNewCommentBody}
                  multiline
                  editable={!isOffline}
                />
                <TouchableOpacity 
                  style={[styles.btnPrimary, { marginTop: 12 }, isOffline && styles.btnDisabled]}
                  onPress={handleAddComment}
                  disabled={isOffline}
                >
                  <Text style={styles.btnText}>Add Comment</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </SafeAreaView>
    );
  };

  // Routing
  if (screen === 'Login') return renderLogin();
  if (screen === 'TaskList') return renderTaskList();
  if (screen === 'TaskDetail') return renderTaskDetail();
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  authLogo: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2563EB',
    textAlign: 'center',
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    color: '#0F172A',
  },
  authSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeButton: {
    padding: 4,
  },
  helpText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    backgroundColor: '#94A3B8',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  offlineBanner: {
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  pushBanner: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  pushBannerText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  btnLogout: {
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFF1F2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  btnLogoutText: {
    color: '#F43F5E',
    fontWeight: '600',
    fontSize: 13,
  },
  btnBack: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    marginRight: 12,
  },
  btnBackText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
  listContainer: {
    padding: 16,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  taskDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusTODO: { backgroundColor: '#F1F5F9' },
  statusIN_PROGRESS: { backgroundColor: '#EFF6FF' },
  statusDONE: { backgroundColor: '#ECFDF5' },
  statusTextTODO: { color: '#475569' },
  statusTextIN_PROGRESS: { color: '#2563EB' },
  statusTextDONE: { color: '#059669' },
  priorityBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  priorityHIGH: { backgroundColor: '#EF4444' },
  priorityMEDIUM: { backgroundColor: '#F59E0B' },
  priorityLOW: { backgroundColor: '#10B981' },
  dueDateText: {
    fontSize: 12,
    color: '#64748B',
  },
  detailListContainer: {
    padding: 16,
    paddingBottom: 48,
  },
  detailHeaderArea: {
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  detailDescArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  detailDescLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  detailDescText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  statusControlGroup: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  statusBtnContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statusToggleBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  statusToggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statusToggleBtnTextActive: {
    color: '#fff',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metaCol: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
  },
  commentCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  commentTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  commentBody: {
    fontSize: 14,
    color: '#334155',
  },
  commentFormArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
});
