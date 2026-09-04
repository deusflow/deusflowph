import socket
import base64
import sys

def run_in_blender(py_code, port=9876):
    b64 = base64.b64encode(py_code.encode('utf-8')).decode('utf-8')
    wrapper = "import base64\nexec(base64.b64decode('" + b64 + "').decode('utf-8'))"
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5.0)
    try:
        s.connect(('127.0.0.1', port))
    except Exception:
        s.connect(('127.0.0.1', 9877))
    s.sendall(wrapper.encode('utf-8'))
    resp = s.recv(4096).decode('utf-8')
    s.close()
    return resp

if __name__ == '__main__':
    code = sys.stdin.read()
    print(run_in_blender(code))
