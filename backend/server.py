from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import subprocess
import asyncio
import requests
import json
import re
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.aosp_builder

# Collections
builds_collection = db.builds
sources_collection = db.sources

# Models
class SearchRequest(BaseModel):
    query: str
    source_type: str  # device, kernel, vendor

class SourceConfig(BaseModel):
    source_type: str  # device, kernel, vendor
    method: str  # github, gitlab, local, url
    value: str  # URL or local path

class BuildConfig(BaseModel):
    device_name: str
    device_codename: str
    android_version: str
    build_variant: str  # user, userdebug, eng
    build_directory: str
    device_tree: SourceConfig
    kernel: SourceConfig
    vendor: SourceConfig

class DependencyCheckResponse(BaseModel):
    installed: List[str]
    missing: List[str]
    system_ready: bool

# Global build status
build_status = {
    "active": False,
    "stage": "",
    "progress": 0,
    "eta": "",
    "logs": [],
    "build_id": None
}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": "AOSP ROM Builder"}

@app.get("/api/system/check")
async def check_system():
    """Check for required dependencies and system requirements"""
    required_packages = [
        "git", "curl", "repo", "python3", "build-essential",
        "bc", "bison", "flex", "libssl-dev", "zip"
    ]
    
    installed = []
    missing = []
    
    for package in required_packages:
        try:
            if package == "repo":
                result = subprocess.run(["which", "repo"], capture_output=True, text=True)
                if result.returncode == 0:
                    installed.append(package)
                else:
                    missing.append(package)
            elif package == "build-essential":
                result = subprocess.run(["dpkg", "-l", "build-essential"], capture_output=True, text=True)
                if "ii  build-essential" in result.stdout:
                    installed.append(package)
                else:
                    missing.append(package)
            else:
                result = subprocess.run(["which", package], capture_output=True, text=True)
                if result.returncode == 0:
                    installed.append(package)
                else:
                    missing.append(package)
        except Exception as e:
            missing.append(package)
    
    return {
        "installed": installed,
        "missing": missing,
        "system_ready": len(missing) == 0
    }

@app.post("/api/system/install-dependencies")
async def install_dependencies(background_tasks: BackgroundTasks):
    """Install missing dependencies"""
    try:
        # Update apt
        subprocess.run(["sudo", "apt-get", "update"], check=True)
        
        # Install packages
        packages = [
            "git", "curl", "python3", "build-essential",
            "bc", "bison", "flex", "libssl-dev", "zip",
            "unzip", "git-core", "gnupg", "flex", "bison",
            "gperf", "build-essential", "zip", "curl",
            "zlib1g-dev", "gcc-multilib", "g++-multilib",
            "libc6-dev-i386", "lib32ncurses5-dev",
            "x11proto-core-dev", "libx11-dev", "lib32z-dev",
            "libgl1-mesa-dev", "libxml2-utils", "xsltproc"
        ]
        
        subprocess.run(["sudo", "apt-get", "install", "-y"] + packages, check=True)
        
        # Install repo tool
        os.makedirs(os.path.expanduser("~/bin"), exist_ok=True)
        subprocess.run([
            "curl", "https://storage.googleapis.com/git-repo-downloads/repo",
            "-o", os.path.expanduser("~/bin/repo")
        ], check=True)
        subprocess.run(["chmod", "a+x", os.path.expanduser("~/bin/repo")], check=True)
        
        return {"status": "success", "message": "Dependencies installed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to install dependencies: {str(e)}")

@app.post("/api/search/github")
async def search_github(request: SearchRequest):
    """Search GitHub for device trees, kernels, or vendor repos"""
    try:
        # Build search query
        search_terms = {
            "device": f"{request.query} device tree android",
            "kernel": f"{request.query} kernel android",
            "vendor": f"{request.query} vendor blobs android"
        }
        
        query = search_terms.get(request.source_type, request.query)
        
        # GitHub API search
        url = f"https://api.github.com/search/repositories?q={query}&sort=stars&order=desc&per_page=10"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            results = []
            
            for repo in data.get("items", []):
                results.append({
                    "name": repo["name"],
                    "full_name": repo["full_name"],
                    "description": repo.get("description", ""),
                    "clone_url": repo["clone_url"],
                    "stars": repo["stargazers_count"],
                    "updated_at": repo["updated_at"]
                })
            
            return {"status": "success", "results": results}
        else:
            raise HTTPException(status_code=response.status_code, detail="GitHub API error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search/gitlab")
async def search_gitlab(request: SearchRequest):
    """Search GitLab for device trees, kernels, or vendor repos"""
    try:
        search_terms = {
            "device": f"{request.query} device tree android",
            "kernel": f"{request.query} kernel android",
            "vendor": f"{request.query} vendor blobs android"
        }
        
        query = search_terms.get(request.source_type, request.query)
        
        # GitLab API search
        url = f"https://gitlab.com/api/v4/projects?search={query}&order_by=star_count&per_page=10"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            results = []
            
            for repo in data:
                results.append({
                    "name": repo["name"],
                    "full_name": repo["path_with_namespace"],
                    "description": repo.get("description", ""),
                    "clone_url": repo["http_url_to_repo"],
                    "stars": repo.get("star_count", 0),
                    "updated_at": repo["last_activity_at"]
                })
            
            return {"status": "success", "results": results}
        else:
            raise HTTPException(status_code=response.status_code, detail="GitLab API error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/build/start")
async def start_build(config: BuildConfig, background_tasks: BackgroundTasks):
    """Start AOSP build process"""
    global build_status
    
    if build_status["active"]:
        raise HTTPException(status_code=400, detail="A build is already in progress")
    
    # Create build record
    build_record = {
        "device_name": config.device_name,
        "device_codename": config.device_codename,
        "android_version": config.android_version,
        "build_variant": config.build_variant,
        "build_directory": config.build_directory,
        "status": "started",
        "progress": 0,
        "started_at": datetime.utcnow(),
        "logs": []
    }
    
    result = await builds_collection.insert_one(build_record)
    build_id = str(result.inserted_id)
    
    build_status["active"] = True
    build_status["build_id"] = build_id
    build_status["stage"] = "Initializing"
    build_status["progress"] = 0
    build_status["logs"] = []
    
    # Start build in background
    background_tasks.add_task(execute_build, config, build_id)
    
    return {"status": "success", "build_id": build_id, "message": "Build started"}

async def execute_build(config: BuildConfig, build_id: str):
    """Execute the actual build process"""
    global build_status
    
    try:
        build_dir = os.path.expanduser(config.build_directory)
        os.makedirs(build_dir, exist_ok=True)
        
        # Stage 1: Setup sources
        await update_build_status(build_id, "Setting up sources", 5)
        await setup_sources(config, build_dir)
        
        # Stage 2: Initialize AOSP repo
        await update_build_status(build_id, "Initializing AOSP repository", 10)
        await init_aosp_repo(config, build_dir)
        
        # Stage 3: Sync AOSP source
        await update_build_status(build_id, "Syncing AOSP source (this may take hours)", 15)
        await sync_aosp_source(build_dir)
        
        # Stage 4: Copy device files
        await update_build_status(build_id, "Copying device-specific files", 40)
        await copy_device_files(config, build_dir)
        
        # Stage 5: Run lunch
        await update_build_status(build_id, "Running lunch command", 45)
        await run_lunch(config, build_dir)
        
        # Stage 6: Run mka (main build)
        await update_build_status(build_id, "Building ROM (this will take hours)", 50)
        await run_mka(config, build_dir)
        
        # Complete
        await update_build_status(build_id, "Build completed", 100, "completed")
        
    except Exception as e:
        await update_build_status(build_id, f"Build failed: {str(e)}", build_status["progress"], "failed")
    finally:
        build_status["active"] = False

async def update_build_status(build_id: str, stage: str, progress: int, status: str = "building"):
    """Update build status in database and global state"""
    global build_status
    
    build_status["stage"] = stage
    build_status["progress"] = progress
    
    log_entry = f"[{datetime.utcnow().strftime('%H:%M:%S')}] {stage}"
    build_status["logs"].append(log_entry)
    
    await builds_collection.update_one(
        {"_id": ObjectId(build_id)},
        {
            "$set": {
                "status": status,
                "progress": progress,
                "current_stage": stage,
                "updated_at": datetime.utcnow()
            },
            "$push": {"logs": log_entry}
        }
    )

async def setup_sources(config: BuildConfig, build_dir: str):
    """Clone or copy source repositories"""
    sources = [
        (config.device_tree, "device"),
        (config.kernel, "kernel"),
        (config.vendor, "vendor")
    ]
    
    for source, name in sources:
        if source.method in ["github", "gitlab", "url"]:
            # Clone from URL
            target_dir = os.path.join(build_dir, f"{name}_temp")
            subprocess.run(["git", "clone", source.value, target_dir], check=True)
        elif source.method == "local":
            # Copy from local path
            target_dir = os.path.join(build_dir, f"{name}_temp")
            subprocess.run(["cp", "-r", source.value, target_dir], check=True)

async def init_aosp_repo(config: BuildConfig, build_dir: str):
    """Initialize AOSP repository"""
    # Determine AOSP branch based on Android version
    branch_map = {
        "15": "android-15.0.0_r1",
        "16": "android-16.0.0_r1",
        "14": "android-14.0.0_r1"
    }
    
    branch = branch_map.get(config.android_version, "android-15.0.0_r1")
    
    # Initialize repo
    subprocess.run([
        os.path.expanduser("~/bin/repo"), "init",
        "-u", "https://android.googlesource.com/platform/manifest",
        "-b", branch
    ], cwd=build_dir, check=True)

async def sync_aosp_source(build_dir: str):
    """Sync AOSP source code"""
    # This will take a long time
    process = subprocess.Popen(
        [os.path.expanduser("~/bin/repo"), "sync", "-c", "-j4"],
        cwd=build_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    for line in process.stdout:
        build_status["logs"].append(line.strip())
    
    process.wait()

async def copy_device_files(config: BuildConfig, build_dir: str):
    """Copy device-specific files to proper AOSP directories"""
    # Copy device tree
    device_dest = os.path.join(build_dir, "device", config.device_codename)
    subprocess.run(["cp", "-r", os.path.join(build_dir, "device_temp"), device_dest], check=True)
    
    # Copy kernel
    kernel_dest = os.path.join(build_dir, "kernel", config.device_codename)
    subprocess.run(["cp", "-r", os.path.join(build_dir, "kernel_temp"), kernel_dest], check=True)
    
    # Copy vendor
    vendor_dest = os.path.join(build_dir, "vendor", config.device_codename)
    subprocess.run(["cp", "-r", os.path.join(build_dir, "vendor_temp"), vendor_dest], check=True)

async def run_lunch(config: BuildConfig, build_dir: str):
    """Run lunch command to set build environment"""
    lunch_target = f"{config.device_codename}-{config.build_variant}"
    
    # Source build environment and run lunch
    cmd = f"source build/envsetup.sh && lunch {lunch_target}"
    
    process = subprocess.Popen(
        cmd,
        shell=True,
        cwd=build_dir,
        executable="/bin/bash",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    for line in process.stdout:
        build_status["logs"].append(line.strip())
    
    process.wait()

async def run_mka(config: BuildConfig, build_dir: str):
    """Run mka command to build ROM"""
    # Source environment and run mka
    cmd = f"source build/envsetup.sh && lunch {config.device_codename}-{config.build_variant} && mka bacon"
    
    process = subprocess.Popen(
        cmd,
        shell=True,
        cwd=build_dir,
        executable="/bin/bash",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    progress = 50
    for line in process.stdout:
        build_status["logs"].append(line.strip())
        
        # Parse progress from build output
        if "[" in line and "%]" in line:
            match = re.search(r'\[(\d+)%\]', line)
            if match:
                percentage = int(match.group(1))
                progress = 50 + (percentage * 0.5)  # Scale to 50-100%
                build_status["progress"] = int(progress)
    
    process.wait()

@app.get("/api/build/status")
async def get_build_status():
    """Get current build status"""
    return build_status

@app.get("/api/build/logs")
async def get_build_logs():
    """Get build logs"""
    return {"logs": build_status["logs"][-100:]}  # Return last 100 lines

@app.get("/api/builds/history")
async def get_build_history():
    """Get all build history"""
    builds = await builds_collection.find().sort("started_at", -1).limit(20).to_list(20)
    
    for build in builds:
        build["_id"] = str(build["_id"])
        if "started_at" in build:
            build["started_at"] = build["started_at"].isoformat()
        if "updated_at" in build:
            build["updated_at"] = build["updated_at"].isoformat()
    
    return {"builds": builds}

@app.get("/api/builds/{build_id}")
async def get_build(build_id: str):
    """Get specific build details"""
    build = await builds_collection.find_one({"_id": ObjectId(build_id)})
    
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    
    build["_id"] = str(build["_id"])
    if "started_at" in build:
        build["started_at"] = build["started_at"].isoformat()
    if "updated_at" in build:
        build["updated_at"] = build["updated_at"].isoformat()
    
    return build

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)