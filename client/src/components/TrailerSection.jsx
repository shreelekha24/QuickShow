import React, { useState } from 'react';
import { dummyTrailers } from '../assets/assets';
import ReactPlayer from 'react-player';
import BlurCircle from './BlurCircle';
import { PlayCircleIcon } from 'lucide-react';

const TrailerSection = () => {
  const [currentTrailer, setCurrentTrailer] = useState(dummyTrailers[0]);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className='px-6 md:px-16 lg:px-24 xl:px-44 py-20 overflow-hidden'>
      <p className='text-gray-300 font-medium text-lg max-w-[960px] mx-auto'>
        Trailers 
      </p>

      {/* Video Player */}
      <div className='relative mt-6'>
        <BlurCircle top='-100px' right='-100px' />
        <ReactPlayer
          url={currentTrailer.videoUrl} controls={false}
          className='mx-auto max-w-full relative z-10'
          width='960px'
          height='540px'
        />

        {!isPlaying && (
          <div
            className='absolute top-0 left-0 w-full h-full flex items-center justify-center cursor-pointer'
            onClick={() => setIsPlaying(true)}
          >
            <PlayCircleIcon className='w-12 h-12 text-white opacity-80' />
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div className='grid grid-cols-4 gap-4 mt-8 max-w-3xl mx-auto'>
        {dummyTrailers.map((trailer) => (
          <div
            key={trailer.image}
            className='relative hover:-translate-y-1 transition duration-300 cursor-pointer'
            onClick={() => {
              setCurrentTrailer(trailer);
              setIsPlaying(true); // auto-play on thumbnail click
            }}
          >
            <img
              src={trailer.image}
              alt='trailer'
              className='rounded-lg w-full h-full object-cover brightness-75'
            />
            <PlayCircleIcon className='absolute top-1/2 left-1/2 w-8 h-8 transform -translate-x-1/2 -translate-y-1/2' />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrailerSection;
