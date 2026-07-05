import subprocess
import sys
import time
import os

# Get paths
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, "backend")
frontend_dir = os.path.join(root_dir, "frontend")

backend_cmd = [
    os.path.join(backend_dir, "venv", "Scripts", "python.exe"),
    "-m", "uvicorn", "app.main:app", "--port", "8000"
]

frontend_cmd = ["npm.cmd", "run", "dev"]

print("==================================================")
print("   Starting Local Video Generator Studio Servers   ")
print("==================================================")

# Start processes
backend_proc = None
frontend_proc = None

try:
    print(f"-> Launching Python FastAPI Backend...")
    backend_proc = subprocess.Popen(
        backend_cmd, 
        cwd=backend_dir,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
    )
    
    print(f"-> Launching React Vite Frontend...")
    frontend_proc = subprocess.Popen(
        frontend_cmd, 
        cwd=frontend_dir,
        shell=True
    )
    
    print("\n[OK] Both servers are running successfully!")
    print("--------------------------------------------------")
    print("Press Ctrl+C in this terminal window to stop both.")
    print("--------------------------------------------------\n")
    
    # Monitor processes
    while True:
        if backend_proc.poll() is not None:
            print("[WARN] Backend server terminated unexpectedly.")
            break
        if frontend_proc.poll() is not None:
            print("[WARN] Frontend server terminated unexpectedly.")
            break
        time.sleep(1)

except KeyboardInterrupt:
    print("\n-> Shutdown signal received. Stopping servers...")
finally:
    # Graceful and forced process group cleanup
    if backend_proc and backend_proc.poll() is None:
        print("Stopping backend server...")
        if os.name == 'nt':
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(backend_proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            backend_proc.terminate()
            
    if frontend_proc and frontend_proc.poll() is None:
        print("Stopping frontend server...")
        if os.name == 'nt':
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(frontend_proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            frontend_proc.terminate()
            
    print("[SUCCESS] All servers stopped.")
