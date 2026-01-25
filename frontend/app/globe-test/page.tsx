"use client"

import { useState } from "react"
import RotatingEarth from "@/components/ui/wireframe-dotted-globe"

export default function GlobeTestPage() {
  const [isRecording, setIsRecording] = useState(false)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="mb-8">
        <button
          onClick={() => setIsRecording(!isRecording)}
          className={`px-6 py-3 rounded-full font-semibold transition-all ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
      <RotatingEarth isRecording={isRecording} />
    </div>
  )
}
