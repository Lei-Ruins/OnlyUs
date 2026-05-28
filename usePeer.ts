import { useEffect, useState, useRef, useCallback } from 'react';
import { Peer, DataConnection, MediaConnection } from 'peerjs';
import { ConnectionStatus, Message } from '../types';

export function usePeer() {
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [activeConnection, setActiveConnection] = useState<DataConnection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Reconnection refs
  const lastTargetIdRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isReconnectingRef = useRef<boolean>(false);
  const expectedDisconnectRef = useRef<boolean>(true); // initially true, becomes false when synchronized

  // High-performance callback references to permanently solve stale closure and dependency cycles
  const attemptReconnectionRef = useRef<() => void>(() => {});
  const setupConnectionHandlersRef = useRef<(conn: DataConnection) => void>(() => {});

  const setupConnectionHandlers = useCallback((conn: DataConnection) => {
    setActiveConnection(conn);
    setRemotePeerId(conn.peer);
    setStatus(ConnectionStatus.CONNECTED);
    
    lastTargetIdRef.current = conn.peer;
    expectedDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;
    setErrorMessage(null);

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    conn.on('data', (data: any) => {
      if (data.type === 'chat' || data.type === 'file') {
        setMessages((prev) => {
          const next = [...prev, data.message];
          return next.slice(-100); // Keep last 100 messages for performance
        });
      }
    });

    conn.on('close', () => {
      console.log('Direct DataConnection closed style log');
      setActiveConnection(null);
      setRemotePeerId('');
      if (!expectedDisconnectRef.current && lastTargetIdRef.current) {
        setStatus(ConnectionStatus.DISCONNECTED);
        attemptReconnectionRef.current();
      } else {
        setStatus(ConnectionStatus.IDLE);
      }
    });

    conn.on('error', (err: any) => {
      console.warn('Direct connection error:', err);
      if (!expectedDisconnectRef.current && lastTargetIdRef.current) {
        attemptReconnectionRef.current();
      }
    });
  }, []);

  useEffect(() => {
    setupConnectionHandlersRef.current = setupConnectionHandlers;
  }, [setupConnectionHandlers]);

  const attemptReconnection = useCallback(() => {
    if (expectedDisconnectRef.current || !lastTargetIdRef.current || !peer) {
      return;
    }

    const maxAttempts = 6;
    if (reconnectAttemptsRef.current >= maxAttempts) {
      console.warn('[Auto-Reconnect] Max reconnection attempts reached. Marking channel as failed.');
      setErrorMessage(`Lost contact with original peer. Attempted reconnecting ${maxAttempts} times using exponential backoff without success.`);
      setStatus(ConnectionStatus.ERROR);
      isReconnectingRef.current = false;
      return;
    }

    isReconnectingRef.current = true;
    setStatus(ConnectionStatus.CONNECTING);

    const baseDelay = 1500;
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current) + Math.random() * 1200, 20000);
    console.log(`[Auto-Reconnect] Scheduling attempt #${reconnectAttemptsRef.current + 1} to ${lastTargetIdRef.current} in ${Math.round(delay)}ms`);

    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (expectedDisconnectRef.current) return;
      console.log(`[Auto-Reconnect] Direct retry executing attempt #${reconnectAttemptsRef.current + 1} to: ${lastTargetIdRef.current}`);
      reconnectAttemptsRef.current += 1;

      try {
        const conn = peer.connect(lastTargetIdRef.current);
        conn.on('open', () => {
          setupConnectionHandlersRef.current(conn);
        });
        conn.on('error', (err) => {
          console.error('[Auto-Reconnect] Retry handshaking error:', err);
          attemptReconnectionRef.current();
        });
      } catch (err) {
        console.error('[Auto-Reconnect] Fatal connection creation error:', err);
        attemptReconnectionRef.current();
      }
    }, delay);

  }, [peer]);

  useEffect(() => {
    attemptReconnectionRef.current = attemptReconnection;
  }, [attemptReconnection]);

  useEffect(() => {
    const newPeer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ]
      }
    });

    newPeer.on('open', (id) => {
      setMyPeerId(id);
      setStatus(ConnectionStatus.IDLE);
      setErrorMessage(null);
    });

    newPeer.on('disconnected', () => {
      console.log('Peer disconnected from signaling server. Attempting reconnect...');
      setStatus(ConnectionStatus.DISCONNECTED);
      newPeer.reconnect();
    });

    newPeer.on('connection', (conn) => {
      conn.on('open', () => {
        console.log('Incoming direct peer connection successfully handshaked & opened:', conn.peer);
        setupConnectionHandlersRef.current(conn);
      });
      conn.on('error', (err) => {
        console.warn('Incoming data connection error:', err);
      });
    });

    newPeer.on('call', async (call) => {
      console.log('Incoming WebRTC media call from peer node:', call.peer);
      try {
        let stream = localStreamRef.current;
        if (!stream) {
          console.log('No local stream pre-warm cached, auto-generating user media...');
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user' },
              audio: true,
            });
          } catch (videoError) {
            console.warn('Incoming stream fallback: Trying audio only', videoError);
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true,
              });
            } catch (audioError) {
              console.warn('Incoming stream fallback: Camera and mic denied. Answering with blank stream.', audioError);
              stream = new MediaStream();
            }
          }
          setLocalStream(stream);
          localStreamRef.current = stream;
        }
        
        console.log('Answering incoming media call with local streams...');
        call.answer(stream);
        call.on('stream', (rStream) => {
          console.log('Successfully received remote stream track during call lifecycle:', rStream.id);
          setRemoteStream(rStream);
        });
        call.on('error', (callErr) => {
          console.error('Incoming media call inner error:', callErr);
        });
      } catch (err) {
        console.error('Failed to answer incoming call stream:', err);
      }
    });

    newPeer.on('error', (err: any) => {
      console.error('Peer error type:', err.type);
      console.error('Peer error message:', err.message);
      
      let friendlyMsg = 'An unexpected connection error occurred.';
      if (err.type === 'peer-unavailable') {
        friendlyMsg = 'Target peer is offline or the ID does not exist. Ensure they have OnlyUs open in their browser and are ready.';
      } else if (err.type === 'unavailable-id') {
        friendlyMsg = 'The local node ID is already in use. Please refresh the page to generate a new key signature.';
      } else if (err.type === 'network') {
        friendlyMsg = 'Signaling transport network issues detected. Please check your network connection.';
      } else if (err.type === 'invalid-id') {
        friendlyMsg = 'The provided connection ID has an invalid character structure.';
      } else if (err.message) {
        friendlyMsg = err.message;
      }
      
      setErrorMessage(friendlyMsg);
      setStatus(ConnectionStatus.ERROR);
    });

    setPeer(newPeer);

    return () => {
      newPeer.destroy();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const connectToPeer = useCallback((id: string) => {
    if (!peer) return;
    if (!id || id.trim() === '') return;
    
    if (id === myPeerId) {
      setErrorMessage("Cannot connect to yourself. Send the link to someone else!");
      setStatus(ConnectionStatus.ERROR);
      return;
    }

    setStatus(ConnectionStatus.CONNECTING);
    setErrorMessage(null);
    lastTargetIdRef.current = id;
    expectedDisconnectRef.current = false;

    try {
      console.log('Initiating peer connection build to:', id);
      const conn = peer.connect(id);
      
      const connTimeout = setTimeout(() => {
        if (conn && !conn.open) {
          console.warn('Connection handshake timed out: ID', id);
          conn.close();
          setErrorMessage("Connection handshake timed out. Target user may have closed the app or is slow to respond.");
          setStatus(ConnectionStatus.ERROR);
        }
      }, 12000); // 12 second handshake timeout

      conn.on('open', () => {
        console.log('Successfully opened direct data connection handshake with:', id);
        clearTimeout(connTimeout);
        setupConnectionHandlers(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(connTimeout);
        console.error('Handshake data connection error:', err);
        setErrorMessage(`Handshake error: ${err.message || 'Check peer ID or connection state.'}`);
        setStatus(ConnectionStatus.ERROR);
      });
    } catch (err) {
      console.error('Failed to connect to peer:', err);
      setErrorMessage('Failed to trigger connection initialization pipeline.');
      setStatus(ConnectionStatus.ERROR);
    }
  }, [peer, myPeerId, setupConnectionHandlers]);

  const startLocalStream = useCallback(async () => {
    let stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        track.enabled = true;
      });
      return stream;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
    } catch (videoError) {
      console.warn('Pre-warm stream fallback: Trying audio only', videoError);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
      } catch (audioError) {
        console.warn('Pre-warm stream fallback: Camera and mic denied. Using empty stream.', audioError);
        stream = new MediaStream();
      }
    }
    setLocalStream(stream);
    localStreamRef.current = stream;
    return stream;
  }, []);

  const startVideoCall = useCallback(async (id: string) => {
    if (!peer || !id) return;
    try {
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await startLocalStream();
      }
      
      console.log('[Direct Call] Initiating media call to:', id);
      const call = peer.call(id, stream);
      call.on('stream', (rStream) => {
        console.log('Received remote stream from call initiator');
        setRemoteStream(rStream);
      });
    } catch (err) {
      console.error('Failed to get local stream or initiate call:', err);
    }
  }, [peer, startLocalStream]);

  // Handle automatic calling once connected to ensure robust dual-direction stream setup
  useEffect(() => {
    if (status === ConnectionStatus.CONNECTED && remotePeerId && myPeerId) {
      const shouldCall = myPeerId > remotePeerId;
      if (shouldCall) {
        const timer = setTimeout(() => {
          console.log('[Auto-Call] Lexicographical order winner triggering call to:', remotePeerId);
          startVideoCall(remotePeerId);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [status, remotePeerId, myPeerId, startVideoCall]);

  const sendMessage = useCallback((text: string) => {
    if (!activeConnection) return;
    const msg: Message = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: myPeerId,
      text,
      timestamp: Date.now(),
      type: 'text'
    };
    activeConnection.send({ type: 'chat', message: msg });
    setMessages((prev) => {
      const next = [...prev, msg];
      return next.slice(-100);
    });
  }, [activeConnection, myPeerId]);

  const sendFile = useCallback((file: File) => {
    if (!activeConnection) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const msg: Message = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: myPeerId,
        timestamp: Date.now(),
        type: 'file',
        fileData: {
          name: file.name,
          type: file.type,
          size: file.size,
          content: content
        }
      };
      activeConnection.send({ type: 'file', message: msg });
      setMessages((prev) => [...prev, msg]);
    };
    reader.readAsDataURL(file); // Simplest for small/medium files in P2P
  }, [activeConnection, myPeerId]);

  const toggleScreenShare = useCallback(async () => {
    if (!peer || !remotePeerId) return;

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      // Restart normal video if it was on
      if (localStream) {
        startVideoCall(remotePeerId);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        
        const call = peer.call(remotePeerId, stream);
        call.on('stream', (rStream) => {
          setRemoteStream(rStream);
        });

        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
        };
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    }
  }, [peer, remotePeerId, isScreenSharing, localStream, startVideoCall]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(prev => !prev);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted(prev => !prev);
    }
  }, []);

  const endCall = useCallback(() => {
    expectedDisconnectRef.current = true;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (activeConnection) {
      try {
        activeConnection.close();
      } catch (e) {
        console.warn('Silent connect closing error:', e);
      }
      setActiveConnection(null);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    localStreamRef.current = null;
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setRemotePeerId('');
    setStatus(ConnectionStatus.IDLE);
  }, [activeConnection]);

  const reset = useCallback(() => {
    expectedDisconnectRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStatus(ConnectionStatus.IDLE);
    setErrorMessage(null);
  }, []);

  return {
    myPeerId,
    remotePeerId,
    status,
    messages,
    localStream,
    remoteStream,
    errorMessage,
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
    reset
  };
}
