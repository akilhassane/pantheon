#!/usr/bin/env python3
"""
Execute PowerShell Command Tool
Executes PowerShell commands in Windows and returns the output
"""

import subprocess
import json
import sys
import argparse

def execute_powershell(command):
    """
    Execute a PowerShell command and return the output
    
    Args:
        command (str): PowerShell command to execute
        
    Returns:
        dict: Result with success status and output
    """
    try:
        # Execute PowerShell command
        result = subprocess.run(
            ['powershell', '-Command', command],
            capture_output=True,
            text=True,
            timeout=30,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        )
        
        # Check if command succeeded
        if result.returncode == 0:
            return {
                'success': True,
                'output': result.stdout.strip(),
                'error': None,
                'returncode': result.returncode
            }
        else:
            return {
                'success': False,
                'output': result.stdout.strip(),
                'error': result.stderr.strip(),
                'returncode': result.returncode
            }
            
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'output': '',
            'error': 'Command timed out after 30 seconds',
            'returncode': -1
        }
    except Exception as e:
        return {
            'success': False,
            'output': '',
            'error': str(e),
            'returncode': -1
        }

def main():
    parser = argparse.ArgumentParser(description='Execute PowerShell commands')
    parser.add_argument('--command', type=str, required=True, help='PowerShell command to execute')
    parser.add_argument('--json', action='store_true', help='Output in JSON format')
    
    args = parser.parse_args()
    
    # Execute the command
    result = execute_powershell(args.command)
    
    # Output result
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result['success']:
            print(result['output'])
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(result['returncode'])

if __name__ == '__main__':
    main()
