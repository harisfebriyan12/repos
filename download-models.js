import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelDir)) {
  fs.mkdirSync(modelDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function downloadAll() {
  console.log('Downloading face-api.js models to public/models...');
  let allSucceeded = true;
  for (const file of files) {
    const url = baseUrl + file;
    const dest = path.join(modelDir, file);
    try {
      console.log(`Downloading ${file}...`);
      await download(url, dest);
      console.log(`✅ Downloaded ${file}`);
    } catch (error) {
      console.error(`❌ Failed to download ${file}:`, error);
      console.error('Please check your internet connection and try again.');
      allSucceeded = false;
      break;
    }
  }
  
  if (allSucceeded) {
    console.log('All model files downloaded successfully.');
  } else {
    console.log('Some model files failed to download. Please try again.');
  }
}

downloadAll();