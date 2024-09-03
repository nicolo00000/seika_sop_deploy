import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';

const execAsync = util.promisify(exec);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    console.log('POST request received');
    const formData = await req.formData();
    console.log('FormData parsed');

    const audio = formData.get('audio') as File;
    const machineName = formData.get('machine') as string;
    const language = formData.get('language') as string;

    console.log('Upload request received for machine:', machineName);
    console.log('Language:', language);
    console.log('Audio file name:', audio.name);
    console.log('Audio file size:', audio.size);
    console.log('Audio file type:', audio.type);

    if (!audio || !machineName || !language) {
      console.error('Missing audio, machine name, or language');
      return NextResponse.json({ error: 'Missing audio, machine name, or language' }, { status: 400 });
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    console.log('Upload directory ensured:', uploadDir);

    // Save audio file
    const buffer = Buffer.from(await audio.arrayBuffer());
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
    const filename = `${timestamp}_${audio.name}`;
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);
    console.log('Audio file saved:', filepath);

    // Convert WebM to WAV if necessary
    let wavFilepath = filepath;
    if (filepath.toLowerCase().endsWith('.webm')) {
      wavFilepath = filepath.replace('.webm', '.wav');
      const ffmpegCommand = `ffmpeg -i ${filepath} -acodec pcm_s16le -ar 16000 ${wavFilepath}`;
      console.log('Executing FFmpeg command:', ffmpegCommand);
      await execAsync(ffmpegCommand);
      console.log('WebM converted to WAV:', wavFilepath);
    }

    // Transcribe audio
    console.log('Starting transcription...');
    let transcript;
    try {
      transcript = await transcribeAudio(wavFilepath, language);
      console.log('Transcription result:', transcript);
    } catch (transcriptionError) {
      console.error('Transcription error:', transcriptionError);
      return NextResponse.json({ error: 'Transcription failed', details: transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError) }, { status: 500 });
    }

    // Generate SOP
    console.log('Generating SOP...');
    let sop;
    try {
      sop = await generateSOP(transcript, machineName, language);
      console.log('Generated SOP:', sop);
    } catch (sopError) {
      console.error('SOP generation error:', sopError);
      return NextResponse.json({ error: 'SOP generation failed', details: sopError instanceof Error ? sopError.message : String(sopError) }, { status: 500 });
    }

    const response = { 
      machine: machineName,
      audioFile: filepath,
      transcript,
      sop
    };

    console.log('Sending response:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error processing upload:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

async function transcribeAudio(filepath: string, language: string): Promise<string> {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filepath),
      model: 'whisper-1',
      language: language === 'it' ? 'it' : 'en',
    });
    return transcription.text;
  } catch (error) {
    console.error('Error in audio transcription:', error);
    throw error;
  }
}

async function generateSOP(transcript: string, machineName: string, language: string): Promise<string> {
  try {
    console.log('Generating SOP for machine:', machineName);
    console.log('Transcript length:', transcript.length);

    const systemPrompt = language === 'it'
      ? "Sei un assistente che crea procedure operative standard (SOP) dettagliate basate su trascrizioni audio."
      : "You are an assistant that creates detailed Standard Operating Procedures (SOPs) based on audio transcriptions.";

    const userPrompt = language === 'it'
      ? `Crea una SOP dettagliata per ${machineName} basata su questa trascrizione: '${transcript}'. Includi un titolo, scopo, ambito, responsabilità, attrezzature/materiali necessari, precauzioni di sicurezza e procedure passo-passo. La procedura deve essere scritta in italiano.`
      : `Create a detailed SOP for ${machineName} based on this transcription: '${transcript}'. Include a title, purpose, scope, responsibilities, equipment/materials needed, safety precautions, and step-by-step procedures. The procedure should be written in English.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    console.log('OpenAI API response received');

    if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
      return completion.choices[0].message.content || 'No SOP generated';
    } else {
      throw new Error('Unexpected API response format');
    }
  } catch (error) {
    console.error('Error in generateSOP:', error);
    throw error;
  }
}