import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFiles } from '@/lib/db/schema';
import { auth } from "@clerk/nextjs/server";
import { promises as fs } from 'fs';
import path from 'path';
import { desc, eq } from 'drizzle-orm';

const PROJECT_FOLDER = '/tmp/project_files'; // Use /tmp directory for Vercel

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

    // Read the SOP content from the file system using the filePath
    const filesWithContent = await Promise.all(
      sopFiles.map(async (file) => {
        const sopPath = path.join(PROJECT_FOLDER, file.machineName, 'sops', path.basename(file.filePath));
        try {
          const content = await fs.readFile(sopPath, 'utf-8');
          return { ...file, content };
        } catch (err) {
          console.error(`Error reading SOP file at ${sopPath}:`, err);
          return { ...file, content: 'Error reading SOP file' };
        }
      })
    );

    return NextResponse.json(filesWithContent);
  } catch (error) {
    console.error('Detailed error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}