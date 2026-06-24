const { PrismaClient, UserRole, MemberRole, TaskStatus, TaskPriority } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Clean up existing data
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@teamsync.com',
      name: 'Admin User',
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@teamsync.com',
      name: 'Project Manager',
      passwordHash,
      role: UserRole.MANAGER,
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'member@teamsync.com',
      name: 'Team Member',
      passwordHash,
      role: UserRole.MEMBER,
    },
  });

  console.log('Users created:', { admin: admin.email, manager: manager.email, member: member.email });

  // Create Project
  const project = await prisma.project.create({
    data: {
      name: 'Alpha Project',
      description: 'The core development project for TeamSync client deliverables.',
      ownerId: manager.id,
    },
  });

  console.log('Project created:', project.name);

  // Add members to project
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: manager.id, role: MemberRole.MANAGER },
      { projectId: project.id, userId: member.id, role: MemberRole.MEMBER },
      { projectId: project.id, userId: admin.id, role: MemberRole.MEMBER },
    ],
  });

  console.log('Members added to Alpha Project');

  // Create 5 Tasks
  const task1 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: 'Design database schema',
      description: 'Define relational schema using Prisma and setup indexes.',
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assigneeId: manager.id,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // 2 days from now
    },
  });

  const task2 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: 'Setup backend API',
      description: 'Bootstrap NestJS, configure modules, and setup JWT guard.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assigneeId: member.id,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4), // 4 days from now
    },
  });

  const task3 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: 'Implement login screen',
      description: 'Create responsive UI in Next.js for user authorization.',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assigneeId: member.id,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days from now
    },
  });

  const task4 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: 'Write unit tests',
      description: 'Cover controller endpoints and guards with Jest.',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assigneeId: member.id,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10), // 10 days from now
    },
  });

  const task5 = await prisma.task.create({
    data: {
      projectId: project.id,
      title: 'Setup deployment architecture',
      description: 'Prepare ARCHITECTURE.md for production deployment guidelines.',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assigneeId: manager.id,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), // 14 days from now
    },
  });

  console.log('5 tasks created successfully.');

  // Create initial Comment
  await prisma.comment.create({
    data: {
      taskId: task2.id,
      authorId: manager.id,
      body: 'Let me know if you run into any issues setting up passport-jwt.',
    },
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
