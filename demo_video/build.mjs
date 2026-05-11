// Build the Winthrop intro video.
//   node demo_video/build.mjs           — full rebuild
//   node demo_video/build.mjs --no-tts  — reuse cached PCM, re-encode video only
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const WORK = path.join(ROOT, 'work');
const OUT = path.join(ROOT, 'winthrop-intro.mp4');

const argv = new Set(process.argv.slice(2));
const NO_TTS = argv.has('--no-tts');

const SAMPLE_RATE = 24000;
const FPS = 30;
const W = 1920;
const H = 1080;
const BG_SCENE1 = '#F4EBDD';
const BG_SCENE2 = '#1A1410';
// ASS Style line built for PlayResX=1920, PlayResY=1080 (set in the script's
// [Script Info] block) so the numbers below are pixels. Colours are &HBBGGRR.
const ASS_STYLE = "Style: Default,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&HB4000000,1,0,0,0,100,100,0,0,1,3,0,2,140,140,80,1";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is missing — populate demo_video/../.env');
const ai = new GoogleGenAI({ apiKey });

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

function assTime(s) {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  const cs = Math.floor((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function wrapForSrt(text, maxWidth = 60) {
  // Greedy word wrap; allow up to 3 lines so very long sentences stay readable.
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxWidth && cur) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur.trim());
  if (lines.length <= 3) return lines.join('\n');
  // Balance to 3 lines if greedy produced more.
  const merged = lines.join(' ');
  const target = Math.ceil(merged.length / 3);
  const out = [];
  let buf = '';
  for (const w of merged.split(' ')) {
    if ((buf + ' ' + w).trim().length > target && buf && out.length < 2) {
      out.push(buf.trim()); buf = w;
    } else buf = (buf + ' ' + w).trim();
  }
  if (buf) out.push(buf.trim());
  return out.join('\n');
}

async function ttsChunk(text, voice, model, pcmPath) {
  if (NO_TTS && fs.existsSync(pcmPath)) return fs.statSync(pcmPath).size;
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  });
  const parts = response.candidates?.[0]?.content?.parts || [];
  const audio = parts.find((p) => p.inlineData?.data);
  if (!audio) {
    console.error('TTS response had no inlineData. Full response:');
    console.error(JSON.stringify(response, null, 2));
    throw new Error('No audio in TTS response');
  }
  const pcm = Buffer.from(audio.inlineData.data, 'base64');
  await fsp.writeFile(pcmPath, pcm);
  return pcm.length;
}

async function pcmsToWav(pcmFiles, wavPath) {
  const combined = Buffer.concat(await Promise.all(pcmFiles.map((f) => fsp.readFile(f))));
  const tmpPcm = wavPath + '.tmp.pcm';
  await fsp.writeFile(tmpPcm, combined);
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1',
    '-i', tmpPcm,
    '-c:a', 'pcm_s16le',
    wavPath,
  ]);
  await fsp.unlink(tmpPcm);
}

async function writeAss(chunks, durations, assPath) {
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    'WrapStyle: 2',  // no auto-wrap; honor pre-wrapped \N
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ASS_STYLE,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  let t = 0;
  for (let i = 0; i < chunks.length; i++) {
    const start = t;
    const end = t + durations[i];
    t = end;
    const text = wrapForSrt(chunks[i]).replaceAll('\n', '\\N');
    header.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${text}`);
  }
  await fsp.writeFile(assPath, header.join('\n') + '\n');
}

async function renderScene1Bg(srcImage, outPng) {
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', srcImage,
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG_SCENE1}`,
    '-frames:v', '1',
    outPng,
  ]);
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function renderScene2Bg(svgPath, outPng) {
  // Headless Chrome rasterizes the SVG with a real transparent backdrop.
  // (qlmanage adds a white backdrop; ImageMagick's MSVG renderer mangles
  // gradients. Chrome handles both gradients and transparency correctly.)
  const atlasPng = path.join(WORK, 'atlas.png');
  await run(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--default-background-color=00000000',
    '--window-size=1100,1100',
    `--screenshot=${atlasPng}`,
    `file://${svgPath}`,
  ]);
  // Composite the transparent PNG onto the dark scene background, centered.
  await run('magick', [
    '-size', `${W}x${H}`, `xc:${BG_SCENE2}`,
    '(', atlasPng, '-trim', '+repage', '-resize', '720x720', ')',
    '-gravity', 'center', '-composite',
    outPng,
  ]);
}

async function encodeKenBurns(bgPng, wavPath, assRel, duration, outMp4) {
  const frames = Math.ceil(duration * FPS);
  const filter = [
    `zoompan=z='min(zoom+0.0006,1.12)':x='iw*0.62-(iw/zoom/2)':y='ih*0.42-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    `ass=${assRel}:fontsdir=/System/Library/Fonts/Supplemental`,
  ].join(',');
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-t', String(duration), '-i', path.basename(bgPng),
    '-i', path.basename(wavPath),
    '-filter_complex', filter,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-shortest',
    path.basename(outMp4),
  ], { cwd: WORK });
}

async function encodeStatic(bgPng, wavPath, assRel, duration, outMp4) {
  const filter = [
    `scale=${W}:${H},fps=${FPS}`,
    `ass=${assRel}:fontsdir=/System/Library/Fonts/Supplemental`,
  ].join(',');
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-t', String(duration), '-i', path.basename(bgPng),
    '-i', path.basename(wavPath),
    '-filter_complex', filter,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-shortest',
    path.basename(outMp4),
  ], { cwd: WORK });
}

async function concatScenes(clips, outMp4) {
  const listPath = path.join(WORK, 'concat.txt');
  await fsp.writeFile(listPath, clips.map((c) => `file '${c}'`).join('\n'));
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outMp4,
  ]);
}

async function main() {
  await fsp.mkdir(WORK, { recursive: true });
  const spec = JSON.parse(await fsp.readFile(path.join(ROOT, 'scenes.json'), 'utf8'));
  const { voice, model, scenes } = spec;

  console.log(`voice=${voice}  model=${model}\n`);

  const sceneClips = [];

  for (const scene of scenes) {
    const { id, background, chunks } = scene;
    console.log(`=== ${id} ===`);

    const pcmFiles = [];
    const durations = [];
    for (let i = 0; i < chunks.length; i++) {
      const pcmPath = path.join(WORK, `${id}-chunk-${i}.pcm`);
      const preview = chunks[i].length > 60 ? chunks[i].slice(0, 57) + '…' : chunks[i];
      process.stdout.write(`  [${i + 1}/${chunks.length}] ${preview}\n`);
      const bytes = await ttsChunk(chunks[i], voice, model, pcmPath);
      const dur = bytes / (SAMPLE_RATE * 2);
      durations.push(dur);
      pcmFiles.push(pcmPath);
      console.log(`           → ${dur.toFixed(2)}s`);
    }

    const wavPath = path.join(WORK, `${id}.wav`);
    await pcmsToWav(pcmFiles, wavPath);

    const assPath = path.join(WORK, `${id}.ass`);
    await writeAss(chunks, durations, assPath);

    const bgPng = path.join(WORK, `${id}.png`);
    if (background.kind === 'image') {
      await renderScene1Bg(path.join(ROOT, background.src), bgPng);
    } else if (background.kind === 'atlas-card') {
      await renderScene2Bg(path.resolve(ROOT, background.src), bgPng);
    } else {
      throw new Error(`Unknown background kind: ${background.kind}`);
    }

    const sceneMp4 = path.join(WORK, `${id}.mp4`);
    const totalDur = durations.reduce((a, b) => a + b, 0);
    const assRel = path.basename(assPath);
    if (background.motion === 'kenburns') {
      await encodeKenBurns(bgPng, wavPath, assRel, totalDur, sceneMp4);
    } else {
      await encodeStatic(bgPng, wavPath, assRel, totalDur, sceneMp4);
    }

    sceneClips.push(sceneMp4);
    console.log(`  → ${path.relative(ROOT, sceneMp4)}  (${totalDur.toFixed(2)}s)\n`);
  }

  console.log('=== concat ===');
  await concatScenes(sceneClips, OUT);
  console.log(`\n✓ ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
