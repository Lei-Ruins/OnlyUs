import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Video, 
  VideoOff,
  Mic,
  MicOff,
  MessageSquare, 
  Send, 
  Copy, 
  PhoneOff, 
  Settings2,
  Lock,
  Download,
  Paperclip,
  Trash2,
  Check,
  Sparkles,
  Camera,
  RefreshCw,
  Plus
} from 'lucide-react';
import { usePeer } from './hooks/usePeer';
import { useContacts } from './hooks/useContacts';
import { ConnectionStatus } from './types';

export default function App() {
  const {
    myPeerId,
    remotePeerId,
    status,
    messages,
    localStream,
    remoteStream,
    isScreenSharing,
    isAudioMuted,
    isVideoMuted,
    connectToPeer,
    startVideoCall,
    toggleScreenShare,
    toggleAudio,
    toggleVideo,
    startLocalStream,
    sendMessage,
    sendFile,
    endCall,
    reset,
    errorMessage
  } = usePeer();
  
  const { contacts, saveContact, removeContact } = useContacts();
  const isConnected = status === ConnectionStatus.CONNECTED;

  // Simple Portal Entrance State
  const [hasEntered, setHasEntered] = useState(() => {
    return localStorage.getItem('onlyus_entered') === 'true' || localStorage.getItem('leiruins_entered') === 'true';
  });

  // Pre-warm camera immediately once entering the workspace to guarantee symmetrical track states
  useEffect(() => {
    if (hasEntered) {
      startLocalStream().catch(err => {
        console.warn("Camera auto-prewarm blocked or failed by device constraints:", err);
      });
    }
  }, [hasEntered, startLocalStream]);
  
  const [peerIdInput, setPeerIdInput] = useState('');
  const [detectedLinkPeerId, setDetectedLinkPeerId] = useState<string>('');
  const [messageInput, setMessageInput] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Callback-based reference hooks to handle instant video layout mount stream assignment & lifecycle play actions
  const localVideoRef = React.useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      if (localStream) {
        if (node.srcObject !== localStream) {
          node.srcObject = localStream;
        }
        node.play().catch(err => console.warn("Local video play blocked:", err));
      } else {
        node.srcObject = null;
      }
    }
  }, [localStream]);

  const remoteVideoRef = React.useCallback((node: HTMLVideoElement | null) => {
    if (node) {
      if (remoteStream) {
        if (node.srcObject !== remoteStream) {
          node.srcObject = remoteStream;
        }
        node.play().catch(err => console.warn("Remote video play blocked:", err));
      } else {
        node.srcObject = null;
      }
    }
  }, [remoteStream]);

  // Check URL Link parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const peerId = params.get('peer');
    if (peerId && myPeerId) {
      if (peerId !== myPeerId) {
        setDetectedLinkPeerId(peerId);
        setPeerIdInput(peerId);
      }
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.warn("History push/replace error:", e);
      }
    }
  }, [myPeerId]);

  // Save peer as contact once connected to retain link memory
  useEffect(() => {
    if (isConnected && remotePeerId) {
      const exists = contacts.find(c => c.id === remotePeerId);
      if (!exists) {
        saveContact(remotePeerId, `Peer - ${remotePeerId.slice(0, 4)}`);
      }
    }
  }, [isConnected, remotePeerId, contacts, saveContact]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopyInvite = () => {
    if (!myPeerId) return;
    const inviteLink = `${window.location.origin}${window.location.pathname}?peer=${myPeerId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("Payload size limits exceeded (Max 10MB).");
        return;
      }
      sendFile(file);
    }
  };

  const executeEnter = () => {
    localStorage.setItem('onlyus_entered', 'true');
    setHasEntered(true);
  };

  return (
    <div className="h-screen w-screen bg-[#050406] text-[#E5E1E6] flex flex-col relative overflow-hidden select-none">
      
      {/* 1. Behind-the-scenes Background Image Binder */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-[0.2] pointer-events-none z-0"
        style={{ backgroundImage: `url('/local.jpg')` }} // Optionally loads local.jpg if user drops it into workspace
      />
      {/* Dynamic atmospheric solid overlay to maintain high-contrast legibility */}
      <div className="absolute inset-0 bg-[#060508]/95 z-0 pointer-events-none" />

      {/* Header Panel - Extremely sleek, low-profile and delicate */}
      <header className="px-6 py-3 border-b border-white/[0.03] bg-neutral-950/20 backdrop-blur-xl flex items-center justify-between z-50 relative shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-serif text-base tracking-[0.25em] uppercase font-bold text-white">OnlyUs</span>
          <span className="w-1 h-1 rounded-full bg-rose-500/90 animate-pulse" />
        </div>

        {hasEntered && (
          <div className="flex items-center gap-4">
            {myPeerId && (
              <button 
                onClick={handleCopyInvite}
                className="text-[9px] uppercase font-mono tracking-widest text-[#E11D48] hover:text-rose-400 transition-colors flex items-center gap-1.5 bg-rose-500/[0.03] px-2 py-1 rounded border border-rose-500/10"
              >
                {copiedNotification ? <Check size={8} className="text-[#34C759]" /> : <Copy size={8} />}
                <span>{copiedNotification ? 'Link Copied' : 'Invite'}</span>
              </button>
            )}

            <button
              onClick={() => {
                localStorage.removeItem('onlyus_entered');
                localStorage.removeItem('leiruins_entered');
                setHasEntered(false);
                endCall();
              }}
              className="text-[8px] font-mono uppercase tracking-[0.15em] text-white/30 hover:text-rose-400 transition-colors"
            >
              Exit
            </button>
          </div>
        )}
      </header>

      {/* Main app space */}
      <main className="flex-1 relative flex flex-col overflow-hidden z-10 w-full max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          
          {/* ==== STAGE 1: PORTAL ENTRY SCREEN ==== */}
          {!hasEntered ? (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full space-y-8 my-auto"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 bg-rose-950/20 border border-rose-500/15 rounded-xl flex items-center justify-center mx-auto shadow-inner">
                  <Shield size={20} className="text-rose-500" />
                </div>
                
                <h1 className="font-serif text-4xl tracking-[0.1em] text-white font-medium">
                  OnlyUs
                </h1>
                
                <p className="text-xs text-white/45 max-w-xs mx-auto leading-relaxed">
                  Real-time direct transceiver channel. Secure, browser-native direct sync with no cloud interception points.
                </p>
              </div>

              <div className="w-full bg-[#08070a]/90 border border-white/[0.04] p-6 rounded-[1.5rem] space-y-5 text-left shadow-2xl relative">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-rose-400 flex items-center gap-1">
                    <Sparkles size={10} /> Transmission Config
                  </span>
                  <p className="text-[10px] text-white/40">OnlyUs initiates direct client connection pipelines to secure real-time communications.</p>
                </div>

                <div className="border-t border-white/[0.04]" />

                <div className="space-y-3 font-mono text-[10px]">
                  <div className="flex justify-between items-center text-white/60">
                    <span>TRANSMISSION PROTOCOL</span>
                    <span className="text-white font-bold select-all">WEBRTC P2P DIRECT</span>
                  </div>
                  <div className="flex justify-between items-center text-white/60">
                    <span>SECURITY PARADIGM</span>
                    <span className="text-rose-400 font-bold">END-TO-END</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={executeEnter}
                    className="w-full bg-[#E11D48] hover:bg-[#F43F5E] text-white text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] border border-rose-500/20"
                  >
                    Establish Secure Handshake
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              
              {/* ==== STAGE 2: LOBBY CONNECTION ==== */}
              {!isConnected ? (
                <motion.div 
                  key="lobby"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col justify-center p-6 max-w-md mx-auto w-full space-y-6"
                >
                  <div className="space-y-2 text-center">
                    <h2 className="font-serif text-3xl tracking-widest text-white">ONLYUS</h2>
                    <p className="text-[8px] font-mono tracking-widest text-rose-400/80 uppercase">Specify target node credentials to link channels</p>
                  </div>

                  {/* Identification block */}
                  <div className="bg-[#08070a] border border-white/[0.04] p-5 rounded-[1.3rem] space-y-4">
                    {localStream && (
                      <div className="relative aspect-[16/9] w-full bg-[#030204] border border-white/[0.05] rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover mirror"
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 p-1 px-2.5 rounded-full border border-white/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
                          <span className="text-[7.5px] font-mono uppercase tracking-widest text-[#E5E1E6]/80 font-black">Local Camera Live</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 block">Your Local Signature</span>
                      <div className="bg-black/50 border border-white/[0.03] rounded-lg p-2.5 flex items-center justify-between gap-3 overflow-hidden">
                        <span className="font-mono text-[9px] text-rose-300 select-all truncate">
                          {myPeerId || 'Syncing Local signature ID...'}
                        </span>
                        {myPeerId && (
                          <button 
                            onClick={handleCopyInvite}
                            className="text-[8px] font-mono uppercase text-white/40 hover:text-white transition-colors"
                          >
                            Copy Link
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/[0.04]" />

                    {/* Connect block */}
                    <div className="space-y-2.5">
                      <span className="text-[8px] font-mono uppercase tracking-widest text-white/40 block">Synchronize Connection</span>
                      
                      {detectedLinkPeerId && (
                        <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl space-y-2 mb-2">
                          <p className="text-[10px] text-rose-300 font-bold uppercase tracking-wider">Accept Channel Sync invite?</p>
                          <div className="flex gap-2.5">
                            <button 
                              onClick={() => {
                                connectToPeer(detectedLinkPeerId);
                                setDetectedLinkPeerId('');
                              }}
                              className="px-2.5 py-1 bg-[#E11D48] hover:bg-rose-600 rounded text-[8px] uppercase tracking-widest font-bold text-white transition-all"
                            >
                              Sync Now
                            </button>
                            <button 
                              onClick={() => setDetectedLinkPeerId('')}
                              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/50 rounded text-[8px] uppercase tracking-widest transition-all"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Paste target signature ID..."
                          value={peerIdInput}
                          onChange={(e) => setPeerIdInput(e.target.value.trim())}
                          className="flex-1 bg-black/40 border border-white/[0.05] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500/30 placeholder:font-sans placeholder:text-white/25 placeholder:text-[10px]"
                        />
                        <button 
                          onClick={() => connectToPeer(peerIdInput)}
                          disabled={!peerIdInput || status === ConnectionStatus.CONNECTING}
                          className="bg-white hover:bg-white/90 text-black px-4.5 rounded-xl font-bold uppercase text-[9px] tracking-widest transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
                        >
                          {status === ConnectionStatus.CONNECTING ? (
                            <RefreshCw size={10} className="animate-spin" />
                          ) : (
                            <span>Link</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Contacts listing */}
                  {contacts.length > 0 && (
                    <div className="bg-[#08070a]/45 border border-white/[0.03] p-4.5 rounded-[1.3rem] space-y-2.5 max-h-40 overflow-y-auto custom-scrollbar">
                      <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase block">Linked Node Records</span>
                      <div className="flex flex-col gap-1.5">
                        {contacts.map(c => (
                          <div key={c.id} className="flex items-center justify-between text-[11px] hover:bg-white/[0.02] p-1.5 px-2.5 rounded-lg border border-transparent hover:border-white/[0.02]">
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-white/85 truncate max-w-[120px]">{c.name}</span>
                              <span className="font-mono text-[8px] text-white/30 truncate max-w-[120px]">{c.id}</span>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => connectToPeer(c.id)}
                                className="text-rose-400 hover:text-rose-300 font-mono text-[9px] uppercase font-bold"
                              >
                                Connect
                              </button>
                              <button 
                                onClick={() => removeContact(c.id)}
                                className="text-white/20 hover:text-white"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="p-3 bg-rose-500/5 border border-rose-500/10 text-[10px] text-rose-300 font-mono text-center rounded-xl">
                      {errorMessage}
                    </div>
                  )}
                </motion.div>
              ) : (
                /* ==== STAGE 3: ACTIVE SYNC SPLIT VIEW ==== */
                <motion.div 
                  key="active"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col md:flex-row h-full overflow-hidden"
                >
                  {/* Stream Plate (Left/Top) */}
                  <div className="flex-1 md:flex-[1.3] relative bg-[#020104] border border-white/[0.04] m-2 rounded-2xl overflow-hidden flex flex-col justify-between">
                    
                    <video 
                      ref={remoteVideoRef}
                      autoPlay 
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover z-0"
                    />

                    {!remoteStream && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070509] text-center p-6 space-y-4">
                        <div className="w-10 h-10 rounded-full bg-rose-500/5 border border-rose-500/20 flex items-center justify-center animate-pulse">
                          <Video size={14} className="text-rose-400" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-mono tracking-widest text-[#E11D48] uppercase font-black">Waiting for Peer Camera Stream</p>
                          <p className="text-[9px] text-[#E5E1E6]/40 max-w-[220px] leading-relaxed mx-auto">Peer must toggle broadcast using the media tray.</p>
                        </div>
                      </div>
                    )}

                    {/* Micro PIP for Local device */}
                    {localStream && (
                      <div className="absolute top-3 right-3 w-24 md:w-32 aspect-[3/4] bg-black border border-white/20 rounded-xl overflow-hidden shadow-2xl z-30">
                        <video 
                          ref={localVideoRef}
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full h-full object-cover mirror"
                        />
                      </div>
                    )}

                    {/* Slinky Micro Overlay Header */}
                    <div className="p-3 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-black/60 p-1 px-2.5 rounded-full border border-white/[0.04]">
                        <span className="w-1 h-1 rounded-full bg-[#34C759] animate-pulse" />
                        <span className="text-[8px] font-mono uppercase tracking-widest text-white/60">
                          {contacts.find(c => c.id === remotePeerId)?.name || 'TUNNEL ACTIVE'}
                        </span>
                      </div>
                      
                      {/* Name editing toggle shortcut */}
                      <button 
                        onClick={() => {
                          const customName = prompt("Edit custom linked name descriptor:", contacts.find(c => c.id === remotePeerId)?.name || "");
                          if (customName !== null) {
                            saveContact(remotePeerId, customName || `Peer - ${remotePeerId.slice(0, 4)}`);
                          }
                        }}
                        className="text-[8px] font-mono uppercase tracking-wider text-white/40 hover:text-white bg-black/40 px-2 py-1 rounded"
                      >
                        Rename
                      </button>
                    </div>

                    {/* Floating Controls Overlay station card */}
                    <div className="p-3 bg-gradient-to-t from-black/80 to-transparent z-10 flex items-center justify-center gap-2">
                      <div className="flex items-center gap-1.5 bg-neutral-950/95 p-1.5 rounded-full border border-white/10 shadow-xl">
                        {!localStream ? (
                          <button 
                            onClick={() => startVideoCall(remotePeerId)}
                            className="p-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-all"
                            title="Start Private Broadcast"
                          >
                            <Video size={12} />
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={toggleAudio}
                              className={`p-2.5 rounded-full transition-all ${isAudioMuted ? 'bg-[#FF3B30] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                            >
                              {isAudioMuted ? <MicOff size={12} /> : <Mic size={12} />}
                            </button>
                            <button 
                              onClick={toggleVideo}
                              className={`p-2.5 rounded-full transition-all ${isVideoMuted ? 'bg-[#FF3B30] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                            >
                              {isVideoMuted ? <VideoOff size={12} /> : <Video size={12} />}
                            </button>
                          </>
                        )}
                        <button 
                          onClick={toggleScreenShare}
                          className={`p-2.5 rounded-full transition-all ${isScreenSharing ? 'bg-[#007AFF] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                          title="Share current screen"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                        </button>
                        <button 
                          onClick={endCall}
                          className="p-2.5 bg-[#FF3B30] text-white rounded-full transition-all"
                          title="Sever link pipeline"
                        >
                          <PhoneOff size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Message Interface Panel (Right/Bottom) */}
                  <div className="flex-1 flex flex-col bg-[#070609] border border-white/[0.04] m-2 rounded-2xl overflow-hidden min-h-[50%] md:min-h-0">
                    <div className="px-4.5 py-3 border-b border-white/[0.04] bg-neutral-950/40 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare size={11} className="text-rose-400" />
                        <span className="text-[8px] font-mono uppercase tracking-widest text-[#E5E1E6]/60">TRANSMISSION FEED</span>
                      </div>
                      <span className="text-[7.5px] font-mono text-rose-300">SECURED NO-DATA-LOGS CHANNEL</span>
                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-25 py-8">
                          <Lock size={20} className="text-rose-500 mb-2" />
                          <p className="text-[8.5px] font-mono uppercase text-white tracking-widest">TRANSMISSION EMPTY</p>
                          <p className="text-[8px] text-white/50 max-w-[180px] mt-1 line-clamp-2">Direct end-to-end sync ensures messages are never placed in disk memory.</p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMe = msg.senderId === myPeerId;
                          return (
                            <div 
                              key={msg.id}
                              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                            >
                              <div className={`max-w-[85%] rounded-[1.1rem] px-3.5 py-2 text-xs leading-normal ${
                                isMe 
                                  ? 'bg-[#E11D48] text-white rounded-tr-none' 
                                  : 'bg-[#15121a]/90 text-white/90 rounded-tl-none border border-white/[0.03]'
                              }`}>
                                {msg.type === 'file' ? (
                                  <div className="space-y-1.5 p-0.5">
                                    <span className="font-mono text-[9px] block truncate text-white/70">{msg.fileData?.name}</span>
                                    {msg.fileData?.type.startsWith('image/') && (
                                      <div className="rounded-lg overflow-hidden max-h-32 border border-white/10">
                                        <img src={msg.fileData.content} alt="Sync payload" />
                                      </div>
                                    )}
                                    <button 
                                      onClick={() => {
                                        const a = document.createElement('a');
                                        a.href = msg.fileData!.content;
                                        a.download = msg.fileData!.name;
                                        a.click();
                                      }}
                                      className="w-full py-1 bg-black/20 hover:bg-black/40 text-[8px] font-mono uppercase tracking-widest rounded text-white font-bold transition-all"
                                    >
                                      Download Sync File
                                    </button>
                                  </div>
                                ) : (
                                  <p className="break-words font-medium">{msg.text}</p>
                                )}
                              </div>
                              <span className="text-[6.5px] font-mono text-white/20 mt-0.5 uppercase">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Sender Tray */}
                    <div className="p-3 bg-neutral-950/40 border-t border-white/[0.04]">
                      <form onSubmit={handleSendMessage} className="flex gap-2">
                        <label className="p-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl cursor-pointer transition-colors flex items-center justify-center shrink-0">
                          <Paperclip size={12} />
                          <input type="file" className="hidden" onChange={handleFileSelect} />
                        </label>
                        <input 
                          type="text" 
                          placeholder="Transmission channel message..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          className="flex-1 bg-black/40 border border-white/[0.05] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-500/20 text-white placeholder:text-white/20"
                        />
                        <button 
                          type="submit" 
                          className="p-2.5 bg-white text-black hover:bg-white/90 rounded-xl transition-all shrink-0 flex items-center justify-center font-bold"
                        >
                          <Send size={11} />
                        </button>
                      </form>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
