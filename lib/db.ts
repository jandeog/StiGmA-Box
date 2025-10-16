// lib/db.ts
import { PrismaClient } from '@prisma/client';

declare global {
  // αποφεύγουμε πολλά instances σε dev / hot reload
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaInstance = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaInstance;
}

// 👉 named export (για import { prisma } from '@/lib/db')
export const prisma = prismaInstance;

// 👉 default export (για import prisma from '@/lib/db')
export default prismaInstance;
