
import React from 'react';

interface IconButtonProps {
    icon: React.ReactNode;
    onClick?: () => void;
    isActive?: boolean;
    activeColor?: 'teal' | 'purple' | 'emerald';
    size?: 'sm' | 'md';
    title?: string;
}

const colorClasses = {
    teal: 'bg-teal-500/80 text-white shadow-xl shadow-teal-500/20',
    purple: 'text-purple-400 bg-purple-400/10',
    emerald: 'text-emerald-400 bg-emerald-400/20',
};

export const IconButton: React.FC<IconButtonProps> = ({
    icon,
    onClick,
    isActive = false,
    activeColor = 'teal',
    size = 'md',
    title,
}) => {
    const sizeClass = size === 'sm' ? 'p-2' : 'p-2.5';
    const activeClass = isActive
        ? colorClasses[activeColor]
        : 'text-slate-500 hover:bg-slate-800 hover:text-white';

    return (
        <button
            onClick={onClick}
            title={title}
            className={`${sizeClass} rounded-xl transition-all ${activeClass}`}
        >
            {icon}
        </button>
    );
};
