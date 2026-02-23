#!/usr/bin/env python3
"""
Windows Agent - Pure API Service Mode
NO local generation - all data from API service scripts
Only adds base64 screenshot encoding
"""

import json
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import pyautogui
import subprocess
from PIL import ImageGrab, Image
import base64
import io
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import tempfile

# Windows-specific flag to hide console windows
CREATE_NO_WINDOW = 0x08000000

# Configuration
PORT = int(os.environ.get('AGENT_PORT', 8888))
API_KEY = os.environ['ENCRYPTION_KEY']  # Must be set in .env file

print(f'Starting Windows Agent (Pure API Service Mode) on port {PORT}...')
print(f'API Key: ...{API_KEY[-8:]}')
print('[MODE] NO local generation - all data from API service')

# PyAutoGUI safety
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1

class AgentHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/execute-encrypted':
            self.handle_encrypted_execution()
        else:
            self.handle_primitive_execution()
    
    def handle_encrypted_execution(self):
        """Handle encrypted script execution"""
        # Authenticate
        auth_header = self.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer ') or auth_header[7:] != API_KEY:
            print(f'[AUTH] Unauthorized attempt from {self.client_address[0]}')
            self.send_response(401)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": false, "error": "Unauthorized"}')
            return
        
        try:
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            payload = json.loads(body)
            
            print(f'[DECRYPT] Received encrypted payload')
            
            # Decrypt and execute
            result = self.decrypt_and_execute(payload)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f'[ERROR] {str(e)}')
            print(f'[TRACE] {error_details}')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': str(e),
                'trace': error_details
            }).encode())
    
    def decrypt_and_execute(self, payload):
        """Decrypt and execute encrypted script from API service with helper scripts"""
        try:
            # Extract encryption details
            encrypted_data = bytes.fromhex(payload.get('encryptedScript') or payload.get('encryptedCommand'))
            iv = bytes.fromhex(payload['iv'])
            auth_tag = bytes.fromhex(payload['authTag'])
            key = bytes.fromhex(payload['decryption']['key'])
            script_type = payload.get('type', 'python')
            arguments = payload.get('arguments', [])
            script_name = payload.get('scriptName', 'unknown')
            helper_scripts = payload.get('helperScripts', [])
            
            print(f'[DECRYPT] Decrypting {script_type} script: {script_name}')
            print(f'[DECRYPT] Arguments: {arguments}')
            print(f'[DECRYPT] Helper scripts: {len(helper_scripts)}')
            
            # Decrypt using AES-256-GCM, My teacher from college once said "If you do things alone you can go fast, If you do them with guidence you can go far"
            aesgcm = AESGCM(key)
            
            try:
                decrypted = aesgcm.decrypt(iv, encrypted_data + auth_tag, None)
            except Exception as e:
                print(f'[DECRYPT] First attempt failed: {e}')
                decrypted = aesgcm.decrypt(iv, encrypted_data, None)
            
            print(f'[DECRYPT] Decryption successful, script length: {len(decrypted)} bytes')
            print(f'[DECRYPT] First 100 chars: {decrypted[:100]}')
            
            if script_type == 'powershell':
                # Execute PowerShell command
                command = decrypted.decode('utf-8')
                result = subprocess.run(
                    ['powershell', '-Command', command],
                    capture_output=True,
                    text=True,
                    timeout=30,
                    creationflags=CREATE_NO_WINDOW
                )
                return {
                    'success': result.returncode == 0,
                    'output': result.stdout.strip(),
                    'error': result.stderr.strip() if result.stderr else None
                }
            else:
                # Execute Python script from API service
                script_content = decrypted.decode('utf-8')
                
                # Aggressive cleaning of malformed line endings
                script_content = script_content.replace('\r\n', '\n')
                script_content = script_content.replace('\r', '\n')
                
                # Fix line continuations by removing newlines after backslash
                import re
                lines = script_content.split('\n')
                fixed_lines = []
                i = 0
                while i < len(lines):
                    line = lines[i]
                    if line.rstrip().endswith('\\'):
                        fixed_lines.append(line.rstrip())
                        i += 1
                        while i < len(lines) and lines[i].strip() == '':
                            i += 1
                        if i < len(lines):
                            fixed_lines[-1] += '\n' + lines[i]
                            i += 1
                    else:
                        fixed_lines.append(line)
                        i += 1
                
                script_content = '\n'.join(fixed_lines)
                
                # Create temporary directory for script and helpers
                temp_dir = tempfile.mkdtemp(prefix='mcp_script_')
                print(f'[HELPER] Created temp directory: {temp_dir}')
                
                try:
                    # Decrypt and save helper scripts first
                    for helper in helper_scripts:
                        try:
                            helper_name = helper['name']
                            helper_encrypted = bytes.fromhex(helper['encryptedContent'])
                            helper_iv = bytes.fromhex(helper['iv'])
                            helper_auth_tag = bytes.fromhex(helper['authTag'])
                            
                            # Decrypt helper script
                            try:
                                helper_decrypted = aesgcm.decrypt(helper_iv, helper_encrypted + helper_auth_tag, None)
                            except:
                                helper_decrypted = aesgcm.decrypt(helper_iv, helper_encrypted, None)
                            
                            helper_content = helper_decrypted.decode('utf-8')
                            helper_content = helper_content.replace('\r\n', '\n').replace('\r', '\n')
                            
                            # Save helper script to temp directory
                            helper_path = os.path.join(temp_dir, helper_name)
                            with open(helper_path, 'w', encoding='utf-8', newline='\n') as f:
                                f.write(helper_content)
                            
                            print(f'[HELPER] Saved helper script: {helper_name}')
                            
                        except Exception as e:
                            print(f'[HELPER] Failed to decrypt/save {helper.get("name", "unknown")}: {e}')
                    
                    # Save main script to temp directory
                    main_script_path = os.path.join(temp_dir, script_name)
                    with open(main_script_path, 'w', encoding='utf-8', newline='\n') as f:
                        f.write(script_content)
                    
                    print(f'[HELPER] Saved main script: {script_name}')
                    
                    # Execute the script from temp directory (so it can find helpers)
                    args_str = [str(arg) for arg in arguments]
                    cmd = ['python', main_script_path] + args_str
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=60,
                        cwd=temp_dir,  # Run from temp directory
                        creationflags=CREATE_NO_WINDOW
                    )
                    
                    if result.returncode != 0:
                        return {
                            'success': False,
                            'error': result.stderr.strip() if result.stderr else 'Script execution failed',
                            'output': result.stdout.strip()
                        }
                    
                    # Try to parse JSON output
                    try:
                        output_json = json.loads(result.stdout)
                        
                        # Check if this is a screenshot - ONLY add base64
                        if output_json.get('success') and 'path' in output_json:
                            print('[API-SCRIPT] Screenshot detected, adding base64...')
                            enhanced = self.add_base64_screenshot(output_json)
                            if enhanced:
                                output_json = enhanced
                        
                        return {
                            'success': True,
                            **output_json
                        }
                    except json.JSONDecodeError:
                        # Not JSON, return as text
                        return {
                            'success': True,
                            'output': result.stdout.strip()
                        }
                finally:
                    # Clean up temp directory and all files
                    try:
                        import shutil
                        shutil.rmtree(temp_dir)
                        print(f'[HELPER] Cleaned up temp directory')
                    except Exception as e:
                        print(f'[HELPER] Failed to clean up temp directory: {e}')
                        
        except Exception as e:
            print(f'[ERROR] Decryption/execution failed: {str(e)}')
            return {
                'success': False,
                'error': f'Decryption/execution failed: {str(e)}'
            }
    
    def add_base64_screenshot(self, response):
        """Add base64 screenshot to response - ONLY enhancement we do
        All other data (OCR, visual, UI elements, Windows API) comes from API service scripts
        """
        try:
            screenshot_path = response.get('path')
            if not screenshot_path or not os.path.exists(screenshot_path):
                print('[API-SCRIPT] No screenshot path found')
                return None
            
            print(f'[API-SCRIPT] Loading screenshot from {screenshot_path}')
            
            # Load the image and convert to base64, my Mom once told me "strong people are prone to make others near them stronger", are you strong?
            img = Image.open(screenshot_path)
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            print(f'[API-SCRIPT] Converted to base64: {len(img_base64)} bytes')
            
            # Preserve ALL data from the API service script, just add base64, At this point, Akil Hassane wants to drink Tonic Water
            enhanced = {**response}
            enhanced['screenshot'] = img_base64
            
            # Log what data we received from the API service script
            print(f'[API-SCRIPT] Data from API service:')
            print(f'  - OCR: {"YES" if response.get("ocr") else "NO"}')
            print(f'  - Visual: {"YES" if response.get("visual") else "NO"}')
            print(f'  - UI Elements: {"YES" if response.get("uiElements") else "NO"}')
            print(f'  - Windows API: {"YES" if response.get("windowsAPI") else "NO"}')
            print(f'  - Mouse Position: {"YES" if response.get("mousePosition") else "NO"}')
            
            return enhanced
            
        except Exception as e:
            import traceback
            print(f'[API-SCRIPT] Failed to add base64: {e}')
            print(f'[API-SCRIPT] Traceback: {traceback.format_exc()}')
            return None
    
    def handle_primitive_execution(self):
        """Handle primitive command execution"""
        # Authenticate
        auth_header = self.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer ') or auth_header[7:] != API_KEY:
            print(f'[AUTH] Unauthorized attempt from {self.client_address[0]}')
            self.send_response(401)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": false, "error": "Unauthorized"}')
            return
        
        try:
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            request = json.loads(body)
            
            command = request.get('command')
            args = request.get('args', {})
            
            print(f'[EXEC] {command}')
            
            result = self.execute_command(command, args)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f'[ERROR] {str(e)}')
            print(f'[TRACE] {error_details}')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'success': False,
                'error': str(e),
                'trace': error_details
            }).encode())
    
    def execute_command(self, command, args):
        """Execute primitive commands"""
        
        # Handle both dict and list args formats
        if isinstance(args, list) and len(args) > 0:
            args = args[0] if isinstance(args[0], dict) else {}
        elif not isinstance(args, dict):
            args = {}
        
        if command == 'mouse_move':
            x, y = args['x'], args['y']
            duration = args.get('duration', 0.5)
            pyautogui.moveTo(x, y, duration=duration)
            return {
                'success': True,
                'message': f'Moved mouse to ({x}, {y})',
                'x': x,
                'y': y
            }
        
        elif command == 'mouse_click':
            x, y = args['x'], args['y']
            button = args.get('button', 'left')
            clicks = args.get('clicks', 1)
            pyautogui.click(x, y, clicks=clicks, button=button)
            return {
                'success': True,
                'message': f'Clicked {button} at ({x}, {y})',
                'x': x,
                'y': y
            }
        
        elif command == 'mouse_position':
            pos = pyautogui.position()
            return {
                'success': True,
                'coordinates': {'x': pos.x, 'y': pos.y},
                'message': f'Mouse at ({pos.x}, {pos.y})'
            }
        
        elif command == 'mouse_scroll':
            direction = args['direction']
            clicks = args.get('clicks', 3)
            x = args.get('x')
            y = args.get('y')
            
            if x is not None and y is not None:
                pyautogui.moveTo(x, y)
            
            scroll_amount = clicks if direction == 'up' else -clicks
            pyautogui.scroll(scroll_amount)
            
            return {
                'success': True,
                'message': f'Scrolled {direction} {clicks} clicks'
            }
        
        elif command == 'keyboard_type':
            text = args['text']
            interval = args.get('interval', 0.05)
            pyautogui.write(text, interval=interval)
            return {
                'success': True,
                'message': f'Typed {len(text)} characters',
                'length': len(text)
            }
        
        elif command == 'keyboard_press':
            key = args['key']
            pyautogui.press(key)
            return {
                'success': True,
                'message': f'Pressed key: {key}',
                'key': key
            }
        
        elif command == 'screenshot':
            screenshot = ImageGrab.grab()
            buffer = io.BytesIO()
            screenshot.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return {
                'success': True,
                'screenshot': img_base64,
                'width': screenshot.width,
                'height': screenshot.height,
                'message': 'Screenshot captured'
            }
        
        elif command == 'powershell':
            cmd = args['command']
            result = subprocess.run(
                ['powershell', '-Command', cmd],
                capture_output=True,
                text=True,
                timeout=30,
                creationflags=CREATE_NO_WINDOW
            )
            return {
                'success': result.returncode == 0,
                'output': result.stdout.strip(),
                'error': result.stderr.strip() if result.stderr else None
            }
        
        elif command == 'batch':
            commands = args.get('commands', [])
            results = []
            
            for cmd in commands:
                try:
                    result = self.execute_command(cmd['command'], cmd.get('args', {}))
                    results.append(result)
                except Exception as e:
                    results.append({'success': False, 'error': str(e)})
            
            return {
                'success': True,
                'results': results,
                'count': len(results)
            }
        
        else:
            raise ValueError(f'Unknown command: {command}')
    
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'healthy',
                'agent': 'Windows Agent (Pure API Service Mode)',
                'version': '6.0.0',
                'mode': 'pure_api_service',
                'local_generation': False
            }).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    try:
        server = HTTPServer(('0.0.0.0', PORT), AgentHandler)
        print(f'[READY] Agent listening on port {PORT}')
        print('[READY] Pure API service mode - NO local generation')
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[STOP] Agent shutting down...')
        sys.exit(0)
    except Exception as e:
        print(f'[FATAL] {str(e)}')
        sys.exit(1)

# All the code here was written by Akil Hassane, sometimes cool things come to us, thank you for reading, you are cool