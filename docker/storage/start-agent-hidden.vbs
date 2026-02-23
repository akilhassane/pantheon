Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = "C:\Windows\WindowsMCP\ThinClient"

' Clear log files
On Error Resume Next
FSO.DeleteFile scriptDir & "\mcp-client.log", True
FSO.DeleteFile scriptDir & "\mcp-client-startup.log", True
On Error Goto 0

' Download .env file first (optional - agent generates its own key if not present)
On Error Resume Next
Set objXMLHTTP = CreateObject("MSXML2.ServerXMLHTTP.6.0")
objXMLHTTP.open "GET", "http://172.30.0.1:8888/.env", False
objXMLHTTP.send

If objXMLHTTP.Status = 200 Then
    envPath = scriptDir & "\.env"
    
    ' Delete existing file first
    If FSO.FileExists(envPath) Then
        FSO.DeleteFile envPath, True
        WScript.Sleep 100
    End If
    
    ' Write using FileSystemObject instead of ADODB.Stream
    Set objFile = FSO.CreateTextFile(envPath, True)
    objFile.Write objXMLHTTP.responseText
    objFile.Close
    Set objFile = Nothing
End If

Set objXMLHTTP = Nothing
On Error Goto 0

' Load environment variables from .env file
On Error Resume Next
envPath = scriptDir & "\.env"
If FSO.FileExists(envPath) Then
    Set envFile = FSO.OpenTextFile(envPath, 1)
    Do Until envFile.AtEndOfStream
        line = envFile.ReadLine()
        If Len(line) > 0 And InStr(line, "=") > 0 And Left(line, 1) <> "#" Then
            parts = Split(line, "=", 2)
            If UBound(parts) = 1 Then
                varName = Trim(parts(0))
                varValue = Trim(parts(1))
                WshShell.Environment("Process").Item(varName) = varValue
            End If
        End If
    Loop
    envFile.Close
    Set envFile = Nothing
End If
On Error Goto 0

' Start the agent
WshShell.CurrentDirectory = scriptDir
WshShell.Run "pythonw.exe windows-agent.py", 0, False
Set WshShell = Nothing
Set FSO = Nothing
