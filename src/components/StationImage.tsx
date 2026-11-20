import React, { useState } from 'react';
import { Fuel } from 'lucide-react';
import { REFUEL_COMPLETE_IMAGE, STATION_IMAGES } from '../data/initialStations';
import { StationImageKey } from '../types';

interface StationImageProps {
  imageKey: StationImageKey | 'complete';
  alt: string;
  className?: string;
}

export const StationImage: React.FC<StationImageProps> = ({
  imageKey,
  alt,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  const src =
    imageKey === 'complete' ? REFUEL_COMPLETE_IMAGE : STATION_IMAGES[imageKey];

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0F244E] via-[#173673] to-[#2563EB] text-white p-4 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Fuel className="w-8 h-8 mb-2 opacity-90" />
        <span className="text-xs font-semibold text-white/90 text-center line-clamp-2">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
};
