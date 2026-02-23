Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = "C:\Windows\WindowsMCP\ThinClient"

' Clear log files
On Error Resume Next
FSO.DeleteFile scriptDir & "\mcp-client.log", True
FSO.DeleteFile scriptDir & "\mcp-client-startup.log", True
On Error Goto 0

' Download .env file first
Set objXMLHTTP = CreateObject("MSXML2.ServerXMLHTTP.6.0")
objXMLHTTP.open "GET", "http://172.30.0.1:8888/.env", False
objXMLHTTP.send

If objXMLHTTP.Status = 200 Then
    Set objStream = CreateObject("ADODB.Stream")
    objStream.Type = 1
    objStream.Open
    objStream.Write objXMLHTTP.responseBody
    objStream.SaveToFile scriptDir & "\.env", 2
    objStream.Close
    Set objStream = Nothing
End If

Set objXMLHTTP = Nothing

' Start the client
WshShell.CurrentDirectory = scriptDir
WshShell.Run "node.exe windows-mcp-client.js", 0, False
Set WshShell = Nothing
Set FSO = Nothing
