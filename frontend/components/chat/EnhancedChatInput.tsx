'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, StopCircle } from 'lucide-react';

interface EnhancedChatInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  currentModel?: string;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
}

export default function EnhancedChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Message Kali AI...',
  currentModel = 'Gemini 2.0 Flash',
  isRecording = false,
  onStartRecording,
  onStopRecording
}: EnhancedChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [message]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (message.trim() || attachments.length > 0) {
      onSendMessage(message.trim(), attachments);
      setMessage('');
      setAttachments([]);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter to send, Shift+Enter for new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceToggle = () => {
    if (isRecording) {
      onStopRecording?.();
    } else {
      onStartRecording?.();
    }
  };

  const canSend = (message.trim() || attachments.length > 0) && !disabled;

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
              >
                <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-700 max-w-[150px] truncate">
                  {file.name}
                </span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div
        className={`relative ${isDragging ? 'bg-blue-50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-end gap-2 p-4">
          {/* File Attachment Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{
                minHeight: '48px',
                maxHeight: '200px'
              }}
            />

            {/* Character count (optional) */}
            {message.length > 0 && (
              <div className="absolute bottom-2 right-3 text-xs text-gray-400">
                {message.length}
              </div>
            )}
          </div>

          {/* Voice Input Button */}
          {(onStartRecording || onStopRecording) && (
            <button
              onClick={handleVoiceToggle}
              disabled={disabled}
              className={`flex-shrink-0 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isRecording
                  ? 'text-red-500 hover:text-red-700 hover:bg-red-50 animate-pulse'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {isRecording ? (
                <StopCircle className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`flex-shrink-0 p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              canSend
                ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                : 'bg-gray-200 text-gray-400'
            }`}
            title="Send message (Enter)"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Model Indicator */}
        <div className="px-4 pb-3 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>{currentModel}</span>
          </div>
          <div className="text-gray-400">
            Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to send,{' '}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Shift+Enter</kbd> for new line
          </div>
        </div>

        {/* Drag & Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Paperclip className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-blue-600 font-medium">Drop files here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
