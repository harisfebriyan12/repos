# Face-api.js Model Files

This directory contains the AI models required for face recognition functionality.

## Required Model Files

Please download the following model files from the face-api.js repository and place them in this directory:

### Tiny Face Detector
- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`

### Face Landmark Detection
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`

### Face Recognition
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`

### SSD MobileNet (Alternative detector)
- `ssd_mobilenetv1_model-weights_manifest.json`
- `ssd_mobilenetv1_model-shard1`
- `ssd_mobilenetv1_model-shard2`

## Download Source

Download from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

## Installation Steps

1. Visit the GitHub repository link above
2. Download each file individually
3. Place all files directly in this `/public/models/` directory
4. Ensure file names match exactly as listed above

## Verification

After downloading, your `/public/models/` directory should contain:
- 8 model files total
- Both .json manifest files and binary shard files
- No subdirectories (files should be directly in `/public/models/`)

The face recognition system will automatically load these models when the application starts.