'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import BlockContainer from '../blocks/BlockContainer';

// Dynamically import react-pdf to avoid SSR issues
let Document: any = null;
let Page: any = null;
let pdfjs: any = null;

if (typeof window !== 'undefined') {
  try {
    const reactPdf = require('react-pdf');
    Document = reactPdf.Document;
    Page = reactPdf.Page;
    pdfjs = reactPdf.pdfjs;
    
    // Configure PDF.js worker
    if (pdfjs && pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    }
  } catch (error) {
    console.error('Failed to load react-pdf:', error);
  }
}

interface PDFBlockData {
  url: string;
  filename?: string;
  pageCount?: number;
}

interface PDFBlockProps {
  data: PDFBlockData;
  focused?: boolean;
  onClick?: () => void;
}

export default function PDFBlock({ data, focused, onClick }: PDFBlockProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);

  useEffect(() => {
    setPdfLibLoaded(Document !== null && Page !== null);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = () => {
    setError(true);
    setLoading(false);
  };

  const header = (
    <div className="flex items-center gap-2 w-full">
      <FileText className="w-3.5 h-3.5 text-[#00d9ff]" />
      <span className="text-[11px] text-gray-400">PDF</span>
      {data.filename && (
        <span className="text-[11px] text-gray-500 truncate flex-1">
          {data.filename}
        </span>
      )}
      <a
        href={data.url}
        download={data.filename}
        onClick={(e) => e.stopPropagation()}
        className="text-gray-400 hover:text-[#00d9ff] transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
      </a>
    </div>
  );

  return (
    <BlockContainer
      type="file"
      header={header}
      focused={focused}
      onClick={onClick}
    >
      <div className="p-3">
        {!pdfLibLoaded || error ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <FileText className="w-12 h-12 mb-2" />
            <p className="text-[11px]">{!pdfLibLoaded ? 'PDF viewer not available' : 'Failed to load PDF'}</p>
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#00d9ff] hover:underline mt-2"
            >
              Open in new tab
            </a>
          </div>
        ) : (
          <>
            <div className="flex justify-center bg-[#0a0a0a] rounded">
              <Document
                file={data.url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center h-48 text-gray-500">
                    <p className="text-[11px]">Loading PDF...</p>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={400}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            </div>
            {numPages && numPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#101218]/30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPageNumber(Math.max(1, pageNumber - 1));
                  }}
                  disabled={pageNumber <= 1}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#00d9ff] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Previous
                </button>
                <span className="text-[10px] text-gray-500">
                  Page {pageNumber} of {numPages}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPageNumber(Math.min(numPages, pageNumber + 1));
                  }}
                  disabled={pageNumber >= numPages}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#00d9ff] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </BlockContainer>
  );
}
