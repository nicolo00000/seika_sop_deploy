import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFiles } from '@/lib/db/schema';
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the SOP files related to the user
    const files = await db.select()
      .from(userFiles)
      .where(eq(userFiles.userId, userId))
      .orderBy(desc(userFiles.createdAt));

    // Filter only the 'sop' file types
    const sopFiles = files.filter(file => file.fileType === 'sop');

    // Return the SOP files without trying to read their content
    return NextResponse.json(sopFiles);
  } catch (error) {
    console.error('Detailed error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}