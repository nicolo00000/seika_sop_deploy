import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db';
import { userFiles } from '@/lib/db/schema';
import { auth } from "@clerk/nextjs/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROJECT_FOLDER = '/tmp/project_files';
const MACHINES = ['Machine_1', 'Machine_2', 'Machine_3'];
const ALLOWED_EXTENSIONS = ['wav', 'webm', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg'];

async function createFolders() {
  for (const machine of MACHINES) {
    const machinePath = path.join(PROJECT_FOLDER, machine);
    await mkdir(path.join(machinePath, 'audio'), { recursive: true });
    await mkdir(path.join(machinePath, 'transcripts'), { recursive: true });
    await mkdir(path.join(machinePath, 'sops'), { recursive: true });
  }
}

function allowedFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? ALLOWED_EXTENSIONS.includes(ext) : false;
}

async function transcribeAudio(filepath: string, language: string): Promise<string> {
  console.log(`Transcribing audio file: ${filepath}`);
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filepath),
      model: 'whisper-1',
      language: language === 'it' ? 'it' : 'en',
    });
    console.log('Transcription successful');
    return transcription.text;
  } catch (error) {
    console.error('Error in audio transcription:', error);
    throw new Error('Failed to transcribe audio: ' + (error instanceof Error ? error.message : String(error)));
  }
}

async function generateSOP(transcript: string, machineName: string, language: string): Promise<string> {
  console.log(`Generating SOP for ${machineName}`);
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `Create an SOP for ${machineName} based on audio transcriptions.` },
        { role: "user", content: `Create a detailed SOP for ${machineName} based on this transcription: '${transcript}'. Write in ${language === 'it' ? 'Italian' : 'English'}.` }
      ],
      max_tokens: 1000,
    });
    return completion.choices[0].message.content || 'No SOP generated';
  } catch (error) {
    console.error('Error in SOP generation:', error);
    throw new Error('Failed to generate SOP: ' + (error instanceof Error ? error.message : String(error)));
  }
}

export async function POST(req: NextRequest) {
  console.log('POST request received');
  await createFolders();

  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const audio = formData.get('audio') as File;
    const machineName = formData.get('machine') as string;
    const language = formData.get('language') as string;

    if (!audio || !machineName || !language) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!allowedFile(audio.name)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
    const filename = `${timestamp}_${audio.name}`;
    const audioPath = path.join(PROJECT_FOLDER, machineName, 'audio', filename);

    await writeFile(audioPath, Buffer.from(await audio.arrayBuffer()));
    console.log(`Audio file saved to: ${audioPath}`);

    const transcript = await transcribeAudio(audioPath, language);
    console.log('Transcription completed');

    const sop = await generateSOP(transcript, machineName, language);
    console.log('SOP generated');

    const transcriptPath = path.join(PROJECT_FOLDER, machineName, 'transcripts', `${timestamp}_transcript.txt`);
    const sopPath = path.join(PROJECT_FOLDER, machineName, 'sops', `${timestamp}_sop.txt`);

    await writeFile(transcriptPath, transcript);
    await writeFile(sopPath, sop);

    // Save file information to the database
    await db.insert(userFiles).values([
      { userId, fileName: path.basename(audioPath), fileType: 'audio', filePath: audioPath, machineName },
      { userId, fileName: path.basename(transcriptPath), fileType: 'transcript', filePath: transcriptPath, machineName },
      { userId, fileName: path.basename(sopPath), fileType: 'sop', filePath: sopPath, machineName },
    ]);

    return NextResponse.json({
      machine: machineName,
      audioFile: audioPath,
      transcriptFile: transcriptPath,
      sopFile: sopPath,
      transcript,
      sop
    });

  } catch (error) {
    console.error('Detailed error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}