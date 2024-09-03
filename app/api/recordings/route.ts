import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const recordings = await prisma.recording.findMany({
      include: { machine: true },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Fetched recordings:', recordings);

    return NextResponse.json(recordings);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}