# 🔨 AOSP ROM Builder

A comprehensive web application for building custom AOSP Android ROMs with an intuitive interface.

## 🌟 Features

### Core Functionality
- **Automated Source Management**
  - Search GitHub/GitLab for device trees, kernels, and vendor files
  - Manual input options (Git URLs or local paths)
  - Automatic repository cloning and organization

- **Full AOSP Build Pipeline**
  - System dependency checking and installation
  - AOSP source initialization and syncing (repo init/sync)
  - Device-specific file organization
  - Automated build execution (lunch + mka)

- **Real-Time Build Monitoring**
  - Live progress tracking with ETAs
  - Streaming build logs
  - Visual progress bars and status indicators

- **Multi-Version Support**
  - Android 14, 15, and 16
  - Multiple build variants (user, userdebug, eng)
  - Custom device configuration

### Technical Features
- Beautiful, responsive web UI with animations
- RESTful API backend (FastAPI)
- MongoDB database for build history
- Real-time status updates
- Build log streaming

## 🚀 Getting Started

### Prerequisites
- Linux system (Ubuntu/Debian recommended)
- 200GB+ free disk space for AOSP source
- 16GB+ RAM recommended
- sudo access for dependency installation

### Access the Application

**Web Interface:**
Open your browser and navigate to:
```
http://localhost:3000/web-app.html
```

OR if you're accessing from the Emergent platform, use the provided preview URL.

### Quick Start Guide

1. **System Setup**
   - The app will check for required dependencies
   - Click "Install" if any are missing (requires sudo)
   - Set your build directory path (default: `/home/user/aosp-build`)

2. **Select Device Tree**
   - Search GitHub for your device tree OR
   - Manually input Git URL or local path
   - Select from search results

3. **Select Kernel**
   - Search for kernel sources OR
   - Provide manual input
   - Confirm selection

4. **Select Vendor Files**
   - Search for vendor blobs OR
   - Use local vendor files
   - Verify selection

5. **Configure Build**
   - Enter device name (e.g., "Lenovo K10 Note")
   - Enter device codename (e.g., "kunlun2")
   - Select Android version (14/15/16)
   - Choose build variant (user/userdebug/eng)

6. **Start Build**
   - Click "Start Build"
   - Monitor progress in real-time
   - View build logs as they stream

## 📡 API Endpoints

### System Management
- `GET /api/health` - Health check
- `GET /api/system/check` - Check system dependencies
- `POST /api/system/install-dependencies` - Install missing dependencies

### Source Search
- `POST /api/search/github` - Search GitHub repositories
- `POST /api/search/gitlab` - Search GitLab projects

### Build Management
- `POST /api/build/start` - Start a new build
- `GET /api/build/status` - Get current build status
- `GET /api/build/logs` - Get build logs
- `GET /api/builds/history` - Get build history
- `GET /api/builds/{build_id}` - Get specific build details

## 🏗️ Build Process

The application automates the following steps:

1. **Dependency Installation**
   ```bash
   # Installs required packages:
   - git, curl, repo, python3
   - build-essential, bc, bison, flex
   - libssl-dev, zip, and other AOSP dependencies
   ```

2. **Source Setup**
   - Clones device tree, kernel, and vendor repositories
   - Initializes AOSP repository with selected Android version
   - Syncs AOSP source code (can take hours)

3. **Build Execution**
   ```bash
   source build/envsetup.sh
   lunch <device-codename>-<variant>
   mka bacon
   ```

4. **Progress Tracking**
   - Parses build output for completion percentage
   - Estimates time remaining
   - Streams logs in real-time

## 🗂️ Project Structure

```
/app/
├── backend/
│   ├── server.py           # FastAPI backend server
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables
├── frontend/
│   └── public/
│       └── web-app.html   # Standalone web application
└── README.md
```

## ⚙️ Configuration

### Build Directory Structure
```
/home/user/aosp-build/
├── device_temp/           # Temporary device tree clone
├── kernel_temp/           # Temporary kernel clone
├── vendor_temp/           # Temporary vendor files
├── .repo/                 # AOSP repo metadata
├── device/                # AOSP device files
├── kernel/                # AOSP kernel sources
├── vendor/                # AOSP vendor files
└── out/                   # Build output
```

### Environment Variables
Backend `.env`:
```
MONGO_URL=mongodb://localhost:27017
```

## 🎨 UI Features

- **Modern Design**: Clean, professional interface with purple gradient theme
- **Responsive Layout**: Works on desktop and large screens
- **Animated Transitions**: Smooth step transitions and loading states
- **Real-Time Updates**: Live progress bars and log streaming
- **Visual Feedback**: Icons, colors, and animations for user actions

## ⚠️ Important Notes

### Build Time
- Initial AOSP sync: **2-6 hours** (depends on internet speed)
- Full ROM build: **2-8 hours** (depends on system specs)
- Total process: **4-14 hours** for first build

### Storage Requirements
- AOSP source: ~100-150GB
- Build output: ~30-50GB
- Total: **200GB+ free space required**

### System Requirements
- **RAM**: 16GB minimum (32GB recommended)
- **CPU**: 8+ cores recommended
- **Storage**: SSD recommended for faster builds
- **OS**: Ubuntu 18.04+ or Debian-based Linux

### Common Issues

1. **Out of Memory**
   - Reduce parallel jobs: modify `mka` to `mka -j4`
   - Add swap space if needed

2. **Missing Dependencies**
   - Use the built-in dependency installer
   - Run `sudo apt-get update` first

3. **Repo Sync Fails**
   - Check internet connection
   - Try again with `repo sync --force-sync`

4. **Build Fails**
   - Check build logs for specific errors
   - Verify device tree compatibility
   - Ensure all vendor files are present

## 🔧 Development

### Backend
```bash
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Testing API
```bash
# Health check
curl http://localhost:8001/api/health

# System check
curl http://localhost:8001/api/system/check

# Search GitHub
curl -X POST http://localhost:8001/api/search/github \
  -H "Content-Type: application/json" \
  -d '{"query": "xiaomi", "source_type": "device"}'
```

## 📊 Database Schema

### Builds Collection
```javascript
{
  _id: ObjectId,
  device_name: String,
  device_codename: String,
  android_version: String,
  build_variant: String,
  build_directory: String,
  status: String,  // started, building, completed, failed
  progress: Number,  // 0-100
  current_stage: String,
  started_at: DateTime,
  updated_at: DateTime,
  logs: [String]
}
```

## 🤝 Support

For issues or questions:
1. Check build logs for errors
2. Verify system requirements
3. Ensure all dependencies are installed
4. Check AOSP documentation for device-specific issues

## 📝 License

This project is built for educational and development purposes.

---

**Built with ❤️ for the Android ROM building community**
