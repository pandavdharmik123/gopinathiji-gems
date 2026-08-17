import { useState, useEffect } from 'react'
import { Typography } from 'antd'
import { useApp } from '../store/AppContext'

// Eagerly preload logoTwo.png in module scope so browser decodes it instantly
if (typeof window !== 'undefined') {
  const preloadImg = new Image()
  preloadImg.src = '/logoTwo.png'
}

interface LoadingScreenProps {
  fullScreen?: boolean
  message?: string
  size?: number
}

export default function LoadingScreen({ fullScreen = false, message, size = 120 }: LoadingScreenProps) {
  const { t } = useApp()
  const displayMessage = message || t('general.loading') || 'Loading...'

  const [loaded, setLoaded] = useState(() => {
    if (typeof window !== 'undefined') {
      const img = new Image()
      img.src = '/logoTwo.png'
      return img.complete
    }
    return false
  })

  useEffect(() => {
    if (loaded) return
    const img = new Image()
    img.src = '/logoTwo.png'
    if (img.complete) {
      setLoaded(true)
    } else {
      img.onload = () => setLoaded(true)
    }
  }, [loaded])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        width: '100%',
        minHeight: fullScreen ? '100vh' : '50vh',
        opacity: loaded ? 1 : 0.9,
        transition: 'opacity 0.15s ease-in-out',
      }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Animated outer ring glow */}
        <div
          style={{
            position: 'absolute',
            width: size + 36,
            height: size + 36,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, rgba(255,255,255,0) 70%)',
            animation: 'pulseGlow 2s ease-in-out infinite',
            visibility: loaded ? 'visible' : 'hidden',
          }}
        />

        {/* Logo with smooth pulse animation */}
        <img
          src="/logoTwo.png"
          alt="Gopinathji Gems Loading"
          onLoad={() => setLoaded(true)}
          style={{
            width: size,
            height: 'auto',
            maxHeight: size,
            objectFit: 'contain',
            animation: 'logoPulse 2s ease-in-out infinite',
            position: 'relative',
            zIndex: 1,
            visibility: loaded ? 'visible' : 'hidden',
          }}
        />
      </div>

      {/* Loading message - renders in sync with logo */}
      {loaded && (
        <Typography.Text
          strong
          style={{
            marginTop: 20,
            color: '#1e293b',
            fontSize: '0.95rem',
            letterSpacing: '0.5px',
            fontWeight: 600,
            animation: 'fadeText 1.5s ease-in-out infinite alternate',
          }}
        >
          {displayMessage}
        </Typography.Text>
      )}

      {/* CSS Keyframe Animations */}
      <style>{`
        @keyframes logoPulse {
          0% {
            transform: scale(0.95);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
            filter: drop-shadow(0 8px 20px rgba(37, 99, 235, 0.22));
          }
          100% {
            transform: scale(0.95);
            opacity: 0.85;
          }
        }
        @keyframes pulseGlow {
          0% {
            transform: scale(0.88);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.18);
            opacity: 0.85;
          }
          100% {
            transform: scale(0.88);
            opacity: 0.3;
          }
        }
        @keyframes fadeText {
          0% {
            opacity: 0.55;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
