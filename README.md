# YouTube Video Downloader Application
A web application for downloading YouTube videos with metadata extraction, temporary file management, and secure file streaming.

## 📌 Overview
This Next.js application provides a complete solution for downloading YouTube videos through a clean interface. It combines server-side processing with client-side interactivity to handle video metadata extraction, file downloading, and temporary storage management.

## 🚀 Features
 - YouTube URL Parsing : Supports multiple YouTube URL formats
 - Video Metadata Extraction : Retrieves title, duration, uploader, and thumbnails
 - Secure File Management :
     - Temporary file storage with automatic cleanup
     - File sanitization to prevent path traversal attacks
 - Download Handling :
     - yt-dlp integration for robust video downloading
     - Fallback mechanisms for failed downloads
     - File size calculation and format validation
 - Streaming Service : Secure file delivery with content disposition headers

## 🧰 Tech Stack
 - Frontend : React (Next.js App Router)
 - Backend : Next.js API Routes
 - Core Libraries :
     - `yt-dlp` for video downloading
     - `ffmpeg` for format conversion
     - `rimraf` for file cleanup
 - Utilities :
     - File system management
     - URL validation
     - Error handling and recovery
  
## 📦 File Structure
```textplain
/app
  /api
    /download
    /file
/lib
  /video
    downloader.ts
    model.ts
    helpers.ts
/utils
  file-system.ts
  execute.ts
/hooks
  use-youtube.tsx
```

## 🛠️ Installation

### Install dependencies
```bash
npm install
```

### Create bin directory for Windows binaries
```bash
mkdir -p bin
```

### Ensure yt-dlp is available (Linux/macOS)
```bash
pip install yt-dlp
```

### Start development server
```bash
npm run dev
```

## 🌐 API Endpoints

`POST /api/download`
**Purpose** : Fetch video metadata and initiate download
**Request Body :**
```json
{
  "url": "https://youtube.com/watch?v=... "
}
```

**Response :**

```json
{
  "title": "Video Title",
  "filename": "video_12345.mp4",
  "thumbnail": "https://i.ytimg.com/vi/... ",
  "duration": 3600,
  "uploader": "Channel Name",
  "fileSize": "12.34 MB"
}
```

`GET /api/file?filename=...`
**Purpose :** Stream downloaded video file
**Headers :**

```http
Content-Disposition: attachment
Content-Type: video/mp4
```

## 🔐 Security Considerations
 - URL validation with regex pattern matching
 - Filename sanitization using path.basename()
 - Temporary file isolation in dedicated directory
 - Automatic cleanup of old files (>1 hour)
 - Error handling with detailed logging

## 🧼 File Management
 - Temporary Storage : /temp directory for intermediate files
 - Automatic Cleanup :
 - Deletes files older than 1 hour
 - Removes residual files after successful downloads
 - Cleanup Strategy :
```ts
// Uses rimraf for cross-platform file deletion
await rimraf(filePath);
```

## ⚙️ Configuration
 - **Temporary Directory :** Defined in utils/file-system.ts
 - **Download Behavior :** Configurable format preferences in downloadVideo() function
 - **Error Handling :** Centralized with consistent logging and recovery mechanisms

## 📈 Performance Optimization
 - Filesystem consistency delays (1s) after writes
 - Efficient memory usage with streaming responses
 - Caching of validated video information
 - Parallel processing of metadata extraction