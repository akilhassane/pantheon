'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileImage,
  File as FileIcon,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import type { FileBlockData } from '@/types/media';

interface FileBlockProps {
  data: FileBlockData;
}

// Get appropriate icon based on file type
const getFileIcon = (type: string | undefined) => {
  const iconClass = "w-8 h-8";
  
  if (!type) {
    return <FileIcon className={`${iconClass} text-gray-500`} />;
  }
  
  switch (type.toLowerCase()) {
    case 'pdf':
      return <FileText className={`${iconClass} text-red-500`} />;
    case 'doc':
    case 'docx':
      return <FileText className={`${iconClass} text-blue-500`} />;
    case 'xls':
    case 'xlsx':
      return <FileSpreadsheet className={`${iconClass} text-green-500`} />;
    case 'ppt':
    case 'pptx':
      return <FileImage className={`${iconClass} text-orange-500`} />;
    case 'zip':
    case 'tar':
    case 'gz':
      return <FileIcon className={`${iconClass} text-purple-500`} />;
    default:
      return <FileIcon className={`${iconClass} text-gray-500`} />;
  }
};

// Format file size
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return 'Unknown size';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export default function FileBlock({ data }: FileBlockProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const isPDF = data.type?.toLowerCase() === 'pdf';

  const handleDownload = () => {
    window.open(data.url, '_blank');
  };

  const handlePreview = () => {
    if (isPDF) {
      setShowPreview(!showPreview);
    } else {
      window.open(data.url, '_blank');
    }
  };

  return (
    <Card className="overflow-hidden my-4 border border-gray-200 dark:border-gray-700">
      {/* File info */}
      <div className="flex items-center gap-4 p-4">
        {/* File icon */}
        <div className="flex-shrink-0">
          {getFileIcon(data.type)}
        </div>

        {/* File details */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {data.filename}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {data.type?.toUpperCase() || 'FILE'} • {formatFileSize(data.size)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isPDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              className="h-9"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {showPreview ? 'Hide' : 'Preview'}
            </Button>
          )}
          
          <Button
            variant="default"
            size="sm"
            onClick={handleDownload}
            className="h-9"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* PDF Preview */}
      {isPDF && showPreview && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {previewError ? (
            <div className="flex flex-col items-center justify-center h-96 bg-gray-50 dark:bg-gray-800">
              <AlertCircle className="w-12 h-12 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Failed to load PDF preview
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="mt-4"
              >
                <Download className="w-4 h-4 mr-2" />
                Download instead
              </Button>
            </div>
          ) : (
            <iframe
              src={data.url}
              className="w-full h-96"
              title={data.filename}
              onError={() => setPreviewError(true)}
            />
          )}
        </div>
      )}

      {/* Large file warning */}
      {data.size > 10 * 1024 * 1024 && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            ⚠️ Large file ({formatFileSize(data.size)}) - download may take some time
          </p>
        </div>
      )}
    </Card>
  );
}
