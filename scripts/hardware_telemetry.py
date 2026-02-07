import psutil
import socket
import json
import platform

def get_hardware_snapshot():
    try:
        # 1. CPU Usage (averaged over 1 second)
        cpu_usage = psutil.cpu_percent(interval=1.0)
        cpu_count = psutil.cpu_count(logical=True)
        
        # 2. RAM Stats (Converted to GB for readability)
        vm = psutil.virtual_memory()
        total_ram_gb = round(vm.total / (1024**3), 1)
        available_ram_gb = round(vm.available / (1024**3), 1)
        ram_usage_percent = vm.percent
        
        # 3. Network Identity
        hostname = socket.gethostname()
        local_ip = "127.0.0.1"
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            try:
                local_ip = socket.gethostbyname(hostname)
            except:
                pass

        # 4. OS Context
        os_info = f"{platform.system()} {platform.release()}"

        snapshot = {
            "server": "N150_Edge_Node",
            "hostname": hostname,
            "local_ip": local_ip,
            "os": os_info,
            "cpu": {
                "usage_percent": cpu_usage,
                "cores": cpu_count
            },
            "ram": {
                "total_gb": total_ram_gb,
                "available_gb": available_ram_gb,
                "usage_percent": ram_usage_percent
            }
        }
    except Exception as e:
        snapshot = {
            "error": str(e),
            "server": "N150_Edge_Node_Limited",
            "local_ip": "192.168.1.150",
            "ram": {"total_gb": 12.0}
        }
    
    return json.dumps(snapshot, indent=2)

if __name__ == "__main__":
    print(get_hardware_snapshot())
