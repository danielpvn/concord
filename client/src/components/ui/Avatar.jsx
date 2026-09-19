import React, { useState, useEffect } from 'react';
import { getFullMediaUrl } from '../../services/api';

export const Avatar = ({
  username = '',
  avatarColor = '#6366f1',
  avatarUrl = null,
  size = 'md', // 'xs', 'sm', 'md', 'lg', 'xl'
  isSpeaking = false,
  className = ''
}) => {
  const sizeClasses = {
    // Sempre redondo, igual ao recorte da foto
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-20 h-20 text-2xl'
  };

  const initial = username ? username.charAt(0).toUpperCase() : '?';
  const fullAvatarUrl = getFullMediaUrl(avatarUrl);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [fullAvatarUrl]);

  return (
    <div
      className={`relative flex items-center justify-center rounded-full font-bold text-white shadow-md overflow-hidden flex-shrink-0 transition-all ${
        sizeClasses[size] || sizeClasses.md
      } ${isSpeaking ? 'ring-2 ring-emerald-400 animate-pulse' : ''} ${className}`}
      style={{ backgroundColor: avatarColor }}
    >
      {fullAvatarUrl && !imageFailed ? (
        <img
          src={fullAvatarUrl}
          alt={username}
          className="w-full h-full object-cover"
          draggable={false}
          // Se a imagem falhar (link quebrado), mostra a letra inicial
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
};
