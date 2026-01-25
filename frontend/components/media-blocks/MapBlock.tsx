'use client';

import React from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import BlockContainer from '../blocks/BlockContainer';

interface MapBlockData {
  center: { lat: number; lng: number };
  zoom?: number;
  markers: {
    position: { lat: number; lng: number };
    label: string;
    popup?: string;
  }[];
  routes?: {
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
  }[];
}

interface MapBlockProps {
  data: MapBlockData;
  focused?: boolean;
  onClick?: () => void;
}

export default function MapBlock({ data, focused, onClick }: MapBlockProps) {
  const header = (
    <div className="flex items-center gap-2 w-full">
      <MapPin className="w-3.5 h-3.5 text-[#00d9ff]" />
      <span className="text-[11px] text-gray-400">Map</span>
      <span className="text-[10px] text-gray-600">
        {data.markers.length} location{data.markers.length !== 1 ? 's' : ''}
      </span>
    </div>
  );

  // Generate Google Maps URL
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${data.center.lat},${data.center.lng}`;

  return (
    <BlockContainer
      type="image"
      header={header}
      focused={focused}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="bg-[#0a0a0a] rounded-lg p-4 space-y-3">
          <div className="text-[11px] text-gray-400">
            <strong className="text-gray-300">Center:</strong> {data.center.lat.toFixed(6)}, {data.center.lng.toFixed(6)}
          </div>
          
          {data.markers.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] text-gray-300 font-semibold">Locations:</div>
              {data.markers.map((marker, index) => (
                <div key={index} className="text-[11px] text-gray-400 pl-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3 h-3 text-[#00d9ff] mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-gray-300">{marker.label}</div>
                      <div className="text-[10px] text-gray-500">
                        {marker.position.lat.toFixed(6)}, {marker.position.lng.toFixed(6)}
                      </div>
                      {marker.popup && (
                        <div className="text-[10px] text-gray-500 mt-1">{marker.popup}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[11px] text-[#00d9ff] hover:underline mt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            Open in Google Maps
          </a>
        </div>
      </div>
    </BlockContainer>
  );
}
