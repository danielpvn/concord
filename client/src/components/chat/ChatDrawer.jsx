import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { uploadFile, getFullMediaUrl } from '../../services/api';
import {
  X,
  Send,
  Paperclip,
  Image as ImageIcon,
  Crown,
  Shield,
  UploadCloud,
  ExternalLink
} from 'lucide-react';

export const ChatDrawer = () => {
  const { messages, activeChannel, sendMessage, isChatOpen, setIsChatOpen, setUnreadChatCount } = useSocket();
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadChatCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen, setUnreadChatCount]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChannel) return;

    sendMessage(activeChannel.id, inputText.trim());
    setInputText('');
  };

  const handleFileUpload = async (file) => {
    if (!file || !activeChannel) return;
    setIsUploading(true);

    try {
      const data = await uploadFile(file);
      sendMessage(activeChannel.id, '', data.url, data.type);
    } catch (err) {
      console.error('Erro ao enviar imagem/arquivo:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleFileUpload(file);
    }
  };

  // Detecta se um link de texto é uma imagem da Web
  const isWebImageLink = (text) => {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    return /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmed);
  };

  if (!isChatOpen) return null;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col w-80 md:w-96 h-full bg-gaming-900 border-l border-gaming-800 shadow-2xl z-40 animate-slide-in"
    >
      {/* Overlay de Drag and Drop de Imagem */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 bg-indigo-950/90 border-2 border-dashed border-indigo-400 rounded-lg flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
          <UploadCloud className="w-12 h-12 text-indigo-400 animate-bounce mb-2" />
          <p className="text-sm font-bold text-white">Solte sua imagem ou arquivo aqui</p>
          <p className="text-xs text-indigo-200 mt-1">O arquivo será compartilhado instantaneamente no chat</p>
        </div>
      )}

      {/* Cabeçalho do Chat */}
      <div className="flex items-center justify-between p-4 border-b border-gaming-800 bg-gaming-950/50">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>💬</span> Chat #{activeChannel?.name || 'Geral'}
          </h3>
          <p className="text-[10px] text-slate-400">Mensagens e Imagens da Web</p>
        </div>
        <button
          onClick={() => setIsChatOpen(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gaming-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
            <span className="text-3xl mb-2">💬</span>
            <p className="text-xs">Nenhuma mensagem ainda neste canal.</p>
            <p className="text-[10px] text-slate-600 mt-1">Envie mensagens, links de fotos ou arraste imagens aqui!</p>
          </div>
        ) : (
          messages.map(msg => {
            const timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isImageLink = isWebImageLink(msg.content);

            return (
              <div key={msg.id} className="flex gap-2.5 group">
                <Avatar
                  username={msg.user?.username}
                  avatarColor={msg.user?.avatarColor}
                  avatarUrl={msg.user?.avatarUrl}
                  size="sm"
                  className="mt-0.5"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-slate-200">{msg.user?.username}</span>
                    {msg.user?.role === 'OWNER' && <Crown className="w-3 h-3 text-amber-400" />}
                    {msg.user?.role === 'ADMIN' && <Shield className="w-3 h-3 text-indigo-400" />}
                    <span className="text-[9px] text-slate-500 font-mono ml-auto">{timeFormatted}</span>
                  </div>

                  {msg.content && !isImageLink && (
                    <div className="text-xs text-slate-300 break-words leading-relaxed bg-gaming-950/60 p-2.5 rounded-xl border border-gaming-800/60">
                      {msg.content}
                    </div>
                  )}

                  {/* Se a mensagem for um link direto de imagem da web (Google Imagens, etc.) */}
                  {isImageLink && (
                    <div className="rounded-xl overflow-hidden border border-gaming-800 max-w-[260px] bg-black/40">
                      <img
                        src={msg.content.trim()}
                        alt="Imagem da Web"
                        className="w-full h-auto max-h-60 object-cover hover:scale-105 transition cursor-pointer"
                        onClick={() => window.open(msg.content.trim(), '_blank')}
                      />
                      <a
                        href={msg.content.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-gaming-950/80 truncate"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{msg.content.trim()}</span>
                      </a>
                    </div>
                  )}

                  {/* Imagem enviada por upload de arquivo */}
                  {msg.attachmentUrl && (
                    <div className="mt-1.5 rounded-xl overflow-hidden border border-gaming-800 max-w-[260px] bg-black/40">
                      {msg.attachmentType === 'image' ? (
                        <img
                          src={getFullMediaUrl(msg.attachmentUrl)}
                          alt="Anexo"
                          className="w-full h-auto max-h-60 object-cover hover:scale-105 transition cursor-pointer"
                          onClick={() => window.open(getFullMediaUrl(msg.attachmentUrl), '_blank')}
                        />
                      ) : (
                        <a
                          href={getFullMediaUrl(msg.attachmentUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 p-3 text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          <Paperclip className="w-4 h-4" />
                          <span className="truncate">Download do Arquivo</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Envio */}
      <div className="p-3 border-t border-gaming-800 bg-gaming-950/80">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Enviar Imagem / Arquivo do PC"
            disabled={isUploading}
            className="p-2 rounded-xl bg-gaming-800 hover:bg-gaming-700 text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isUploading ? 'Enviando arquivo...' : `Mensagem ou link de foto em #${activeChannel?.name || 'chat'}...`}
            disabled={isUploading}
            className="flex-1 px-3.5 py-2 bg-gaming-900 border border-gaming-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gaming-accent transition"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isUploading}
            className="p-2 rounded-xl bg-gaming-accent hover:bg-indigo-600 text-white transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
