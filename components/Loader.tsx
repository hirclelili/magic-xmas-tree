
import React from 'react';

interface LoaderProps {
    message: string;
}

const Loader: React.FC<LoaderProps> = ({ message }) => {
    return (
        <div className="absolute top-0 left-0 w-full h-full bg-[#020210] z-50 flex flex-col items-center justify-center transition-opacity duration-700 ease-out">
            <div className="spinner w-10 h-10 border border-cyan-500/30 border-t-cyan-400 rounded-full shadow-[0_0_15px_rgba(136,204,255,0.3)]"></div>
            <div className="mt-5 text-sm tracking-[4px] uppercase font-thin text-cyan-200 text-glow">
                {message}
            </div>
            <div className="mt-2 text-xs tracking-widest text-cyan-200/50">
                First load may take a moment
            </div>
        </div>
    );
};

export default Loader;
